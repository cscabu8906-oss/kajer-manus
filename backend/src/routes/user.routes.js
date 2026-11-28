import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { USER_SELECT_FIELDS, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { resolveLocationHierarchy } from './location.routes.js';

const router = Router();
router.use(requireAuth);

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

router.get('/me', async (req, res, next) => {
  try {
    const [addrRes, favRes] = await Promise.all([
      query(
        `SELECT ua.*,
                d.name_en AS district_name_en, d.name_bn AS district_name_bn,
                s.name_en AS subdivision_name_en, s.name_bn AS subdivision_name_bn,
                lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn,
                gw.name_en AS gp_ward_name_en, gw.name_bn AS gp_ward_name_bn
         FROM user_addresses ua
         LEFT JOIN wb_districts d ON d.id = ua.district_id
         LEFT JOIN wb_subdivisions s ON s.id = ua.subdivision_id
         LEFT JOIN wb_local_bodies lb ON lb.id = ua.local_body_id
         LEFT JOIN wb_gp_wards gw ON gw.id = ua.gp_ward_id
         WHERE ua.user_id = $1
         ORDER BY ua.is_default DESC, ua.created_at DESC`,
        [req.user.id]
      ),
      query(
        `SELECT fp.id AS favourite_id, fp.created_at AS favourited_at,
                pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en, pp.photo_url,
                pp.service_categories, pp.public_area_label_bn, pp.public_area_label_en,
                pp.service_location_bn, pp.service_location_en,
                pp.experience_years, pp.starting_price_inr, pp.is_available,
                pp.id_verification_status, pp.rating_avg, pp.reviews_count, pp.completed_jobs
         FROM favourite_providers fp
         JOIN provider_profiles pp ON pp.user_id = fp.provider_user_id
         JOIN users u ON u.id = pp.user_id
         WHERE fp.customer_id = $1 AND pp.is_approved = TRUE AND pp.approval_status = 'approved'
         ORDER BY fp.created_at DESC`,
        [req.user.id]
      )
    ]);
    res.json({ user: req.user, addresses: addrRes.rows, favourites: favRes.rows });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/me',
  validateBody(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      mobileNumber: z.string().trim().min(10).max(20),
      fullAddress: z.string().trim().min(4).max(400),
      profilePhotoUrl: z.string().trim().max(500).optional(),
      districtId: optionalUuid,
      subdivisionId: optionalUuid,
      areaType: z.enum(['urban', 'rural', '']).optional(),
      localBodyId: optionalUuid,
      gpWardId: optionalUuid,
      villageId: optionalUuid,
      villageLocality: z.string().trim().max(180).optional(),
      pincode: z.string().trim().max(16).optional(),
      latitude: optionalCoord,
      longitude: optionalCoord,
      locationConsent: z.boolean().optional(),
      pushNotificationsEnabled: z.boolean().optional(),
      emailNotificationsEnabled: z.boolean().optional()
    })
  ),
  async (req, res, next) => {
    try {
      const d = req.validated;
      const result = await query(
        `UPDATE users
         SET full_name = $1,
             mobile_number = $2,
             full_address = $3,
             profile_photo_url = COALESCE($4, profile_photo_url),
             district_id = COALESCE($5, district_id),
             subdivision_id = COALESCE($6, subdivision_id),
             area_type = COALESCE($7, area_type),
             local_body_id = COALESCE($8, local_body_id),
             gp_ward_id = COALESCE($9, gp_ward_id),
             village_id = COALESCE($10, village_id),
             village_locality = COALESCE($11, village_locality),
             pincode = COALESCE($12, pincode),
             latitude = COALESCE($13, latitude),
             longitude = COALESCE($14, longitude),
             location_consent = COALESCE($15, location_consent),
             push_notifications_enabled = COALESCE($16, push_notifications_enabled),
             email_notifications_enabled = COALESCE($17, email_notifications_enabled),
             updated_at = NOW()
         WHERE id = $18
         RETURNING ${USER_SELECT_FIELDS}`,
        [
          d.fullName,
          d.mobileNumber,
          d.fullAddress,
          d.profilePhotoUrl ?? null,
          d.districtId ?? null,
          d.subdivisionId ?? null,
          d.areaType ?? null,
          d.localBodyId ?? null,
          d.gpWardId ?? null,
          d.villageId ?? null,
          d.villageLocality ?? null,
          d.pincode ?? null,
          d.latitude ?? null,
          d.longitude ?? null,
          d.locationConsent ?? null,
          d.pushNotificationsEnabled ?? null,
          d.emailNotificationsEnabled ?? null,
          req.user.id
        ]
      );
      res.json({ user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/me/language',
  validateBody(
    z.object({
      languagePreference: z.enum(['bn', 'en']),
      bengaliNumerals: z.boolean().optional()
    })
  ),
  async (req, res, next) => {
    try {
      const { languagePreference, bengaliNumerals } = req.validated;
      const result = await query(
        `UPDATE users
         SET language_preference = $1,
             bengali_numerals = COALESCE($2, bengali_numerals),
             updated_at = NOW()
         WHERE id = $3
         RETURNING ${USER_SELECT_FIELDS}`,
        [languagePreference, bengaliNumerals ?? null, req.user.id]
      );
      res.json({ user: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/me/addresses',
  validateBody(
    z.object({
      label: z.string().trim().min(1).max(60),
      addressLine: z.string().trim().min(4).max(400),
      city: z.string().trim().min(2).max(80).default('Kolkata'),
      pincode: z.string().trim().max(16).default(''),
      districtId: optionalUuid,
      subdivisionId: optionalUuid,
      areaType: z.enum(['urban', 'rural', '']).optional().default(''),
      localBodyId: optionalUuid,
      gpWardId: optionalUuid,
      villageId: optionalUuid,
      villageLocality: z.string().trim().max(180).optional().default(''),
      latitude: optionalCoord,
      longitude: optionalCoord,
      isDefault: z.boolean().optional().default(false)
    })
  ),
  async (req, res, next) => {
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
      if (d.isDefault) {
        await query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
      }
      const result = await query(
        `INSERT INTO user_addresses (
           user_id, label, address_line, city, pincode,
           district_id, subdivision_id, area_type, local_body_id, gp_ward_id, village_id,
           village_locality, latitude, longitude, is_default
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          req.user.id,
          d.label,
          d.addressLine,
          loc.district?.name_en || d.city,
          d.pincode || loc.resolvedPincode || '',
          d.districtId,
          d.subdivisionId,
          d.areaType || loc.localBody?.area_type || '',
          d.localBodyId,
          d.gpWardId,
          d.villageId,
          d.villageLocality || loc.village?.name_en || '',
          d.latitude ?? loc.centroidLat,
          d.longitude ?? loc.centroidLng,
          Boolean(d.isDefault)
        ]
      );
      res.status(201).json({ address: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.delete('/me/addresses/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// Favourite Providers management
router.get('/me/favourites', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fp.id AS favourite_id, fp.created_at AS favourited_at,
              pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en, pp.photo_url,
              pp.service_categories, pp.subcategories, pp.skills,
              pp.public_area_label_bn, pp.public_area_label_en,
              pp.service_location_bn, pp.service_location_en,
              pp.experience_years, pp.starting_price_inr, pp.is_available,
              pp.id_verification_status, pp.rating_avg, pp.reviews_count, pp.completed_jobs
       FROM favourite_providers fp
       JOIN provider_profiles pp ON pp.user_id = fp.provider_user_id
       JOIN users u ON u.id = pp.user_id
       WHERE fp.customer_id = $1 AND pp.is_approved = TRUE AND pp.approval_status = 'approved'
       ORDER BY fp.created_at DESC`,
      [req.user.id]
    );
    res.json({ favourites: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/me/favourites/:providerUserId', async (req, res, next) => {
  try {
    const targetId = req.params.providerUserId;
    const exists = await query(
      `SELECT user_id FROM provider_profiles
       WHERE user_id = $1 AND is_approved = TRUE AND approval_status = 'approved'`,
      [targetId]
    );
    if (!exists.rows.length) {
      return res.status(404).json({ error: 'Approved provider not found.' });
    }
    await query(
      `INSERT INTO favourite_providers (customer_id, provider_user_id)
       VALUES ($1, $2) ON CONFLICT (customer_id, provider_user_id) DO NOTHING`,
      [req.user.id, targetId]
    );
    res.status(201).json({ favourited: true, providerUserId: targetId });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/favourites/:providerUserId', async (req, res, next) => {
  try {
    await query(
      'DELETE FROM favourite_providers WHERE customer_id = $1 AND provider_user_id = $2',
      [req.user.id, req.params.providerUserId]
    );
    res.json({ favourited: false, providerUserId: req.params.providerUserId });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/me/fcm-token',
  validateBody(
    z.object({
      fcmToken: z.string().trim().min(20).max(512),
      platform: z.enum(['android', 'web']).default('android')
    })
  ),
  async (req, res, next) => {
    try {
      const { fcmToken, platform } = req.validated;
      await query(
        `INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (fcm_token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
        [req.user.id, fcmToken, platform]
      );
      res.json({ registered: true });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/notifications', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
