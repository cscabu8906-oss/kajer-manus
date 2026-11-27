import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { validateBody } from '../middleware/validate.js';
import { authEndpointLimiter } from '../middleware/rateLimit.js';
import { clearAuthCookie, requireAuth, setAuthCookie, signAuthToken } from '../middleware/auth.js';
import { sendOtpEmail } from '../utils/mailer.js';
import { recordAuditLog } from '../utils/audit.js';

const router = Router();
router.use(authEndpointLimiter);

function generateNumericOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(email, code) {
  return crypto.createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex');
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  mobileNumber: z.string().trim().min(10).max(20),
  fullAddress: z.string().trim().min(4).max(400),
  password: z.string().min(8).max(128),
  accountRole: z.enum(['customer', 'provider']).default('customer'),
  languagePreference: z.enum(['bn', 'en']).default('bn'),
  bengaliNumerals: z.boolean().default(true)
});

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const data = req.validated;
    const normalizedEmail = data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const otpCode = generateNumericOtp();
    const otpHash = hashOtp(normalizedEmail, otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await withTransaction(async (client) => {
      const existing = await client.query('SELECT id, is_verified FROM users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length && existing.rows[0].is_verified) {
        const err = new Error('An account with this email already exists.');
        err.status = 409;
        throw err;
      }

      let userRow;
      if (existing.rows.length) {
        const updated = await client.query(
          `UPDATE users
           SET full_name = $1, mobile_number = $2, full_address = $3, password_hash = $4,
               role = $5, language_preference = $6, bengali_numerals = $7, updated_at = NOW()
           WHERE id = $8
           RETURNING id, full_name, email, mobile_number, full_address, role, is_verified, language_preference, bengali_numerals`,
          [data.fullName, data.mobileNumber, data.fullAddress, passwordHash, data.accountRole, data.languagePreference, data.bengaliNumerals, existing.rows[0].id]
        );
        userRow = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO users (full_name, email, mobile_number, full_address, password_hash, role, language_preference, bengali_numerals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, full_name, email, mobile_number, full_address, role, is_verified, language_preference, bengali_numerals`,
          [data.fullName, normalizedEmail, data.mobileNumber, data.fullAddress, passwordHash, data.accountRole, data.languagePreference, data.bengaliNumerals]
        );
        userRow = inserted.rows[0];
      }

      if (data.accountRole === 'provider') {
        await client.query(
          `INSERT INTO provider_profiles (user_id, service_location_bn, service_location_en)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [userRow.id, data.fullAddress.slice(0, 120), data.fullAddress.slice(0, 120)]
        );
      }

      await client.query(
        `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
         VALUES ($1, 'register_verify', $2, $3)`,
        [normalizedEmail, otpHash, expiresAt]
      );

      return userRow;
    });

    await sendOtpEmail({
      to: normalizedEmail,
      code: otpCode,
      purpose: 'register_verify',
      language: data.languagePreference
    });

    await recordAuditLog({
      actorUserId: user.id,
      action: 'USER_REGISTERED_PENDING_OTP',
      targetType: 'user',
      targetId: user.id,
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Registration submitted. Please verify the 6-digit OTP sent to your email.',
      email: user.email,
      otpRequired: true
    });
  } catch (err) {
    next(err);
  }
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
  purpose: z.enum(['register_verify', 'password_reset']).default('register_verify')
});

router.post('/verify-otp', validateBody(verifyOtpSchema), async (req, res, next) => {
  try {
    const { email, otp, purpose } = req.validated;
    const normalizedEmail = email.toLowerCase();
    const otpHash = hashOtp(normalizedEmail, otp);

    const otpRes = await query(
      `SELECT id, code_hash, expires_at, consumed, attempts
       FROM otp_codes
       WHERE email = $1 AND purpose = $2 AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, purpose]
    );

    if (!otpRes.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired OTP code.' });
    }

    const row = otpRes.rows[0];
    if (new Date(row.expires_at) < new Date() || row.attempts >= 5) {
      return res.status(400).json({ error: 'OTP expired or too many failed attempts. Request a new code.' });
    }

    if (row.code_hash !== otpHash) {
      await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    if (purpose === 'register_verify') {
      const user = await withTransaction(async (client) => {
        await client.query('UPDATE otp_codes SET consumed = TRUE WHERE id = $1', [row.id]);
        const updated = await client.query(
          `UPDATE users SET is_verified = TRUE, updated_at = NOW()
           WHERE email = $1
           RETURNING id, full_name, email, mobile_number, full_address, role, is_verified,
                     language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled`,
          [normalizedEmail]
        );
        return updated.rows[0];
      });

      const token = signAuthToken(user);
      setAuthCookie(res, token);
      await recordAuditLog({ actorUserId: user.id, action: 'EMAIL_OTP_VERIFIED', targetType: 'user', targetId: user.id, ipAddress: req.ip });
      return res.json({ token, user });
    }

    return res.json({ verified: true, message: 'OTP verified. You may now reset your password.' });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-otp', validateBody(z.object({
  email: z.string().trim().email(),
  purpose: z.enum(['register_verify', 'password_reset']).default('register_verify'),
  languagePreference: z.enum(['bn', 'en']).optional()
})), async (req, res, next) => {
  try {
    const { email, purpose, languagePreference } = req.validated;
    const normalizedEmail = email.toLowerCase();
    const userRes = await query('SELECT id, language_preference FROM users WHERE email = $1', [normalizedEmail]);
    if (!userRes.rows.length) {
      return res.json({ message: 'If the email exists, a verification code has been sent.' });
    }
    const lang = languagePreference || userRes.rows[0].language_preference || 'bn';
    const otpCode = generateNumericOtp();
    await query(
      `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalizedEmail, purpose, hashOtp(normalizedEmail, otpCode), new Date(Date.now() + 10 * 60 * 1000)]
    );
    await sendOtpEmail({ to: normalizedEmail, code: otpCode, purpose, language: lang });
    res.json({ message: 'A new 6-digit OTP has been sent to your email.' });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validateBody(z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
})), async (req, res, next) => {
  try {
    const normalizedEmail = req.validated.email.toLowerCase();
    const result = await query(
      `SELECT id, full_name, email, mobile_number, full_address, password_hash, role, is_verified,
              language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userRow = result.rows[0];
    const valid = await bcrypt.compare(req.validated.password, userRow.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!userRow.is_verified) {
      return res.status(403).json({ error: 'Please verify your email OTP before signing in.', code: 'OTP_REQUIRED', email: userRow.email });
    }

    const { password_hash: _removed, ...user } = userRow;
    const token = signAuthToken(user);
    setAuthCookie(res, token);
    await recordAuditLog({ actorUserId: user.id, action: 'USER_LOGIN', targetType: 'user', targetId: user.id, ipAddress: req.ip });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', validateBody(z.object({
  email: z.string().trim().email(),
  languagePreference: z.enum(['bn', 'en']).optional()
})), async (req, res, next) => {
  try {
    const normalizedEmail = req.validated.email.toLowerCase();
    const userRes = await query('SELECT id, language_preference FROM users WHERE email = $1', [normalizedEmail]);
    if (userRes.rows.length) {
      const lang = req.validated.languagePreference || userRes.rows[0].language_preference || 'bn';
      const otpCode = generateNumericOtp();
      await query(
        `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
         VALUES ($1, 'password_reset', $2, $3)`,
        [normalizedEmail, hashOtp(normalizedEmail, otpCode), new Date(Date.now() + 10 * 60 * 1000)]
      );
      await sendOtpEmail({ to: normalizedEmail, code: otpCode, purpose: 'password_reset', language: lang });
      await recordAuditLog({ actorUserId: userRes.rows[0].id, action: 'PASSWORD_RESET_OTP_SENT', targetType: 'user', targetId: userRes.rows[0].id, ipAddress: req.ip });
    }
    res.json({ message: 'If an account matches this email, a password reset OTP has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', validateBody(z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128)
})), async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.validated;
    const normalizedEmail = email.toLowerCase();
    const otpHash = hashOtp(normalizedEmail, otp);

    const otpRes = await query(
      `SELECT id, code_hash, expires_at, attempts
       FROM otp_codes
       WHERE email = $1 AND purpose = 'password_reset' AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );
    if (!otpRes.rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset OTP.' });
    }
    const row = otpRes.rows[0];
    if (new Date(row.expires_at) < new Date() || row.attempts >= 5) {
      return res.status(400).json({ error: 'Reset OTP expired. Request a new code.' });
    }
    if (row.code_hash !== otpHash) {
      await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const userId = await withTransaction(async (client) => {
      await client.query('UPDATE otp_codes SET consumed = TRUE WHERE id = $1', [row.id]);
      const updated = await client.query(
        'UPDATE users SET password_hash = $1, is_verified = TRUE, updated_at = NOW() WHERE email = $2 RETURNING id',
        [passwordHash, normalizedEmail]
      );
      return updated.rows[0]?.id;
    });

    await recordAuditLog({ actorUserId: userId, action: 'PASSWORD_RESET_COMPLETED', targetType: 'user', targetId: userId || '', ipAddress: req.ip });
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
