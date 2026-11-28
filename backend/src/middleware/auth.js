import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

export const USER_SELECT_FIELDS = `
  id, full_name, email, mobile_number, mobile_verified, full_address, profile_photo_url,
  role, is_verified, two_factor_enabled,
  state_name, district_id, subdivision_id, area_type, local_body_id, gp_ward_id, village_id,
  village_locality, pincode, latitude, longitude, location_consent,
  language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled,
  created_at
`;

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function signAdmin2faTempToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, purpose: 'admin_2fa' },
    env.jwtSecret,
    { expiresIn: '5m' }
  );
}

export function signMobileVerifiedToken(mobileLast10) {
  return jwt.sign(
    { sub: mobileLast10, purpose: 'mobile_verified' },
    env.jwtSecret,
    { expiresIn: '30m' }
  );
}

export function setAuthCookie(res, token) {
  const isProd = env.nodeEnv === 'production';
  res.cookie('km_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? env.cookieDomain : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearAuthCookie(res) {
  const isProd = env.nodeEnv === 'production';
  res.clearCookie('km_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? env.cookieDomain : undefined
  });
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearer || req.cookies?.km_token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.purpose === 'admin_2fa' || payload.purpose === 'mobile_verified') {
      return res.status(401).json({ error: 'Full account authentication required' });
    }
    const result = await query(
      `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    const user = result.rows[0];
    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email OTP verification required', code: 'OTP_REQUIRED' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

export async function attachOptionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearer || req.cookies?.km_token;
    if (!token) return next();
    const payload = jwt.verify(token, env.jwtSecret);
    if (!payload.sub || payload.purpose) return next();
    const result = await query(
      `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (result.rows.length && result.rows[0].is_verified) {
      req.user = result.rows[0];
    }
  } catch {
    // Optional auth ignores expired/invalid tokens
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}
