import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recordAuditLog } from '../utils/audit.js';
import { createUserNotification } from '../utils/notifications.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', async (_req, res, next) => {
  try {
    const [users, providersPending, bookings, pendingBookings, categories, services, reviews, openComplaints] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM users'),
      query("SELECT COUNT(*)::int AS count FROM provider_profiles WHERE approval_status = 'pending'"),
      query('SELECT COUNT(*)::int AS count FROM bookings'),
      query("SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'pending'"),
      query('SELECT COUNT(*)::int AS count FROM service_categories'),
      query('SELECT COUNT(*)::int AS count FROM services WHERE is_active = TRUE'),
      query('SELECT COUNT(*)::int AS count FROM reviews'),
      query("SELECT COUNT(*)::int AS count FROM complaints WHERE status != 'resolved'")
    ]);
    res.json({
      stats: {
        totalUsers: users.rows[0].count,
        pendingProviders: providersPending.rows[0].count,
        totalBookings: bookings.rows[0].count,
        pendingBookings: pendingBookings.rows[0].count,
        totalCategories: categories.rows[0].count,
        totalServices: services.rows[0].count,
        totalReviews: reviews.rows[0].count,
        openComplaints: openComplaints.rows[0].count
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/health', async (_req, res, next) => {
  try {
    const dbRes = await query('SELECT NOW() AS server_time, current_database() AS db_name');
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      database: 'connected',
      dbName: dbRes.rows[0]?.db_name || 'postgres',
      dbTime: dbRes.rows[0]?.server_time,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryRssMb: Math.round(mem.rss / 1024 / 1024)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT id, full_name, email, mobile_number, full_address, role, is_verified,
              language_preference, created_at
       FROM users ORDER BY created_at DESC LIMIT 250`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', validateBody(z.object({
  role: z.enum(['customer', 'provider', 'admin']).optional(),
  isVerified: z.boolean().optional()
})), async (req, res, next) => {
  try {
    const { role, isVerified } = req.validated;
    if (req.params.id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot remove admin role from your own active account.' });
    }
    const result = await query(
      `UPDATE users
       SET role = COALESCE($1, role),
           is_verified = COALESCE($2, is_verified),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, email, mobile_number, full_address, role, is_verified, language_preference, created_at`,
      [role ?? null, isVerified ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'USER_UPDATED_BY_ADMIN',
      targetType: 'user',
      targetId: req.params.id,
      ipAddress: req.ip,
      details: { role, isVerified }
    });
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/providers', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT pp.*, u.full_name, u.email, u.mobile_number
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       ORDER BY pp.created_at DESC`
    );
    res.json({ providers: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/providers/:id/approve', validateBody(z.object({
  decision: z.enum(['approved', 'rejected'])
})), async (req, res, next) => {
  try {
    const { decision } = req.validated;
    const isApproved = decision === 'approved';
    const result = await query(
      `UPDATE provider_profiles
       SET is_approved = $1, approval_status = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [isApproved, decision, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Provider profile not found' });
    const prof = result.rows[0];

    await createUserNotification({
      userId: prof.user_id,
      titleBn: isApproved ? 'প্রোভাইডার অ্যাকাউন্ট অনুমোদিত হয়েছে' : 'প্রোভাইডার আবেদন প্রত্যাখ্যাত হয়েছে',
      titleEn: isApproved ? 'Worker Account Approved' : 'Worker Application Declined',
      bodyBn: isApproved ? 'আপনি এখন থেকে পাবলিক বুকিং গ্রহণ করতে পারবেন।' : 'বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।',
      bodyEn: isApproved ? 'You can now accept public service bookings on Kajer Manus.' : 'Please contact support for details.',
      type: 'provider_approval'
    });

    await recordAuditLog({
      actorUserId: req.user.id,
      action: `PROVIDER_${decision.toUpperCase()}`,
      targetType: 'provider_profile',
      targetId: prof.id,
      ipAddress: req.ip
    });

    res.json({ provider: prof });
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM service_categories ORDER BY sort_order ASC');
    res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', validateBody(z.object({
  slug: z.string().trim().min(2).max(60),
  nameBn: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  descriptionBn: z.string().trim().default(''),
  descriptionEn: z.string().trim().default(''),
  iconKey: z.string().trim().default('wrench'),
  sortOrder: z.number().int().default(20),
  isActive: z.boolean().default(true)
})), async (req, res, next) => {
  try {
    const d = req.validated;
    const result = await query(
      `INSERT INTO service_categories (slug, name_bn, name_en, description_bn, description_en, icon_key, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (slug) DO UPDATE SET
         name_bn = $2, name_en = $3, description_bn = $4, description_en = $5, icon_key = $6, sort_order = $7, is_active = $8, updated_at = NOW()
       RETURNING *`,
      [d.slug, d.nameBn, d.nameEn, d.descriptionBn, d.descriptionEn, d.iconKey, d.sortOrder, d.isActive]
    );
    await recordAuditLog({ actorUserId: req.user.id, action: 'CATEGORY_UPSERT', targetType: 'category', targetId: d.slug, ipAddress: req.ip });
    res.json({ category: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/services', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM services ORDER BY created_at DESC LIMIT 250');
    res.json({ services: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/services', validateBody(z.object({
  id: z.string().uuid().optional(),
  categorySlug: z.string().trim().min(2),
  titleBn: z.string().trim().min(2).max(180),
  titleEn: z.string().trim().min(2).max(180),
  descriptionBn: z.string().trim().min(2),
  descriptionEn: z.string().trim().min(2),
  providerNameBn: z.string().trim().default('কাজের মানুষ কর্মী'),
  providerNameEn: z.string().trim().default('Kajer Manus Pro'),
  areaBn: z.string().trim().default('কলকাতা'),
  areaEn: z.string().trim().default('Kolkata'),
  basePriceInr: z.number().int().min(0),
  durationMinutes: z.number().int().min(15).default(60),
  isActive: z.boolean().default(true)
})), async (req, res, next) => {
  try {
    const d = req.validated;
    let result;
    if (d.id) {
      result = await query(
        `UPDATE services SET category_slug=$1, title_bn=$2, title_en=$3, description_bn=$4, description_en=$5,
           provider_name_bn=$6, provider_name_en=$7, area_bn=$8, area_en=$9, base_price_inr=$10,
           duration_minutes=$11, is_active=$12, updated_at=NOW()
         WHERE id=$13 RETURNING *`,
        [d.categorySlug, d.titleBn, d.titleEn, d.descriptionBn, d.descriptionEn, d.providerNameBn, d.providerNameEn, d.areaBn, d.areaEn, d.basePriceInr, d.durationMinutes, d.isActive, d.id]
      );
    } else {
      result = await query(
        `INSERT INTO services (category_slug, title_bn, title_en, description_bn, description_en, provider_name_bn, provider_name_en, area_bn, area_en, base_price_inr, duration_minutes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [d.categorySlug, d.titleBn, d.titleEn, d.descriptionBn, d.descriptionEn, d.providerNameBn, d.providerNameEn, d.areaBn, d.areaEn, d.basePriceInr, d.durationMinutes, d.isActive]
      );
    }
    await recordAuditLog({ actorUserId: req.user.id, action: d.id ? 'SERVICE_UPDATED' : 'SERVICE_CREATED', targetType: 'service', targetId: result.rows[0]?.id || '', ipAddress: req.ip });
    res.json({ service: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/bookings', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 250');
    res.json({ bookings: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM complaints ORDER BY created_at DESC LIMIT 200');
    res.json({ complaints: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/complaints/:id', validateBody(z.object({
  status: z.enum(['open', 'in_review', 'resolved']),
  adminNote: z.string().trim().max(500).default('')
})), async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE complaints SET status = $1, admin_note = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [req.validated.status, req.validated.adminNote, req.params.id]
    );
    await recordAuditLog({ actorUserId: req.user.id, action: 'COMPLAINT_UPDATED', targetType: 'complaint', targetId: req.params.id, ipAddress: req.ip });
    res.json({ complaint: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/reviews', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT r.*, u.full_name AS customer_name
       FROM reviews r JOIN users u ON u.id = r.customer_id
       ORDER BY r.created_at DESC LIMIT 200`
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/reviews/:id/visibility', validateBody(z.object({
  isVisible: z.boolean()
})), async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE reviews SET is_visible = $1 WHERE id = $2 RETURNING *',
      [req.validated.isVisible, req.params.id]
    );
    await recordAuditLog({ actorUserId: req.user.id, action: 'REVIEW_VISIBILITY_CHANGED', targetType: 'review', targetId: req.params.id, ipAddress: req.ip });
    res.json({ review: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/content', validateBody(z.object({
  key: z.string().trim().min(2).max(80),
  valueBn: z.string().trim().min(1),
  valueEn: z.string().trim().min(1)
})), async (req, res, next) => {
  try {
    const { key, valueBn, valueEn } = req.validated;
    const result = await query(
      `INSERT INTO site_content (key, value_bn, value_en, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value_bn = $2, value_en = $3, updated_at = NOW()
       RETURNING *`,
      [key, valueBn, valueEn]
    );
    await recordAuditLog({ actorUserId: req.user.id, action: 'CMS_CONTENT_UPDATED', targetType: 'site_content', targetId: key, ipAddress: req.ip });
    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT n.id, n.title_bn, n.title_en, n.body_bn, n.body_en, n.type, n.is_read, n.created_at,
              u.email AS user_email
       FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       ORDER BY n.created_at DESC LIMIT 80`
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/broadcast', validateBody(z.object({
  titleBn: z.string().trim().min(2).max(180),
  titleEn: z.string().trim().min(2).max(180),
  bodyBn: z.string().trim().min(2).max(500),
  bodyEn: z.string().trim().min(2).max(500)
})), async (req, res, next) => {
  try {
    const { titleBn, titleEn, bodyBn, bodyEn } = req.validated;
    const users = await query('SELECT id, language_preference FROM users WHERE is_verified = TRUE');
    for (const u of users.rows) {
      await createUserNotification({
        userId: u.id,
        titleBn,
        titleEn,
        bodyBn,
        bodyEn,
        type: 'announcement',
        languageCode: u.language_preference || 'bn'
      });
    }
    await recordAuditLog({ actorUserId: req.user.id, action: 'ADMIN_BROADCAST_SENT', targetType: 'notification', ipAddress: req.ip, details: { count: users.rows.length } });
    res.json({ sentTo: users.rows.length });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT al.*, u.email AS actor_email
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
