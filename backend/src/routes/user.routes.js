import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    const addrRes = await query(
      'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json({ user: req.user, addresses: addrRes.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', validateBody(z.object({
  fullName: z.string().trim().min(2).max(120),
  mobileNumber: z.string().trim().min(10).max(20),
  fullAddress: z.string().trim().min(4).max(400),
  pushNotificationsEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional()
})), async (req, res, next) => {
  try {
    const d = req.validated;
    const result = await query(
      `UPDATE users
       SET full_name = $1, mobile_number = $2, full_address = $3,
           push_notifications_enabled = COALESCE($4, push_notifications_enabled),
           email_notifications_enabled = COALESCE($5, email_notifications_enabled),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, full_name, email, mobile_number, full_address, role, is_verified,
                 language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled`,
      [d.fullName, d.mobileNumber, d.fullAddress, d.pushNotificationsEnabled ?? null, d.emailNotificationsEnabled ?? null, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/me/language', validateBody(z.object({
  languagePreference: z.enum(['bn', 'en']),
  bengaliNumerals: z.boolean().optional()
})), async (req, res, next) => {
  try {
    const { languagePreference, bengaliNumerals } = req.validated;
    const result = await query(
      `UPDATE users
       SET language_preference = $1,
           bengali_numerals = COALESCE($2, bengali_numerals),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, email, mobile_number, full_address, role, is_verified,
                 language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled`,
      [languagePreference, bengaliNumerals ?? null, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/me/addresses', validateBody(z.object({
  label: z.string().trim().min(1).max(60),
  addressLine: z.string().trim().min(4).max(400),
  city: z.string().trim().min(2).max(80).default('Kolkata'),
  pincode: z.string().trim().max(16).default('')
})), async (req, res, next) => {
  try {
    const d = req.validated;
    const result = await query(
      `INSERT INTO user_addresses (user_id, label, address_line, city, pincode)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, d.label, d.addressLine, d.city, d.pincode]
    );
    res.status(201).json({ address: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/me/addresses/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/me/fcm-token', validateBody(z.object({
  fcmToken: z.string().trim().min(20).max(512),
  platform: z.enum(['android', 'web']).default('android')
})), async (req, res, next) => {
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
});

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
