import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

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
      conditions.push(`(title_bn ILIKE $${idx} OR title_en ILIKE $${idx} OR description_bn ILIKE $${idx} OR description_en ILIKE $${idx})`);
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

// Public approved workers directory
router.get('/providers', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    const params = [];
    const conditions = ['pp.is_approved = TRUE'];

    if (category && typeof category === 'string') {
      params.push(category);
      conditions.push(`$${params.length} = ANY(pp.service_categories)`);
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(`(u.full_name ILIKE $${idx} OR pp.service_location_bn ILIKE $${idx} OR pp.service_location_en ILIKE $${idx})`);
    }

    const result = await query(
      `SELECT pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en, pp.photo_url,
              pp.service_categories, pp.service_location_bn, pp.service_location_en,
              pp.experience_years, pp.is_available, pp.rating_avg, pp.reviews_count, pp.completed_jobs
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pp.rating_avg DESC, pp.completed_jobs DESC`,
      params
    );
    res.json({ providers: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/providers/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pp.id, pp.user_id, u.full_name, pp.bio_bn, pp.bio_en, pp.photo_url,
              pp.service_categories, pp.service_location_bn, pp.service_location_en,
              pp.experience_years, pp.is_available, pp.is_approved, pp.rating_avg, pp.reviews_count, pp.completed_jobs
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE (pp.id::text = $1 OR pp.user_id::text = $1) AND pp.is_approved = TRUE`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Worker profile not found' });

    const provider = result.rows[0];
    const reviewsRes = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.provider_id = $1 AND r.is_visible = TRUE
       ORDER BY r.created_at DESC LIMIT 20`,
      [provider.user_id]
    );
    res.json({ provider, reviews: reviewsRes.rows });
  } catch (err) {
    next(err);
  }
});

// Authenticated provider self profile & registration
router.get('/provider/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM provider_profiles WHERE user_id = $1', [req.user.id]);
    const reviewsRes = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name AS customer_name
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.provider_id = $1 AND r.is_visible = TRUE
       ORDER BY r.created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ profile: result.rows[0] || null, reviews: reviewsRes.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/provider/apply', requireAuth, validateBody(z.object({
  bioBn: z.string().trim().max(800).default(''),
  bioEn: z.string().trim().max(800).default(''),
  photoUrl: z.string().trim().max(500).default(''),
  serviceCategories: z.array(z.string().trim()).min(1),
  serviceLocationBn: z.string().trim().min(2).max(140),
  serviceLocationEn: z.string().trim().min(2).max(140),
  experienceYears: z.number().int().min(0).max(60).default(1),
  isAvailable: z.boolean().default(true)
})), async (req, res, next) => {
  try {
    const d = req.validated;
    if (req.user.role === 'customer') {
      await query("UPDATE users SET role = 'provider', updated_at = NOW() WHERE id = $1", [req.user.id]);
    }
    const result = await query(
      `INSERT INTO provider_profiles (
         user_id, bio_bn, bio_en, photo_url, service_categories,
         service_location_bn, service_location_en, experience_years, is_available,
         is_approved, approval_status
       ) VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, FALSE, 'pending')
       ON CONFLICT (user_id) DO UPDATE SET
         bio_bn = $2, bio_en = $3, photo_url = $4, service_categories = $5::text[],
         service_location_bn = $6, service_location_en = $7, experience_years = $8,
         is_available = $9, updated_at = NOW()
       RETURNING *`,
      [req.user.id, d.bioBn, d.bioEn, d.photoUrl, d.serviceCategories, d.serviceLocationBn, d.serviceLocationEn, d.experienceYears, d.isAvailable]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/provider/me/availability', requireAuth, requireRole('provider', 'admin'), validateBody(z.object({
  isAvailable: z.boolean()
})), async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE provider_profiles SET is_available = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
      [req.validated.isAvailable, req.user.id]
    );
    res.json({ profile: result.rows[0] });
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
