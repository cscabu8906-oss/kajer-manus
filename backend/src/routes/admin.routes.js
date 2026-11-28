import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { recordAuditLog } from '../utils/audit.js';
import { createUserNotification } from '../utils/notifications.js';
import {
  buildOtpAuthUrl,
  consumeBackupCode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateBase32Secret,
  verifyTotpCode
} from '../utils/totp.js';
import { generateQrCodeDataUrl } from '../utils/qrSvg.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function extractMobileLast10(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

router.get('/stats', async (_req, res, next) => {
  try {
    const [
      users,
      providersPending,
      bookings,
      pendingBookings,
      categories,
      services,
      reviews,
      openComplaints,
      paymentSummary
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM users'),
      query("SELECT COUNT(*)::int AS count FROM provider_profiles WHERE approval_status = 'pending'"),
      query('SELECT COUNT(*)::int AS count FROM bookings'),
      query("SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'pending'"),
      query('SELECT COUNT(*)::int AS count FROM service_categories'),
      query('SELECT COUNT(*)::int AS count FROM services WHERE is_active = TRUE'),
      query('SELECT COUNT(*)::int AS count FROM reviews'),
      query("SELECT COUNT(*)::int AS count FROM complaints WHERE status != 'resolved'"),
      query(
        `SELECT COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_bookings,
                COALESCE(SUM(amount_inr) FILTER (WHERE payment_status = 'paid'), 0)::int AS paid_revenue_inr
         FROM bookings`
      )
    ]);
    res.json({
      stats: {
        totalUsers: users.rows[0].count,
        pendingProviders: providersPending.rows[0].count,
        totalBookings: bookings.rows[0].count,
        pendingBookings: pendingBookings.rows[0].count,
        paidBookings: paymentSummary.rows[0]?.paid_bookings ?? 0,
        paidRevenueInr: paymentSummary.rows[0]?.paid_revenue_inr ?? 0,
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

router.get('/2fa/status', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT two_factor_enabled, two_factor_backup_codes FROM users WHERE id = $1',
      [req.user.id]
    );
    const row = result.rows[0];
    const codes = Array.isArray(row?.two_factor_backup_codes) ? row.two_factor_backup_codes : [];
    res.json({
      enabled: Boolean(row?.two_factor_enabled),
      backupCodesRemaining: codes.length
    });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/setup', async (req, res, next) => {
  try {
    const secretBase32 = generateBase32Secret(20);
    const encryptedTemp = encryptTotpSecret(secretBase32);
    await query(
      'UPDATE users SET two_factor_temp_secret = $1, updated_at = NOW() WHERE id = $2',
      [encryptedTemp, req.user.id]
    );
    const otpauthUrl = buildOtpAuthUrl({
      issuer: 'Kajer Manus Admin',
      accountEmail: req.user.email,
      secretBase32
    });
    const qrDataUrl = generateQrCodeDataUrl(otpauthUrl);

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'ADMIN_2FA_SETUP_STARTED',
      targetType: 'user',
      targetId: req.user.id,
      ipAddress: req.ip
    });

    res.json({
      secretBase32,
      otpauthUrl,
      qrDataUrl
    });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/confirm', validateBody(z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.')
})), async (req, res, next) => {
  try {
    const userRes = await query(
      'SELECT two_factor_temp_secret FROM users WHERE id = $1',
      [req.user.id]
    );
    const encryptedTemp = userRes.rows[0]?.two_factor_temp_secret || '';
    const tempSecret = decryptTotpSecret(encryptedTemp);
    if (!tempSecret) {
      return res.status(400).json({ error: '2FA setup session not found. Start setup again.' });
    }
    if (!verifyTotpCode(tempSecret, req.validated.code)) {
      return res.status(400).json({ error: 'Invalid 6-digit authenticator code.' });
    }

    const { plainCodes, hashedCodes } = generateBackupCodes(8);
    await query(
      `UPDATE users
       SET two_factor_enabled = TRUE,
           two_factor_secret = $1,
           two_factor_temp_secret = '',
           two_factor_backup_codes = $2::jsonb,
           updated_at = NOW()
       WHERE id = $3`,
      [encryptTotpSecret(tempSecret), JSON.stringify(hashedCodes), req.user.id]
    );

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'ADMIN_2FA_ENABLED',
      targetType: 'user',
      targetId: req.user.id,
      ipAddress: req.ip
    });

    res.json({
      enabled: true,
      backupCodes: plainCodes
    });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/disable', validateBody(z.object({
  password: z.string().min(1),
  code: z.string().trim().min(6).max(20)
})), async (req, res, next) => {
  try {
    const { password, code } = req.validated;
    const userRes = await query(
      'SELECT password_hash, two_factor_enabled, two_factor_secret, two_factor_backup_codes FROM users WHERE id = $1',
      [req.user.id]
    );
    const row = userRes.rows[0];
    if (!row?.two_factor_enabled) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled.' });
    }

    const passValid = await bcrypt.compare(password, row.password_hash);
    if (!passValid) {
      return res.status(401).json({ error: 'Incorrect account password.' });
    }

    const secret = decryptTotpSecret(row.two_factor_secret);
    const totpValid = verifyTotpCode(secret, code);
    const backupRes = totpValid ? { matched: true } : consumeBackupCode(row.two_factor_backup_codes, code);
    if (!backupRes.matched) {
      return res.status(400).json({ error: 'Invalid authenticator or backup code.' });
    }

    await query(
      `UPDATE users
       SET two_factor_enabled = FALSE,
           two_factor_secret = '',
           two_factor_temp_secret = '',
           two_factor_backup_codes = '[]'::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [req.user.id]
    );

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'ADMIN_2FA_DISABLED',
      targetType: 'user',
      targetId: req.user.id,
      ipAddress: req.ip
    });

    res.json({ enabled: false });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.mobile_number, u.mobile_verified, u.profile_photo_url,
              u.full_address, u.pincode, u.role, u.is_verified, u.two_factor_enabled,
              u.language_preference, u.district_id, u.local_body_id, u.created_at,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn
       FROM users u
       LEFT JOIN wb_districts d ON d.id = u.district_id
       LEFT JOIN wb_local_bodies lb ON lb.id = u.local_body_id
       ORDER BY u.created_at DESC LIMIT 300`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id', validateBody(z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(180).optional(),
  mobileNumber: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine((val) => val.replace(/\D/g, '').length >= 10, {
      message: 'Mobile number must contain at least 10 digits.'
    })
    .optional(),
  fullAddress: z.string().trim().min(4).max(400).optional(),
  role: z.enum(['customer', 'provider', 'admin']).optional(),
  isVerified: z.boolean().optional(),
  newPassword: z.string().min(8).max(128).optional()
})), async (req, res, next) => {
  try {
    const { fullName, email, mobileNumber, fullAddress, role, isVerified, newPassword } = req.validated;
    if (req.params.id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot remove admin role from your own active account.' });
    }
    const normalizedEmail = email ? email.toLowerCase() : null;
    const mobileLast10 = mobileNumber ? extractMobileLast10(mobileNumber) : '';
    const passwordHash = newPassword ? await bcrypt.hash(newPassword, 12) : null;

    const updatedUser = await withTransaction(async (client) => {
      if (normalizedEmail || mobileLast10) {
        const conflict = await client.query(
          `SELECT id FROM users
           WHERE id <> $1
             AND (
               ($2::text IS NOT NULL AND LOWER(email) = $2)
               OR ($3 <> '' AND right(regexp_replace(mobile_number, '\\D', '', 'g'), 10) = $3)
             )
           LIMIT 1`,
          [req.params.id, normalizedEmail, mobileLast10]
        );
        if (conflict.rows.length) {
          const err = new Error('Another account already uses this email or mobile number.');
          err.status = 409;
          throw err;
        }
      }

      const result = await client.query(
        `UPDATE users
         SET full_name = COALESCE($1, full_name),
             email = COALESCE($2, email),
             mobile_number = COALESCE($3, mobile_number),
             full_address = COALESCE($4, full_address),
             role = COALESCE($5, role),
             is_verified = COALESCE($6, is_verified),
             password_hash = COALESCE($7, password_hash),
             updated_at = NOW()
         WHERE id = $8
         RETURNING id, full_name, email, mobile_number, full_address, role, is_verified, two_factor_enabled, language_preference, created_at`,
        [
          fullName ?? null,
          normalizedEmail,
          mobileNumber ?? null,
          fullAddress ?? null,
          role ?? null,
          isVerified ?? null,
          passwordHash,
          req.params.id
        ]
      );
      if (!result.rows.length) return null;

      if (role === 'provider') {
        const u = result.rows[0];
        await client.query(
          `INSERT INTO provider_profiles (user_id, service_location_bn, service_location_en)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [u.id, (u.full_address || 'Kolkata').slice(0, 120), (u.full_address || 'Kolkata').slice(0, 120)]
        );
      }
      return result.rows[0];
    });

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'USER_UPDATED_BY_ADMIN',
      targetType: 'user',
      targetId: req.params.id,
      ipAddress: req.ip,
      details: {
        role,
        isVerified,
        updatedFields: [
          fullName ? 'fullName' : null,
          normalizedEmail ? 'email' : null,
          mobileNumber ? 'mobileNumber' : null,
          fullAddress ? 'fullAddress' : null,
          newPassword ? 'password' : null
        ].filter(Boolean)
      }
    });
    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
    }

    const deleted = await withTransaction(async (client) => {
      const targetRes = await client.query('SELECT id, email, role FROM users WHERE id = $1', [targetId]);
      if (!targetRes.rows.length) return null;
      const target = targetRes.rows[0];

      if (target.role === 'admin') {
        const adminCountRes = await client.query("SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'");
        if ((adminCountRes.rows[0]?.cnt ?? 0) <= 1) {
          const err = new Error('Cannot delete the only remaining administrator account.');
          err.status = 400;
          throw err;
        }
      }

      await client.query('DELETE FROM users WHERE id = $1', [targetId]);
      return target;
    });

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'USER_DELETED_BY_ADMIN',
      targetType: 'user',
      targetId,
      ipAddress: req.ip,
      details: { deletedEmail: deleted.email, deletedRole: deleted.role }
    });

    res.json({ deleted: true, id: targetId });
  } catch (err) {
    next(err);
  }
});

router.get('/providers', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT pp.*, u.full_name, u.email, u.mobile_number, u.mobile_verified,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              s.name_en AS subdivision_name_en, s.name_bn AS subdivision_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn,
              gw.name_en AS gp_ward_name_en, gw.name_bn AS gp_ward_name_bn,
              (SELECT COUNT(*)::int FROM provider_service_areas psa WHERE psa.provider_user_id = pp.user_id) AS service_areas_count
       FROM provider_profiles pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN wb_districts d ON d.id = pp.district_id
       LEFT JOIN wb_subdivisions s ON s.id = pp.subdivision_id
       LEFT JOIN wb_local_bodies lb ON lb.id = pp.local_body_id
       LEFT JOIN wb_gp_wards gw ON gw.id = pp.gp_ward_id
       ORDER BY pp.created_at DESC`
    );
    res.json({ providers: result.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/providers/:id/approve', validateBody(z.object({
  decision: z.enum(['approved', 'rejected', 'suspended'])
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

    const notifCopy =
      decision === 'approved'
        ? {
            titleBn: 'প্রোভাইডার অ্যাকাউন্ট অনুমোদিত হয়েছে',
            titleEn: 'Worker Account Approved',
            bodyBn: 'আপনি এখন থেকে পাবলিক বুকিং গ্রহণ করতে পারবেন।',
            bodyEn: 'You can now accept public service bookings on Kajer Manus.'
          }
        : decision === 'suspended'
          ? {
              titleBn: 'প্রোভাইডার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করা হয়েছে',
              titleEn: 'Worker Account Suspended',
              bodyBn: 'অ্যাডমিন নীতিমালার কারণে আপনার প্রোফাইল স্থগিত করা হয়েছে। সাপোর্টে যোগাযোগ করুন।',
              bodyEn: 'Your provider profile has been suspended by an administrator. Please contact support.'
            }
          : {
              titleBn: 'প্রোভাইডার আবেদন প্রত্যাখ্যাত হয়েছে',
              titleEn: 'Worker Application Declined',
              bodyBn: 'বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।',
              bodyEn: 'Please contact support for details.'
            };

    await createUserNotification({
      userId: prof.user_id,
      ...notifCopy,
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

router.patch('/providers/:id/verify-docs', validateBody(z.object({
  status: z.enum(['pending', 'verified', 'rejected']),
  note: z.string().trim().max(400).optional().default('')
})), async (req, res, next) => {
  try {
    const { status, note } = req.validated;
    const result = await query(
      `UPDATE provider_profiles
       SET id_verification_status = $1,
           id_verification_note = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, note, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Provider profile not found' });
    const prof = result.rows[0];

    await createUserNotification({
      userId: prof.user_id,
      titleBn: status === 'verified' ? 'পরিচয়পত্র যাচাই সম্পন্ন হয়েছে' : 'পরিচয়পত্র যাচাইকরণ আপডেট',
      titleEn: status === 'verified' ? 'Identity Documents Verified' : 'Identity Verification Update',
      bodyBn:
        status === 'verified'
          ? 'আপনার পরিচয়পত্র যাচাই হয়েছে এবং প্রোফাইলে ভেরিফাইড ব্যাজ যুক্ত হয়েছে।'
          : note || 'অনুগ্রহ করে সঠিক পরিচয়পত্র পুনরায় জমা দিন।',
      bodyEn:
        status === 'verified'
          ? 'Your identity documents are verified and a Verified badge is active on your profile.'
          : note || 'Please review and re-upload valid identity documents.',
      type: 'provider_kyc'
    });

    await recordAuditLog({
      actorUserId: req.user.id,
      action: `PROVIDER_KYC_${status.toUpperCase()}`,
      targetType: 'provider_profile',
      targetId: prof.id,
      ipAddress: req.ip,
      details: { note }
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
  subcategories: z.array(z.union([
    z.string().trim(),
    z.object({ slug: z.string().trim(), name_bn: z.string().trim(), name_en: z.string().trim() })
  ])).optional().default([]),
  iconKey: z.string().trim().default('wrench'),
  sortOrder: z.number().int().default(20),
  isActive: z.boolean().default(true)
})), async (req, res, next) => {
  try {
    const d = req.validated;
    const normalizedSubs = (d.subcategories || []).map((s) =>
      typeof s === 'string'
        ? { slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name_bn: s, name_en: s }
        : s
    );
    const result = await query(
      `INSERT INTO service_categories (slug, name_bn, name_en, description_bn, description_en, subcategories, icon_key, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET
         name_bn = $2, name_en = $3, description_bn = $4, description_en = $5,
         subcategories = $6::jsonb, icon_key = $7, sort_order = $8, is_active = $9, updated_at = NOW()
       RETURNING *`,
      [d.slug, d.nameBn, d.nameEn, d.descriptionBn, d.descriptionEn, JSON.stringify(normalizedSubs), d.iconKey, d.sortOrder, d.isActive]
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

router.patch('/bookings/:id/payment', validateBody(z.object({
  paymentStatus: z.enum(['unpaid', 'pending', 'paid', 'failed', 'refunded']),
  paymentMethod: z.enum(['cash', 'razorpay']).optional()
})), async (req, res, next) => {
  try {
    const { paymentStatus, paymentMethod } = req.validated;
    const result = await query(
      `UPDATE bookings
       SET payment_status = $1,
           payment_method = COALESCE($2, payment_method),
           paid_at = CASE WHEN $1 = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [paymentStatus, paymentMethod ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = result.rows[0];

    if (paymentStatus === 'paid' || paymentStatus === 'refunded') {
      const isPaid = paymentStatus === 'paid';
      await createUserNotification({
        userId: booking.customer_id,
        titleBn: isPaid ? `পেমেন্ট সম্পন্ন: ${booking.service_title_bn}` : `রিফান্ড প্রক্রিয়া সম্পন্ন: ${booking.service_title_bn}`,
        titleEn: isPaid ? `Payment Confirmed: ${booking.service_title_en}` : `Refund Processed: ${booking.service_title_en}`,
        bodyBn: isPaid ? `আপনার ₹${booking.amount_inr} পেমেন্ট নিশ্চিত হয়েছে।` : `আপনার ₹${booking.amount_inr} রিফান্ড করা হয়েছে।`,
        bodyEn: isPaid ? `Your payment of ₹${booking.amount_inr} has been marked paid.` : `Your refund of ₹${booking.amount_inr} has been processed.`,
        bookingId: booking.id,
        type: 'payment_status',
        languageCode: booking.language_at_booking || 'bn'
      });
    }

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'BOOKING_PAYMENT_UPDATED_BY_ADMIN',
      targetType: 'booking',
      targetId: booking.id,
      ipAddress: req.ip,
      details: { paymentStatus, paymentMethod: paymentMethod || booking.payment_method }
    });

    res.json({ booking });
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

// WEST BENGAL LOCATION MASTER MANAGEMENT & LOCATION-WISE BOOKING STATS
router.get('/locations/summary', async (_req, res, next) => {
  try {
    const [d, s, b, u, g, w, v, p] = await Promise.all([
      query('SELECT COUNT(*)::int AS c FROM wb_districts'),
      query('SELECT COUNT(*)::int AS c FROM wb_subdivisions'),
      query("SELECT COUNT(*)::int AS c FROM wb_local_bodies WHERE body_type = 'block'"),
      query("SELECT COUNT(*)::int AS c FROM wb_local_bodies WHERE area_type = 'urban'"),
      query("SELECT COUNT(*)::int AS c FROM wb_gp_wards WHERE unit_type = 'gp'"),
      query("SELECT COUNT(*)::int AS c FROM wb_gp_wards WHERE unit_type = 'ward'"),
      query('SELECT COUNT(*)::int AS c FROM wb_villages'),
      query('SELECT COUNT(*)::int AS c FROM wb_pincodes')
    ]);
    res.json({
      summary: {
        districts: d.rows[0].c,
        subdivisions: s.rows[0].c,
        blocks: b.rows[0].c,
        urbanBodies: u.rows[0].c,
        gramPanchayats: g.rows[0].c,
        wards: w.rows[0].c,
        villages: v.rows[0].c,
        pincodes: p.rows[0].c
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/locations/stats', async (_req, res, next) => {
  try {
    const [byDistrict, byLocalBody] = await Promise.all([
      query(
        `SELECT d.id, d.name_en, d.name_bn,
                COUNT(DISTINCT b.id)::int AS total_bookings,
                COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed')::int AS completed_bookings,
                COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'pending')::int AS pending_bookings,
                COALESCE(SUM(b.amount_inr) FILTER (WHERE b.status = 'completed' OR b.payment_status = 'paid'), 0)::int AS revenue_inr,
                COUNT(DISTINCT pp.id) FILTER (WHERE pp.is_approved = TRUE AND pp.approval_status = 'approved')::int AS active_providers,
                COUNT(DISTINCT u.id)::int AS registered_users
         FROM wb_districts d
         LEFT JOIN bookings b ON b.district_id = d.id
         LEFT JOIN provider_profiles pp ON pp.district_id = d.id
         LEFT JOIN users u ON u.district_id = d.id
         GROUP BY d.id, d.name_en, d.name_bn
         ORDER BY total_bookings DESC, active_providers DESC, d.name_en ASC`
      ),
      query(
        `SELECT lb.id, lb.name_en, lb.name_bn, lb.area_type, lb.body_type, d.name_en AS district_name_en,
                COUNT(DISTINCT b.id)::int AS total_bookings,
                COUNT(DISTINCT pp.id) FILTER (WHERE pp.is_approved = TRUE)::int AS active_providers
         FROM wb_local_bodies lb
         JOIN wb_districts d ON d.id = lb.district_id
         LEFT JOIN bookings b ON b.local_body_id = lb.id
         LEFT JOIN provider_profiles pp ON pp.local_body_id = lb.id
         GROUP BY lb.id, lb.name_en, lb.name_bn, lb.area_type, lb.body_type, d.name_en
         HAVING COUNT(DISTINCT b.id) > 0 OR COUNT(DISTINCT pp.id) > 0
         ORDER BY total_bookings DESC, active_providers DESC
         LIMIT 50`
      )
    ]);
    res.json({ byDistrict: byDistrict.rows, byLocalBody: byLocalBody.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/locations/list', async (req, res, next) => {
  try {
    const { tier = 'districts', districtId, subdivisionId, localBodyId, gpWardId, q } = req.query;
    const like = q && typeof q === 'string' && q.trim() ? `%${q.trim()}%` : null;

    if (tier === 'districts') {
      const r = await query(
        `SELECT * FROM wb_districts ${like ? 'WHERE name_en ILIKE $1 OR name_bn ILIKE $1' : ''} ORDER BY name_en ASC`,
        like ? [like] : []
      );
      return res.json({ items: r.rows });
    }
    if (tier === 'subdivisions') {
      const r = await query(
        `SELECT s.*, d.name_en AS parent_name FROM wb_subdivisions s JOIN wb_districts d ON d.id = s.district_id
         WHERE ($1::uuid IS NULL OR s.district_id = $1) AND ($2::text IS NULL OR s.name_en ILIKE $2 OR s.name_bn ILIKE $2)
         ORDER BY s.name_en ASC LIMIT 200`,
        [districtId || null, like]
      );
      return res.json({ items: r.rows });
    }
    if (tier === 'local_bodies') {
      const r = await query(
        `SELECT lb.*, d.name_en AS parent_name FROM wb_local_bodies lb JOIN wb_districts d ON d.id = lb.district_id
         WHERE ($1::uuid IS NULL OR lb.district_id = $1)
           AND ($2::uuid IS NULL OR lb.subdivision_id = $2)
           AND ($3::text IS NULL OR lb.name_en ILIKE $3 OR lb.name_bn ILIKE $3)
         ORDER BY lb.name_en ASC LIMIT 300`,
        [districtId || null, subdivisionId || null, like]
      );
      return res.json({ items: r.rows });
    }
    if (tier === 'gp_wards') {
      const r = await query(
        `SELECT gw.*, lb.name_en AS parent_name FROM wb_gp_wards gw JOIN wb_local_bodies lb ON lb.id = gw.local_body_id
         WHERE ($1::uuid IS NULL OR gw.local_body_id = $1)
           AND ($2::uuid IS NULL OR gw.district_id = $2)
           AND ($3::text IS NULL OR gw.name_en ILIKE $3 OR gw.name_bn ILIKE $3)
         ORDER BY gw.name_en ASC LIMIT 300`,
        [localBodyId || null, districtId || null, like]
      );
      return res.json({ items: r.rows });
    }
    if (tier === 'villages') {
      const r = await query(
        `SELECT v.*, lb.name_en AS parent_name FROM wb_villages v JOIN wb_local_bodies lb ON lb.id = v.local_body_id
         WHERE ($1::uuid IS NULL OR v.gp_ward_id = $1)
           AND ($2::uuid IS NULL OR v.local_body_id = $2)
           AND ($3::uuid IS NULL OR v.district_id = $3)
           AND ($4::text IS NULL OR v.name_en ILIKE $4 OR v.name_bn ILIKE $4 OR v.pincode ILIKE $4)
         ORDER BY v.name_en ASC LIMIT 300`,
        [gpWardId || null, localBodyId || null, districtId || null, like]
      );
      return res.json({ items: r.rows });
    }
    res.status(400).json({ error: 'Unsupported location tier.' });
  } catch (err) {
    next(err);
  }
});

router.post('/locations/:tier', validateBody(z.object({
  code: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(160),
  nameBn: z.string().trim().min(1).max(160),
  districtId: z.string().uuid().optional().nullable(),
  subdivisionId: z.string().uuid().optional().nullable(),
  localBodyId: z.string().uuid().optional().nullable(),
  gpWardId: z.string().uuid().optional().nullable(),
  areaType: z.enum(['rural', 'urban']).optional(),
  bodyType: z.enum(['block', 'municipality', 'municipal_corporation', 'notified_area']).optional(),
  unitType: z.enum(['gp', 'ward']).optional(),
  localityType: z.enum(['village', 'urban_locality', 'locality']).optional(),
  wardNumber: z.string().trim().max(20).optional().nullable(),
  pincode: z.string().trim().max(16).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isActive: z.boolean().optional().default(true)
})), async (req, res, next) => {
  try {
    const { tier } = req.params;
    const d = req.validated;
    let r;
    if (tier === 'districts') {
      r = await query(
        `INSERT INTO wb_districts (code, lgd_code, name_en, name_bn, latitude, longitude, is_active)
         VALUES ($1,$1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE SET name_en=$2, name_bn=$3, latitude=$4, longitude=$5, is_active=$6, updated_at=NOW()
         RETURNING *`,
        [d.code, d.nameEn, d.nameBn, d.latitude ?? null, d.longitude ?? null, d.isActive]
      );
    } else if (tier === 'subdivisions' && d.districtId) {
      const distRes = await query('SELECT code FROM wb_districts WHERE id = $1', [d.districtId]);
      if (!distRes.rows.length) return res.status(404).json({ error: 'District not found' });
      r = await query(
        `INSERT INTO wb_subdivisions (code, district_id, district_code, name_en, name_bn, latitude, longitude, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (code) DO UPDATE SET name_en=$4, name_bn=$5, latitude=$6, longitude=$7, is_active=$8, updated_at=NOW()
         RETURNING *`,
        [d.code, d.districtId, distRes.rows[0].code, d.nameEn, d.nameBn, d.latitude ?? null, d.longitude ?? null, d.isActive]
      );
    } else if (tier === 'local_bodies' && d.districtId) {
      r = await query(
        `INSERT INTO wb_local_bodies (code, district_id, subdivision_id, area_type, body_type, name_en, name_bn, latitude, longitude, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (code) DO UPDATE SET name_en=$6, name_bn=$7, area_type=$4, body_type=$5, latitude=$8, longitude=$9, is_active=$10, updated_at=NOW()
         RETURNING *`,
        [d.code, d.districtId, d.subdivisionId || null, d.areaType || 'rural', d.bodyType || 'block', d.nameEn, d.nameBn, d.latitude ?? null, d.longitude ?? null, d.isActive]
      );
    } else if (tier === 'gp_wards' && d.districtId && d.localBodyId) {
      r = await query(
        `INSERT INTO wb_gp_wards (code, district_id, subdivision_id, local_body_id, unit_type, ward_number, name_en, name_bn, pincode, latitude, longitude, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (code) DO UPDATE SET name_en=$7, name_bn=$8, pincode=$9, ward_number=$6, is_active=$12, updated_at=NOW()
         RETURNING *`,
        [d.code, d.districtId, d.subdivisionId || null, d.localBodyId, d.unitType || 'gp', d.wardNumber || null, d.nameEn, d.nameBn, d.pincode || null, d.latitude ?? null, d.longitude ?? null, d.isActive]
      );
    } else if (tier === 'villages' && d.districtId && d.localBodyId) {
      r = await query(
        `INSERT INTO wb_villages (code, district_id, subdivision_id, local_body_id, gp_ward_id, locality_type, name_en, name_bn, pincode, latitude, longitude, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (code) DO UPDATE SET name_en=$7, name_bn=$8, pincode=$9, latitude=$10, longitude=$11, is_active=$12, updated_at=NOW()
         RETURNING *`,
        [d.code, d.districtId, d.subdivisionId || null, d.localBodyId, d.gpWardId || null, d.localityType || 'village', d.nameEn, d.nameBn, d.pincode || null, d.latitude ?? null, d.longitude ?? null, d.isActive]
      );
    } else {
      return res.status(400).json({ error: 'Invalid location tier or missing parent IDs.' });
    }
    await recordAuditLog({ actorUserId: req.user.id, action: `LOCATION_${tier.toUpperCase()}_UPSERT`, targetType: tier, targetId: r.rows[0]?.id || '', ipAddress: req.ip });
    res.status(201).json({ item: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/locations/:tier/:id', validateBody(z.object({
  nameEn: z.string().trim().min(2).max(160).optional(),
  nameBn: z.string().trim().min(1).max(160).optional(),
  pincode: z.string().trim().max(16).optional(),
  isActive: z.boolean().optional()
})), async (req, res, next) => {
  try {
    const TABLE_MAP = {
      districts: 'wb_districts',
      subdivisions: 'wb_subdivisions',
      local_bodies: 'wb_local_bodies',
      gp_wards: 'wb_gp_wards',
      villages: 'wb_villages'
    };
    const table = TABLE_MAP[req.params.tier];
    if (!table) return res.status(400).json({ error: 'Invalid location tier' });

    const { nameEn, nameBn, pincode, isActive } = req.validated;
    const hasPincode = req.params.tier === 'gp_wards' || req.params.tier === 'villages';
    const sql = hasPincode
      ? `UPDATE ${table} SET name_en = COALESCE($1, name_en), name_bn = COALESCE($2, name_bn), pincode = COALESCE($3, pincode), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5 RETURNING *`
      : `UPDATE ${table} SET name_en = COALESCE($1, name_en), name_bn = COALESCE($2, name_bn), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *`;
    const args = hasPincode
      ? [nameEn ?? null, nameBn ?? null, pincode ?? null, isActive ?? null, req.params.id]
      : [nameEn ?? null, nameBn ?? null, isActive ?? null, req.params.id];

    const r = await query(sql, args);
    if (!r.rows.length) return res.status(404).json({ error: 'Location item not found' });
    await recordAuditLog({ actorUserId: req.user.id, action: `LOCATION_${req.params.tier.toUpperCase()}_UPDATED`, targetType: req.params.tier, targetId: req.params.id, ipAddress: req.ip });
    res.json({ item: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
