import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';

export function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
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
    const result = await query(
      `SELECT id, full_name, email, mobile_number, full_address, role, is_verified,
              language_preference, bengali_numerals, push_notifications_enabled, email_notifications_enabled
       FROM users WHERE id = $1`,
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

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}
