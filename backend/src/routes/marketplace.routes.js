import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { attachOptionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  PROGRESSIVE_RADIUS_TIERS_KM,
  isValidCoordinatePair,
  minProviderDistanceKm
} from '../utils/geo.js';
import { resolveLocationHierarchy } from './location.routes.js';

const router = Router();

const optionalUuid = z
  .union([z.string().uuid(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const optionalCoord = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

// Public categories
router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM service_categories WHERE is_active = TRUE ORDER BY sort_order ASC, name_en ASC'
    );
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/services', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    const params = [];
    const conditions = ['is_active = TRUE'];

    if (category && typeof category === 'string') {
      params.push(category);
      conditions.push(`category_slug = $${params.length}`);
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(title_bn ILIKE $${idx} OR title_en ILIKE $${idx} OR description_bn ILIKE $${idx} OR description_en ILIKE $${idx})`
      );
    }

    const result = await query(
      `SELECT * FROM services WHERE ${conditions.join(' AND ')} ORDER BY rating DESC, created_at DESC`,
      params
    );
    res.json({ services: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/services/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM services WHERE id = $1 AND is_active = TRUE', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Service not found' });
    res.json({ service: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * SMART NEAREST SERVICE PROVIDER SEARCH
 * - Shows ONLY active, approved, non-suspended, available providers
 * - Calculates authentic Haversine distances when customer GPS or fallback coordinates exist (never fabricates distances)
 * - Progressively expands radius: 5 km -> 10 km -> 25 km -> 50 km -> admin location match
 * - Privacy-safe projection: NEVER returns provider's personal phone, email, exact home address, exact GPS, or KYC docs
 */
router.get('/providers/search', attachOptionalAuth, async (req, res, next) => {
  try {
    const {
      category,
      subcategory,
      q,
      lat,
      lng,
      districtId,
      subdivisionId,
      localBodyId,
      gpWardId,
      pincode,
      maxDistanceKm,
      minRating,
      minExperience,
      maxPrice,
      verifiedOnly,
      sortBy
    } = req.query;

    const params = [];
    const conditions = [
      'pp.is_approved = TRUE',
      "pp.approval_status = 'approved'",
      'pp.is_available = TRUE'
    ];

    if (category && typeof category === 'string' && category.trim()) {
      params.push(category.trim());
      conditions.push(`$${params.length} = ANY(pp.service_categories)`);
    }
    if (subcategory && typeof subcategory === 'string' && subcategory.trim()) {
      params.push(subcategory.trim());
      conditions.push(`$${params.length} = ANY(pp.subcategories)`);
    }
    if (verifiedOnly === 'true') {
      conditions.push(`pp.id_verification_status = 'verified'`);
    }
    if (minRating && Number.isFinite(Number(minRating))) {
      params.push(Number(minRating));
      conditions.push(`pp.rating_avg >= $${params.length}`);
    }
    if (minExperience && Number.isFinite(Number(minExperience))) {
      params.push(Number(minExperience));
      conditions.push(`pp.experience_years >= $${params.length}`);
    }
    if (maxPrice && Number.isFinite(Number(maxPrice))) {
      params.push(Number(maxPrice));
      conditions.push(`pp.starting_price_inr <= $${params.length}`);
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(u.full_name ILIKE $${idx}
          OR pp.bio_bn ILIKE $${idx}
          OR pp.bio_en ILIKE $${idx}
          OR pp.service_location_bn ILIKE $${idx}
          OR pp.service_location_en ILIKE $${idx}
          OR pp.public_area_label_bn ILIKE $${idx}
          OR pp.public_area_label_en ILIKE $${idx}
          OR array_to_string(pp.skills, ' ') ILIKE $${idx})`
      );
    }

    // Optional strict admin boundary filters (check provider home hierarchy OR any configured service area)
    if (districtId && typeof districtId === 'string') {
      params.push(districtId);
      const idx = params.length;
      conditions.push(
        `(pp.district_id = $${idx} OR EXISTS (SELECT 1 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id AND psa.district_id = $${idx}))`
      );
    }
    if (subdivisionId && typeof subdivisionId === 'string') {
      params.push(subdivisionId);
      const idx = params.length;
      conditions.push(
        `(pp.subdivision_id = $${idx} OR EXISTS (SELECT 1 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id AND psa.subdivision_id = $${idx}))`
      );
    }
    if (localBodyId && typeof localBodyId === 'string') {
      params.push(localBodyId);
      const idx = params.length;
      conditions.push(
        `(pp.local_body_id = $${idx} OR EXISTS (SELECT 1 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id AND psa.local_body_id = $${idx}))`
      );
    }
    if (gpWardId && typeof gpWardId === 'string') {
      params.push(gpWardId);
      const idx = params.length;
      conditions.push(
        `(pp.gp_ward_id = $${idx} OR EXISTS (SELECT 1 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id AND psa.gp_ward_id = $${idx}))`
      );
    }
    if (pincode && typeof pincode === 'string' && pincode.trim()) {
      params.push(pincode.trim());
      const idx = params.length;
      conditions.push(
        `(pp.pincode = $${idx} OR EXISTS (SELECT 1 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id AND psa.pincode = $${idx}))`
      );
    }

    // Determine customer reference coordinates (real GPS preferred; administrative centroid fallback if selected)
    let refLat = isValidCoordinatePair(lat, lng) ? Number(lat) : null;
    let refLng = isValidCoordinatePair(lat, lng) ? Number(lng) : null;
    let distanceSource = refLat !== null ? 'gps' : 'none';

    if (refLat === null && (districtId || subdivisionId || localBodyId || gpWardId || pincode)) {
      const locRef = await resolveLocationHierarchy({
        districtId: typeof districtId === 'string' ? districtId : null,
        subdivisionId: typeof subdivisionId === 'string' ? subdivisionId : null,
        localBodyId: typeof localBodyId === 'string' ? localBodyId : null,
        gpWardId: typeof gpWardId === 'string' ? gpWardId : null,
        pincode: typeof pincode === 'string' ? pincode : ''
      });
      if (isValidCoordinatePair(locRef.centroidLat, locRef.centroidLng)) {
        refLat = locRef.centroidLat;
        refLng = locRef.centroidLng;
        distanceSource = 'location_centroid';
      }
    }

    const sqlRes = await query(
      `SELECT pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en,
              COALESCE(NULLIF(pp.photo_url, ''), u.profile_photo_url, '') AS photo_url,
              pp.service_categories, pp.subcategories, pp.skills,
              pp.starting_price_inr, pp.working_hours, pp.portfolio_photos,
              pp.service_location_bn, pp.service_location_en,
              pp.public_area_label_bn, pp.public_area_label_en,
              pp.district_id, pp.subdivision_id, pp.local_body_id, pp.gp_ward_id,
              pp.pincode, pp.latitude, pp.longitude,
              pp.experience_years, pp.is_available, pp.id_verification_status,
              pp.rating_avg, pp.reviews_count, pp.completed_jobs,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              s.name_en AS subdivision_name_en, s.name_bn AS subdivision_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn,
              lb.area_type, lb.body_type,
              gw.name_en AS gp_ward_name_en, gw.name_bn AS gp_ward_name_bn,
              COALESCE(
                (SELECT json_agg(json_build_object(
                   'id', psa.id,
                   'district_id', psa.district_id,
                   'subdivision_id', psa.subdivision_id,
                   'local_body_id', psa.local_body_id,
                   'gp_ward_id', psa.gp_ward_id,
                   'pincode', psa.pincode,
                   'area_label_en', psa.area_label_en,
                   'area_label_bn', psa.area_label_bn,
                   'latitude', psa.latitude,
                   'longitude', psa.longitude,
                   'radius_km', psa.radius_km
                 ))
                 FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id),
                '[]'::json
              ) AS service_areas
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN wb_districts d ON d.id = pp.district_id
       LEFT JOIN wb_subdivisions s ON s.id = pp.subdivision_id
       LEFT JOIN wb_local_bodies lb ON lb.id = pp.local_body_id
       LEFT JOIN wb_gp_wards gw ON gw.id = pp.gp_ward_id
       WHERE ${conditions.join(' AND ')}
       LIMIT 300`,
      params
    );

    const favSet = new Set();
    if (req.user?.id) {
      const favRes = await query(
        'SELECT provider_user_id FROM favourite_providers WHERE customer_id = $1',
        [req.user.id]
      );
      for (const r of favRes.rows) favSet.add(r.provider_user_id);
    }

    const enriched = sqlRes.rows.map((row) => {
      const points = [{ latitude: row.latitude, longitude: row.longitude }];
      const areas = Array.isArray(row.service_areas) ? row.service_areas : [];
      for (const a of areas) {
        points.push({ latitude: a.latitude, longitude: a.longitude });
      }
      const distKm = refLat !== null ? minProviderDistanceKm(refLat, refLng, points) : null;

      // Exact location fallback match score when GPS absent
      let adminMatchScore = 0;
      if (pincode && row.pincode === pincode) adminMatchScore += 5;
      if (gpWardId && row.gp_ward_id === gpWardId) adminMatchScore += 4;
      if (localBodyId && row.local_body_id === localBodyId) adminMatchScore += 3;
      if (subdivisionId && row.subdivision_id === subdivisionId) adminMatchScore += 2;
      if (districtId && row.district_id === districtId) adminMatchScore += 1;

      const publicAreas = areas.map((a) => ({
        area_label_en: a.area_label_en,
        area_label_bn: a.area_label_bn,
        pincode: a.pincode,
        radius_km: a.radius_km
      }));

      // Explicitly build privacy-safe public card payload (zero private phone/email/coords/KYC leaked)
      return {
        id: row.id,
        user_id: row.user_id,
        full_name: row.full_name,
        bio_bn: row.bio_bn,
        bio_en: row.bio_en,
        photo_url: row.photo_url,
        service_categories: row.service_categories || [],
        subcategories: row.subcategories || [],
        skills: row.skills || [],
        starting_price_inr: row.starting_price_inr ?? 299,
        working_hours: row.working_hours,
        portfolio_photos: Array.isArray(row.portfolio_photos) ? row.portfolio_photos : [],
        service_location_bn: row.public_area_label_bn || row.service_location_bn,
        service_location_en: row.public_area_label_en || row.service_location_en,
        district_name_en: row.district_name_en || '',
        district_name_bn: row.district_name_bn || '',
        subdivision_name_en: row.subdivision_name_en || '',
        subdivision_name_bn: row.subdivision_name_bn || '',
        local_body_name_en: row.local_body_name_en || '',
        local_body_name_bn: row.local_body_name_bn || '',
        gp_ward_name_en: row.gp_ward_name_en || '',
        gp_ward_name_bn: row.gp_ward_name_bn || '',
        area_type: row.area_type || '',
        body_type: row.body_type || '',
        service_areas: publicAreas,
        experience_years: row.experience_years,
        is_available: row.is_available,
        is_verified_provider: row.id_verification_status === 'verified',
        id_verification_status: row.id_verification_status,
        rating_avg: Number(row.rating_avg || 5),
        reviews_count: row.reviews_count || 0,
        completed_jobs: row.completed_jobs || 0,
        distance_km: distKm,
        distance_source: distKm !== null ? distanceSource : 'none',
        is_favourite: favSet.has(row.user_id),
        _adminMatchScore: adminMatchScore
      };
    });

    // Apply progressive radius expansion when coordinates exist
    let finalProviders = enriched;
    let matchedRadiusKm = null;
    const requestedMaxKm =
      maxDistanceKm && maxDistanceKm !== 'auto' && maxDistanceKm !== 'any'
        ? Number(maxDistanceKm)
        : null;

    if (refLat !== null) {
      if (requestedMaxKm && Number.isFinite(requestedMaxKm)) {
        matchedRadiusKm = requestedMaxKm;
        finalProviders = enriched.filter((p) => p.distance_km !== null && p.distance_km <= requestedMaxKm);
      } else if (maxDistanceKm !== 'any') {
        for (const tier of PROGRESSIVE_RADIUS_TIERS_KM) {
          const hits = enriched.filter((p) => p.distance_km !== null && p.distance_km <= tier);
          if (hits.length > 0) {
            matchedRadiusKm = tier;
            finalProviders = hits;
            break;
          }
        }
        // If still 0 within 50km, gracefully fall back to remaining regional matches
      }
    }

    // Sort results cleanly
    finalProviders.sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating_avg - a.rating_avg || (a.distance_km ?? 9999) - (b.distance_km ?? 9999);
      }
      if (sortBy === 'price_asc') {
        return a.starting_price_inr - b.starting_price_inr || b.rating_avg - a.rating_avg;
      }
      if (sortBy === 'experience') {
        return b.experience_years - a.experience_years || b.rating_avg - a.rating_avg;
      }
      // Default: nearest first, then admin match, then rating
      const da = a.distance_km ?? 99999;
      const db = b.distance_km ?? 99999;
      if (da !== db) return da - db;
      if (b._adminMatchScore !== a._adminMatchScore) return b._adminMatchScore - a._adminMatchScore;
      return b.rating_avg - a.rating_avg || b.completed_jobs - a.completed_jobs;
    });

    const sanitized = finalProviders.map(({ _adminMatchScore, ...rest }) => rest);

    res.json({
      providers: sanitized,
      searchMeta: {
        total: sanitized.length,
        matchedRadiusKm,
        distanceSource,
        tiersCheckedKm: PROGRESSIVE_RADIUS_TIERS_KM
      }
    });
  } catch (err) {
    next(err);
  }
});

// Public approved workers directory (privacy-safe alias kept compatible with existing clients)
router.get('/providers', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    const params = [];
    const conditions = ['pp.is_approved = TRUE', "pp.approval_status = 'approved'"];

    if (category && typeof category === 'string') {
      params.push(category);
      conditions.push(`$${params.length} = ANY(pp.service_categories)`);
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(u.full_name ILIKE $${idx} OR pp.service_location_bn ILIKE $${idx} OR pp.service_location_en ILIKE $${idx})`
      );
    }

    const result = await query(
      `SELECT pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en,
              COALESCE(NULLIF(pp.photo_url, ''), u.profile_photo_url, '') AS photo_url,
              pp.service_categories, pp.subcategories, pp.skills,
              pp.starting_price_inr, pp.working_hours, pp.portfolio_photos,
              COALESCE(NULLIF(pp.public_area_label_bn, ''), pp.service_location_bn) AS service_location_bn,
              COALESCE(NULLIF(pp.public_area_label_en, ''), pp.service_location_en) AS service_location_en,
              pp.experience_years, pp.is_available,
              (pp.id_verification_status = 'verified') AS is_verified_provider,
              pp.id_verification_status,
              pp.rating_avg, pp.reviews_count, pp.completed_jobs
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pp.is_available DESC, pp.rating_avg DESC, pp.completed_jobs DESC`,
      params
    );
    res.json({ providers: result.rows });
  } catch (err) {
    next(err);
  }
});

// Privacy-safe public provider full profile
router.get('/providers/:id', attachOptionalAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en,
              COALESCE(NULLIF(pp.photo_url, ''), u.profile_photo_url, '') AS photo_url,
              pp.service_categories, pp.subcategories, pp.skills,
              pp.starting_price_inr, pp.working_hours, pp.portfolio_photos,
              COALESCE(NULLIF(pp.public_area_label_bn, ''), pp.service_location_bn) AS service_location_bn,
              COALESCE(NULLIF(pp.public_area_label_en, ''), pp.service_location_en) AS service_location_en,
              pp.experience_years, pp.is_available, pp.is_approved, pp.approval_status,
              (pp.id_verification_status = 'verified') AS is_verified_provider,
              pp.id_verification_status,
              pp.rating_avg, pp.reviews_count, pp.completed_jobs,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              s.name_en AS subdivision_name_en, s.name_bn AS subdivision_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn,
              gw.name_en AS gp_ward_name_en, gw.name_bn AS gp_ward_name_bn
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN wb_districts d ON d.id = pp.district_id
       LEFT JOIN wb_subdivisions s ON s.id = pp.subdivision_id
       LEFT JOIN wb_local_bodies lb ON lb.id = pp.local_body_id
       LEFT JOIN wb_gp_wards gw ON gw.id = pp.gp_ward_id
       WHERE (pp.id::text = $1 OR pp.user_id::text = $1)
         AND pp.is_approved = TRUE AND pp.approval_status = 'approved'`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Worker profile not found' });

    const provider = result.rows[0];
    const [reviewsRes, areasRes, servicesRes, favRes] = await Promise.all([
      query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
         FROM reviews r
         JOIN users u ON u.id = r.customer_id
         WHERE r.provider_id = $1 AND r.is_visible = TRUE
         ORDER BY r.created_at DESC LIMIT 20`,
        [provider.user_id]
      ),
      query(
        `SELECT id, area_label_en, area_label_bn, pincode, radius_km
         FROM provider_service_areas
         WHERE provider_user_id = $1
         ORDER BY created_at ASC`,
        [provider.user_id]
      ),
      query(
        `SELECT * FROM services WHERE provider_user_id = $1 AND is_active = TRUE ORDER BY base_price_inr ASC`,
        [provider.user_id]
      ),
      req.user?.id
        ? query(
            'SELECT 1 FROM favourite_providers WHERE customer_id = $1 AND provider_user_id = $2',
            [req.user.id, provider.user_id]
          )
        : Promise.resolve({ rows: [] })
    ]);

    provider.service_areas = areasRes.rows;
    provider.services = servicesRes.rows;
    provider.is_favourite = favRes.rows.length > 0;

    res.json({ provider, reviews: reviewsRes.rows });
  } catch (err) {
    next(err);
  }
});

// Authenticated provider self profile, service areas, earnings & registration
router.get('/provider/me', requireAuth, async (req, res, next) => {
  try {
    const [profRes, reviewsRes, areasRes, availRes] = await Promise.all([
      query('SELECT * FROM provider_profiles WHERE user_id = $1', [req.user.id]),
      query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
         FROM reviews r
         JOIN users u ON u.id = r.customer_id
         WHERE r.provider_id = $1 AND r.is_visible = TRUE
         ORDER BY r.created_at DESC LIMIT 30`,
        [req.user.id]
      ),
      query(
        `SELECT psa.*, d.name_en AS district_name_en, d.name_bn AS district_name_bn,
                lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn
         FROM provider_service_areas psa
         LEFT JOIN wb_districts d ON d.id = psa.district_id
         LEFT JOIN wb_local_bodies lb ON lb.id = psa.local_body_id
         WHERE psa.provider_user_id = $1
         ORDER BY psa.created_at ASC`,
        [req.user.id]
      ),
      query('SELECT * FROM provider_availability WHERE provider_user_id = $1', [req.user.id])
    ]);
    res.json({
      profile: profRes.rows[0] || null,
      reviews: reviewsRes.rows,
      serviceAreas: areasRes.rows,
      availability: availRes.rows[0] || null
    });
  } catch (err) {
    next(err);
  }
});

const serviceAreaItemSchema = z.object({
  districtId: optionalUuid,
  subdivisionId: optionalUuid,
  localBodyId: optionalUuid,
  gpWardId: optionalUuid,
  villageId: optionalUuid,
  pincode: z.string().trim().max(16).optional().default(''),
  areaLabelEn: z.string().trim().max(180).optional().default(''),
  areaLabelBn: z.string().trim().max(180).optional().default(''),
  latitude: optionalCoord,
  longitude: optionalCoord,
  radiusKm: z.number().int().min(1).max(100).default(10)
});

const providerApplySchema = z.object({
  bioBn: z.string().trim().max(800).default(''),
  bioEn: z.string().trim().max(800).default(''),
  photoUrl: z.string().trim().max(500).default(''),
  serviceCategories: z.array(z.string().trim()).min(1),
  subcategories: z.array(z.string().trim()).optional().default([]),
  skills: z.array(z.string().trim()).optional().default([]),
  startingPriceInr: z.number().int().min(50).max(100000).optional().default(299),
  workingHours: z
    .object({
      days: z.array(z.string().trim()).default(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']),
      start: z.string().trim().default('09:00'),
      end: z.string().trim().default('20:00')
    })
    .optional(),
  portfolioPhotos: z.array(z.string().trim().max(500)).max(10).optional().default([]),
  idDocType: z.string().trim().max(40).optional().default(''),
  idDocNumberMasked: z.string().trim().max(40).optional().default(''),
  idDocUrls: z.array(z.string().trim().max(500)).max(4).optional().default([]),
  districtId: optionalUuid,
  subdivisionId: optionalUuid,
  areaType: z.enum(['urban', 'rural', '']).optional().default(''),
  localBodyId: optionalUuid,
  gpWardId: optionalUuid,
  villageId: optionalUuid,
  villageLocality: z.string().trim().max(180).optional().default(''),
  pincode: z.string().trim().max(16).optional().default(''),
  latitude: optionalCoord,
  longitude: optionalCoord,
  gpsConsent: z.boolean().optional().default(false),
  serviceAreas: z.array(serviceAreaItemSchema).max(20).optional(),
  serviceLocationBn: z.string().trim().max(140).optional().default(''),
  serviceLocationEn: z.string().trim().max(140).optional().default(''),
  experienceYears: z.number().int().min(0).max(60).default(1),
  isAvailable: z.boolean().default(true)
});

router.post('/provider/apply', requireAuth, validateBody(providerApplySchema), async (req, res, next) => {
  try {
    const d = req.validated;
    const loc = await resolveLocationHierarchy({
      districtId: d.districtId,
      subdivisionId: d.subdivisionId,
      localBodyId: d.localBodyId,
      gpWardId: d.gpWardId,
      villageId: d.villageId,
      pincode: d.pincode
    });

    const locEn = (d.serviceLocationEn || loc.areaLabelEn || 'West Bengal').slice(0, 140);
    const locBn = (d.serviceLocationBn || loc.areaLabelBn || 'পশ্চিমবঙ্গ').slice(0, 140);
    // Public label excludes house/street-level details: District + Block/Municipality + GP/Ward
    const pubEn = [loc.gpWard?.name_en, loc.localBody?.name_en, loc.subdivision?.name_en, loc.district?.name_en]
      .filter(Boolean)
      .join(', ') || locEn;
    const pubBn = [loc.gpWard?.name_bn, loc.localBody?.name_bn, loc.subdivision?.name_bn, loc.district?.name_bn]
      .filter(Boolean)
      .join(', ') || locBn;

    const finalLat = d.gpsConsent && isValidCoordinatePair(d.latitude, d.longitude) ? d.latitude : loc.centroidLat;
    const finalLng = d.gpsConsent && isValidCoordinatePair(d.latitude, d.longitude) ? d.longitude : loc.centroidLng;
    const finalPin = d.pincode || loc.resolvedPincode || '';

    const saved = await withTransaction(async (client) => {
      if (req.user.role === 'customer') {
        await client.query("UPDATE users SET role = 'provider', updated_at = NOW() WHERE id = $1", [req.user.id]);
      }

      // Preserve already-approved status unless suspended/rejected; new profiles start pending
      const existingProf = await client.query(
        'SELECT is_approved, approval_status, id_verification_status FROM provider_profiles WHERE user_id = $1',
        [req.user.id]
      );
      const curr = existingProf.rows[0];
      const keepApproved = curr?.is_approved === true && curr?.approval_status === 'approved';
      const nextApproved = keepApproved;
      const nextStatus = keepApproved ? 'approved' : curr?.approval_status === 'suspended' ? 'suspended' : 'pending';
      const nextKycStatus = curr?.id_verification_status || 'pending';

      const profRes = await client.query(
        `INSERT INTO provider_profiles (
           user_id, bio_bn, bio_en, photo_url, service_categories, subcategories, skills,
           starting_price_inr, working_hours, portfolio_photos,
           id_doc_type, id_doc_number_masked, id_doc_urls, id_verification_status,
           service_location_bn, service_location_en, public_area_label_bn, public_area_label_en,
           district_id, subdivision_id, area_type, local_body_id, gp_ward_id, village_id,
           village_locality, pincode, latitude, longitude, gps_consent,
           experience_years, is_available, is_approved, approval_status
         ) VALUES (
           $1,$2,$3,$4,$5::text[],$6::text[],$7::text[],
           $8,$9::jsonb,$10::jsonb,
           $11,$12,$13::jsonb,$14,
           $15,$16,$17,$18,
           $19,$20,$21,$22,$23,$24,
           $25,$26,$27,$28,$29,
           $30,$31,$32,$33
         )
         ON CONFLICT (user_id) DO UPDATE SET
           bio_bn = $2, bio_en = $3,
           photo_url = CASE WHEN $4 <> '' THEN $4 ELSE provider_profiles.photo_url END,
           service_categories = $5::text[],
           subcategories = $6::text[],
           skills = $7::text[],
           starting_price_inr = $8,
           working_hours = COALESCE($9::jsonb, provider_profiles.working_hours),
           portfolio_photos = $10::jsonb,
           id_doc_type = CASE WHEN $11 <> '' THEN $11 ELSE provider_profiles.id_doc_type END,
           id_doc_number_masked = CASE WHEN $12 <> '' THEN $12 ELSE provider_profiles.id_doc_number_masked END,
           id_doc_urls = CASE WHEN jsonb_array_length($13::jsonb) > 0 THEN $13::jsonb ELSE provider_profiles.id_doc_urls END,
           service_location_bn = $15, service_location_en = $16,
           public_area_label_bn = $17, public_area_label_en = $18,
           district_id = COALESCE($19, provider_profiles.district_id),
           subdivision_id = COALESCE($20, provider_profiles.subdivision_id),
           area_type = CASE WHEN $21 <> '' THEN $21 ELSE provider_profiles.area_type END,
           local_body_id = COALESCE($22, provider_profiles.local_body_id),
           gp_ward_id = COALESCE($23, provider_profiles.gp_ward_id),
           village_id = COALESCE($24, provider_profiles.village_id),
           village_locality = CASE WHEN $25 <> '' THEN $25 ELSE provider_profiles.village_locality END,
           pincode = CASE WHEN $26 <> '' THEN $26 ELSE provider_profiles.pincode END,
           latitude = COALESCE($27, provider_profiles.latitude),
           longitude = COALESCE($28, provider_profiles.longitude),
           gps_consent = $29,
           experience_years = $30,
           is_available = $31,
           updated_at = NOW()
         RETURNING *`,
        [
          req.user.id,
          d.bioBn,
          d.bioEn,
          d.photoUrl,
          d.serviceCategories,
          d.subcategories,
          d.skills,
          d.startingPriceInr,
          JSON.stringify(d.workingHours || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00', end: '20:00' }),
          JSON.stringify(d.portfolioPhotos),
          d.idDocType,
          d.idDocNumberMasked,
          JSON.stringify(d.idDocUrls),
          nextKycStatus,
          locBn,
          locEn,
          pubBn.slice(0, 180),
          pubEn.slice(0, 180),
          d.districtId,
          d.subdivisionId,
          d.areaType || loc.localBody?.area_type || '',
          d.localBodyId,
          d.gpWardId,
          d.villageId,
          d.villageLocality || loc.village?.name_en || '',
          finalPin,
          finalLat,
          finalLng,
          Boolean(d.gpsConsent),
          d.experienceYears,
          d.isAvailable,
          nextApproved,
          nextStatus
        ]
      );

      await client.query(
        `INSERT INTO provider_availability (provider_user_id, is_available, working_hours, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (provider_user_id) DO UPDATE SET is_available = $2, working_hours = COALESCE($3::jsonb, provider_availability.working_hours), updated_at = NOW()`,
        [
          req.user.id,
          d.isAvailable,
          JSON.stringify(d.workingHours || { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00', end: '20:00' })
        ]
      );

      if (Array.isArray(d.serviceAreas)) {
        await client.query('DELETE FROM provider_service_areas WHERE provider_user_id = $1', [req.user.id]);
        for (const area of d.serviceAreas) {
          const areaLoc = await resolveLocationHierarchy({
            districtId: area.districtId,
            subdivisionId: area.subdivisionId,
            localBodyId: area.localBodyId,
            gpWardId: area.gpWardId,
            villageId: area.villageId,
            pincode: area.pincode
          });
          await client.query(
            `INSERT INTO provider_service_areas (
               provider_user_id, district_id, subdivision_id, local_body_id, gp_ward_id, village_id,
               pincode, area_label_en, area_label_bn, latitude, longitude, radius_km
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              req.user.id,
              area.districtId,
              area.subdivisionId,
              area.localBodyId,
              area.gpWardId,
              area.villageId,
              area.pincode || areaLoc.resolvedPincode || '',
              area.areaLabelEn || areaLoc.areaLabelEn || 'West Bengal',
              area.areaLabelBn || areaLoc.areaLabelBn || 'পশ্চিমবঙ্গ',
              area.latitude ?? areaLoc.centroidLat,
              area.longitude ?? areaLoc.centroidLng,
              area.radiusKm || 10
            ]
          );
        }
      }

      return profRes.rows[0];
    });

    res.json({ profile: saved });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/provider/me/availability',
  requireAuth,
  requireRole('provider', 'admin'),
  validateBody(
    z.object({
      isAvailable: z.boolean(),
      statusNote: z.string().trim().max(120).optional()
    })
  ),
  async (req, res, next) => {
    try {
      const { isAvailable, statusNote } = req.validated;
      const result = await withTransaction(async (client) => {
        const pRes = await client.query(
          'UPDATE provider_profiles SET is_available = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
          [isAvailable, req.user.id]
        );
        await client.query(
          `INSERT INTO provider_availability (provider_user_id, is_available, status_note, updated_at)
           VALUES ($1, $2, COALESCE($3, ''), NOW())
           ON CONFLICT (provider_user_id) DO UPDATE SET is_available = $2, status_note = COALESCE($3, provider_availability.status_note), updated_at = NOW()`,
          [req.user.id, isAvailable, statusNote ?? null]
        );
        return pRes.rows[0];
      });
      res.json({ profile: result });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/provider/me/service-areas',
  requireAuth,
  requireRole('provider', 'admin'),
  validateBody(z.object({ areas: z.array(serviceAreaItemSchema).min(1).max(20) })),
  async (req, res, next) => {
    try {
      const savedAreas = await withTransaction(async (client) => {
        await client.query('DELETE FROM provider_service_areas WHERE provider_user_id = $1', [req.user.id]);
        const inserted = [];
        for (const area of req.validated.areas) {
          const areaLoc = await resolveLocationHierarchy({
            districtId: area.districtId,
            subdivisionId: area.subdivisionId,
            localBodyId: area.localBodyId,
            gpWardId: area.gpWardId,
            villageId: area.villageId,
            pincode: area.pincode
          });
          const r = await client.query(
            `INSERT INTO provider_service_areas (
               provider_user_id, district_id, subdivision_id, local_body_id, gp_ward_id, village_id,
               pincode, area_label_en, area_label_bn, latitude, longitude, radius_km
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [
              req.user.id,
              area.districtId,
              area.subdivisionId,
              area.localBodyId,
              area.gpWardId,
              area.villageId,
              area.pincode || areaLoc.resolvedPincode || '',
              area.areaLabelEn || areaLoc.areaLabelEn || 'West Bengal',
              area.areaLabelBn || areaLoc.areaLabelBn || 'পশ্চিমবঙ্গ',
              area.latitude ?? areaLoc.centroidLat,
              area.longitude ?? areaLoc.centroidLng,
              area.radiusKm || 10
            ]
          );
          inserted.push(r.rows[0]);
        }
        return inserted;
      });
      res.json({ serviceAreas: savedAreas });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/provider/earnings', requireAuth, requireRole('provider', 'admin'), async (req, res, next) => {
  try {
    const summary = await query(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_jobs,
              COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress'))::int AS active_jobs,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_jobs,
              COALESCE(SUM(amount_inr) FILTER (WHERE status = 'completed'), 0)::int AS total_earnings_inr,
              COALESCE(SUM(amount_inr) FILTER (WHERE status = 'completed' AND payment_status = 'paid'), 0)::int AS paid_online_inr,
              COALESCE(SUM(amount_inr) FILTER (WHERE status = 'completed' AND created_at >= date_trunc('month', NOW())), 0)::int AS this_month_inr
       FROM bookings
       WHERE provider_id = $1`,
      [req.user.id]
    );
    const recentRes = await query(
      `SELECT id, service_title_bn, service_title_en, amount_inr, payment_method, payment_status, status, preferred_date, updated_at
       FROM bookings
       WHERE provider_id = $1 AND status = 'completed'
       ORDER BY updated_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ earnings: summary.rows[0], recentCompleted: recentRes.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/content', async (_req, res, next) => {
  try {
    const result = await query('SELECT key, value_bn, value_en FROM site_content');
    res.json({ content: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
