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
  mobileNumber: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine((val) => val.replace(/\D/g, '').length >= 10, {
      message: 'Mobile number must contain at least 10 digits.'
    }),
  fullAddress: z.string().trim().min(4).max(400),
  password: z.string().min(8).max(128),
  accountRole: z.enum(['customer', 'provider']).default('customer'),
  languagePreference: z.enum(['bn', 'en']).default('bn'),
  bengaliNumerals: z.boolean().default(true)
});

function extractMobileLast10(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const data = req.validated;
    const normalizedEmail = data.email.toLowerCase();
    const mobileLast10 = extractMobileLast10(data.mobileNumber);
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM users
         WHERE LOWER(email) = $1
            OR ($2 <> '' AND right(regexp_replace(mobile_number, '\\D', '', 'g'), 10) = $2)
         LIMIT 1`,
        [normalizedEmail, mobileLast10]
      );
      if (existing.rows.length) {
        const err = new Error('An account with this email or mobile number already exists.');
        err.status = 409;
        throw err;
      }

      const inserted = await client.query(
        `INSERT INTO users (full_name, email, mobile_number, full_address, password_hash, role, is_verified, language_preference, bengali_numerals)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
         RETURNING id, full_name, email, mobile_number, full_address, role, is_verified,
                   language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled`,
        [data.fullName, normalizedEmail, data.mobileNumber, data.fullAddress, passwordHash, data.accountRole, data.languagePreference, data.bengaliNumerals]
      );
      const userRow = inserted.rows[0];

      if (data.accountRole === 'provider') {
        await client.query(
          `INSERT INTO provider_profiles (user_id, service_location_bn, service_location_en)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO NOTHING`,
          [userRow.id, data.fullAddress.slice(0, 120), data.fullAddress.slice(0, 120)]
        );
      }

      return userRow;
    });

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    await recordAuditLog({
      actorUserId: user.id,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: user.id,
      ipAddress: req.ip
    });

    res.status(201).json({
      token,
      user
    });
  } catch (err) {
    next(err);
  }
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
  purpose: z.enum(['password_reset', 'register_verify']).default('password_reset')
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

    return res.json({ verified: true, message: 'OTP verified. You may now reset your password.' });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-otp', validateBody(z.object({
  email: z.string().trim().email(),
  purpose: z.enum(['password_reset', 'register_verify']).default('password_reset'),
  languagePreference: z.enum(['bn', 'en']).optional()
})), async (req, res, next) => {
  try {
    const { email, languagePreference } = req.validated;
    const normalizedEmail = email.toLowerCase();
    const userRes = await query('SELECT id, language_preference FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (!userRes.rows.length) {
      return res.json({ message: 'If the email exists, a password reset OTP has been sent.' });
    }
    const lang = languagePreference || userRes.rows[0].language_preference || 'bn';
    const otpCode = generateNumericOtp();
    await query(
      `INSERT INTO otp_codes (email, purpose, code_hash, expires_at)
       VALUES ($1, 'password_reset', $2, $3)`,
      [normalizedEmail, hashOtp(normalizedEmail, otpCode), new Date(Date.now() + 10 * 60 * 1000)]
    );
    await sendOtpEmail({ to: normalizedEmail, code: otpCode, purpose: 'password_reset', language: lang });
    res.json({ message: 'A new 6-digit password reset OTP has been sent to your email.' });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !raw.identifier && raw.email) {
    return { ...raw, identifier: raw.email };
  }
  return raw;
}, z.object({
  identifier: z.string().trim().min(3).max(180),
  password: z.string().min(1)
}));

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const rawIdentifier = req.validated.identifier.trim();
    const isEmail = rawIdentifier.includes('@');

    let result;
    if (isEmail) {
      const normalizedEmail = rawIdentifier.toLowerCase();
      result = await query(
        `SELECT id, full_name, email, mobile_number, full_address, password_hash, role, is_verified,
                language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled
         FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedEmail]
      );
    } else {
      const mobileLast10 = extractMobileLast10(rawIdentifier);
      if (!mobileLast10) {
        return res.status(401).json({ error: 'Invalid email, mobile number, or password.' });
      }
      result = await query(
        `SELECT id, full_name, email, mobile_number, full_address, password_hash, role, is_verified,
                language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled
         FROM users
         WHERE mobile_number = $1
            OR right(regexp_replace(mobile_number, '\\D', '', 'g'), 10) = $2
         LIMIT 1`,
        [rawIdentifier, mobileLast10]
      );
    }

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email, mobile number, or password.' });
    }

    const userRow = result.rows[0];
    const valid = await bcrypt.compare(req.validated.password, userRow.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email, mobile number, or password.' });
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
    const userRes = await query('SELECT id, language_preference FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
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
        'UPDATE users SET password_hash = $1, is_verified = TRUE, updated_at = NOW() WHERE LOWER(email) = $2 RETURNING id',
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
