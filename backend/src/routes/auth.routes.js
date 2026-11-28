import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { validateBody } from '../middleware/validate.js';
import { authEndpointLimiter } from '../middleware/rateLimit.js';
import {
  USER_SELECT_FIELDS,
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signAdmin2faTempToken,
  signAuthToken,
  signMobileVerifiedToken
} from '../middleware/auth.js';
import { sendOtpEmail } from '../utils/mailer.js';
import { sendMobileOtpSms, isSmsConfigured } from '../utils/sms.js';
import { recordAuditLog } from '../utils/audit.js';
import { consumeBackupCode, decryptTotpSecret, verifyTotpCode } from '../utils/totp.js';
import { resolveLocationHierarchy } from './location.routes.js';

const router = Router();
router.use(authEndpointLimiter);

function generateNumericOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(target, code) {
  return crypto.createHash('sha256').update(`${String(target).toLowerCase()}:${code}`).digest('hex');
}

function extractMobileLast10(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

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
  mobileVerificationToken: z.string().trim().optional().default(''),
  profilePhotoUrl: z.string().trim().max(500).optional().default(''),
  fullAddress: z.string().trim().min(4).max(400),
  stateName: z.string().trim().max(60).optional().default('West Bengal'),
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
  locationConsent: z.boolean().optional().default(false),
  password: z.string().min(8).max(128),
  accountRole: z.enum(['customer', 'provider']).default('customer'),
  languagePreference: z.enum(['bn', 'en']).default('bn'),
  bengaliNumerals: z.boolean().default(true)
});

router.post(
  '/send-mobile-otp',
  validateBody(
    z.object({
      mobileNumber: z
        .string()
        .trim()
        .min(10)
        .max(20)
        .refine((val) => extractMobileLast10(val).length === 10, {
          message: 'Valid 10-digit mobile number required.'
        }),
      emailFallback: z.string().trim().email().optional(),
      languagePreference: z.enum(['bn', 'en']).default('bn')
    })
  ),
  async (req, res, next) => {
    try {
      const { mobileNumber, emailFallback, languagePreference } = req.validated;
      const last10 = extractMobileLast10(mobileNumber);
      const otpCode = generateNumericOtp();
      const otpHash = hashOtp(last10, otpCode);

      await query(
        `INSERT INTO otp_codes (email, channel, target, purpose, code_hash, expires_at)
         VALUES ($1, $2, $3, 'mobile_register', $4, $5)`,
        [
          emailFallback ? emailFallback.toLowerCase() : '',
          isSmsConfigured() ? 'mobile' : 'email',
          last10,
          otpHash,
          new Date(Date.now() + 10 * 60 * 1000)
        ]
      );

      if (isSmsConfigured()) {
        await sendMobileOtpSms({ mobileNumber: last10, otp: otpCode, lang: languagePreference });
        return res.json({
          sent: true,
          channel: 'sms',
          message: 'A 6-digit verification OTP has been sent to your mobile number.'
        });
      }

      if (emailFallback) {
        await sendOtpEmail({
          to: emailFallback.toLowerCase(),
          code: otpCode,
          purpose: 'register_verify',
          language: languagePreference
        });
        return res.json({
          sent: true,
          channel: 'email_fallback',
          message: 'A 6-digit verification OTP has been sent to your email address.'
        });
      }

      return res.status(503).json({
        error:
          'SMS OTP gateway is not configured on this server. Provide an email address for OTP delivery or configure SMS_PROVIDER_URL and SMS_API_KEY.'
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/verify-mobile-otp',
  validateBody(
    z.object({
      mobileNumber: z.string().trim().min(10).max(20),
      otp: z.string().trim().regex(/^\d{6}$/)
    })
  ),
  async (req, res, next) => {
    try {
      const { mobileNumber, otp } = req.validated;
      const last10 = extractMobileLast10(mobileNumber);
      if (!last10) {
        return res.status(400).json({ error: 'Valid 10-digit mobile number required.' });
      }
      const otpHash = hashOtp(last10, otp);
      const otpRes = await query(
        `SELECT id, code_hash, expires_at, attempts
         FROM otp_codes
         WHERE target = $1 AND purpose = 'mobile_register' AND consumed = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [last10]
      );
      if (!otpRes.rows.length) {
        return res.status(400).json({ error: 'Invalid or expired mobile OTP code.' });
      }
      const row = otpRes.rows[0];
      if (new Date(row.expires_at) < new Date() || row.attempts >= 5) {
        return res.status(400).json({ error: 'Mobile OTP expired or too many attempts. Request a new code.' });
      }
      if (row.code_hash !== otpHash) {
        await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
        return res.status(400).json({ error: 'Incorrect OTP code.' });
      }

      await query('UPDATE otp_codes SET consumed = TRUE WHERE id = $1', [row.id]);
      const mobileVerificationToken = signMobileVerifiedToken(last10);
      res.json({ verified: true, mobileVerificationToken });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const data = req.validated;
    const normalizedEmail = data.email.toLowerCase();
    const mobileLast10 = extractMobileLast10(data.mobileNumber);
    const passwordHash = await bcrypt.hash(data.password, 12);

    let mobileVerified = false;
    if (data.mobileVerificationToken) {
      try {
        const vp = jwt.verify(data.mobileVerificationToken, env.jwtSecret);
        if (vp.purpose === 'mobile_verified' && vp.sub === mobileLast10) {
          mobileVerified = true;
        }
      } catch {
        return res.status(400).json({ error: 'Mobile OTP verification token expired. Please verify OTP again.' });
      }
    }

    const loc = await resolveLocationHierarchy({
      districtId: data.districtId,
      subdivisionId: data.subdivisionId,
      localBodyId: data.localBodyId,
      gpWardId: data.gpWardId,
      villageId: data.villageId,
      pincode: data.pincode
    });

    const finalAreaType =
      data.areaType || loc.localBody?.area_type || '';
    const finalPincode = data.pincode || loc.resolvedPincode || '';
    const finalVillageText = data.villageLocality || loc.village?.name_en || '';

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
        `INSERT INTO users (
           full_name, email, mobile_number, mobile_verified, profile_photo_url, full_address,
           state_name, district_id, subdivision_id, area_type, local_body_id, gp_ward_id, village_id,
           village_locality, pincode, latitude, longitude, location_consent,
           password_hash, role, is_verified, language_preference, bengali_numerals
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18,
           $19, $20, TRUE, $21, $22
         )
         RETURNING ${USER_SELECT_FIELDS}`,
        [
          data.fullName,
          normalizedEmail,
          data.mobileNumber,
          mobileVerified,
          data.profilePhotoUrl,
          data.fullAddress,
          data.stateName || 'West Bengal',
          data.districtId,
          data.subdivisionId,
          finalAreaType,
          data.localBodyId,
          data.gpWardId,
          data.villageId,
          finalVillageText,
          finalPincode,
          data.locationConsent ? data.latitude : null,
          data.locationConsent ? data.longitude : null,
          Boolean(data.locationConsent),
          passwordHash,
          data.accountRole,
          data.languagePreference,
          data.bengaliNumerals
        ]
      );
      const userRow = inserted.rows[0];

      if (data.accountRole === 'provider') {
        const pubEn = loc.areaLabelEn || data.fullAddress.slice(0, 140);
        const pubBn = loc.areaLabelBn || data.fullAddress.slice(0, 140);
        await client.query(
          `INSERT INTO provider_profiles (
             user_id, photo_url, service_location_bn, service_location_en,
             public_area_label_bn, public_area_label_en,
             district_id, subdivision_id, area_type, local_body_id, gp_ward_id, village_id,
             village_locality, pincode, latitude, longitude, gps_consent
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (user_id) DO NOTHING`,
          [
            userRow.id,
            data.profilePhotoUrl,
            pubBn.slice(0, 140),
            pubEn.slice(0, 140),
            pubBn.slice(0, 180),
            pubEn.slice(0, 180),
            data.districtId,
            data.subdivisionId,
            finalAreaType,
            data.localBodyId,
            data.gpWardId,
            data.villageId,
            finalVillageText,
            finalPincode,
            data.locationConsent ? data.latitude : loc.centroidLat,
            data.locationConsent ? data.longitude : loc.centroidLng,
            Boolean(data.locationConsent)
          ]
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
      ipAddress: req.ip,
      details: { role: user.role, districtId: user.district_id, mobileVerified }
    });

    res.status(201).json({ token, user });
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

router.post(
  '/resend-otp',
  validateBody(
    z.object({
      email: z.string().trim().email(),
      purpose: z.enum(['password_reset', 'register_verify']).default('password_reset'),
      languagePreference: z.enum(['bn', 'en']).optional()
    })
  ),
  async (req, res, next) => {
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
        `INSERT INTO otp_codes (email, channel, target, purpose, code_hash, expires_at)
         VALUES ($1, 'email', $1, 'password_reset', $2, $3)`,
        [normalizedEmail, hashOtp(normalizedEmail, otpCode), new Date(Date.now() + 10 * 60 * 1000)]
      );
      await sendOtpEmail({ to: normalizedEmail, code: otpCode, purpose: 'password_reset', language: lang });
      res.json({ message: 'A new 6-digit password reset OTP has been sent to your email.' });
    } catch (err) {
      next(err);
    }
  }
);

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
        `SELECT ${USER_SELECT_FIELDS}, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [normalizedEmail]
      );
    } else {
      const mobileLast10 = extractMobileLast10(rawIdentifier);
      if (!mobileLast10) {
        return res.status(401).json({ error: 'Invalid email, mobile number, or password.' });
      }
      result = await query(
        `SELECT ${USER_SELECT_FIELDS}, password_hash
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

    if (user.role === 'admin' && user.two_factor_enabled) {
      const tempToken = signAdmin2faTempToken(user);
      await recordAuditLog({
        actorUserId: user.id,
        action: 'ADMIN_2FA_CHALLENGE_ISSUED',
        targetType: 'user',
        targetId: user.id,
        ipAddress: req.ip
      });
      return res.json({
        requires2fa: true,
        tempToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          two_factor_enabled: true
        }
      });
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);
    await recordAuditLog({ actorUserId: user.id, action: 'USER_LOGIN', targetType: 'user', targetId: user.id, ipAddress: req.ip });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/admin/2fa/verify-login',
  validateBody(
    z.object({
      tempToken: z.string().min(10),
      code: z.string().trim().min(6).max(20)
    })
  ),
  async (req, res, next) => {
    try {
      const { tempToken, code } = req.validated;
      let payload;
      try {
        payload = jwt.verify(tempToken, env.jwtSecret);
      } catch {
        return res.status(401).json({ error: 'Two-factor session expired. Please sign in again.' });
      }
      if (payload.purpose !== 'admin_2fa' || !payload.sub) {
        return res.status(401).json({ error: 'Invalid two-factor challenge token.' });
      }

      const result = await query(
        `SELECT ${USER_SELECT_FIELDS}, two_factor_secret, two_factor_backup_codes
         FROM users WHERE id = $1 LIMIT 1`,
        [payload.sub]
      );
      if (!result.rows.length) {
        return res.status(401).json({ error: 'Account not found.' });
      }

      const row = result.rows[0];
      if (row.role !== 'admin' || !row.two_factor_enabled) {
        return res.status(400).json({ error: 'Two-factor authentication is not active on this account.' });
      }

      const secret = decryptTotpSecret(row.two_factor_secret);
      let verified = verifyTotpCode(secret, code);
      let usedBackupCode = false;

      if (!verified) {
        const backupRes = consumeBackupCode(row.two_factor_backup_codes, code);
        if (backupRes.matched) {
          verified = true;
          usedBackupCode = true;
          await query(
            'UPDATE users SET two_factor_backup_codes = $1::jsonb, updated_at = NOW() WHERE id = $2',
            [JSON.stringify(backupRes.remainingHashes), row.id]
          );
        }
      }

      if (!verified) {
        await recordAuditLog({
          actorUserId: row.id,
          action: 'ADMIN_2FA_LOGIN_FAILED',
          targetType: 'user',
          targetId: row.id,
          ipAddress: req.ip
        });
        return res.status(401).json({ error: 'Invalid authenticator or backup code.' });
      }

      const { two_factor_secret: _s, two_factor_backup_codes: _b, ...user } = row;
      const token = signAuthToken(user);
      setAuthCookie(res, token);

      await recordAuditLog({
        actorUserId: user.id,
        action: 'ADMIN_2FA_LOGIN_VERIFIED',
        targetType: 'user',
        targetId: user.id,
        ipAddress: req.ip,
        details: { usedBackupCode }
      });

      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/forgot-password',
  validateBody(
    z.object({
      email: z.string().trim().email(),
      languagePreference: z.enum(['bn', 'en']).optional()
    })
  ),
  async (req, res, next) => {
    try {
      const normalizedEmail = req.validated.email.toLowerCase();
      const userRes = await query('SELECT id, language_preference FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
      if (userRes.rows.length) {
        const lang = req.validated.languagePreference || userRes.rows[0].language_preference || 'bn';
        const otpCode = generateNumericOtp();
        await query(
          `INSERT INTO otp_codes (email, channel, target, purpose, code_hash, expires_at)
           VALUES ($1, 'email', $1, 'password_reset', $2, $3)`,
          [normalizedEmail, hashOtp(normalizedEmail, otpCode), new Date(Date.now() + 10 * 60 * 1000)]
        );
        await sendOtpEmail({ to: normalizedEmail, code: otpCode, purpose: 'password_reset', language: lang });
        await recordAuditLog({
          actorUserId: userRes.rows[0].id,
          action: 'PASSWORD_RESET_OTP_SENT',
          targetType: 'user',
          targetId: userRes.rows[0].id,
          ipAddress: req.ip
        });
      }
      res.json({ message: 'If an account matches this email, a password reset OTP has been sent.' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/reset-password',
  validateBody(
    z.object({
      email: z.string().trim().email(),
      otp: z.string().trim().regex(/^\d{6}$/),
      newPassword: z.string().min(8).max(128)
    })
  ),
  async (req, res, next) => {
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

      await recordAuditLog({
        actorUserId: userId,
        action: 'PASSWORD_RESET_COMPLETED',
        targetType: 'user',
        targetId: userId || '',
        ipAddress: req.ip
      });
      res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Logged out successfully.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
