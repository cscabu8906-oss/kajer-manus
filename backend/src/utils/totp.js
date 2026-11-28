import crypto from 'crypto';
import { env } from '../config/env.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function deriveAesKey() {
  const source = env.totpEncryptionKey || `${env.jwtSecret}:kajer_manus_totp_key`;
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptTotpSecret(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptTotpSecret(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) {
    return '';
  }
  const parts = payload.split(':');
  if (parts.length !== 3) return '';
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveAesKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export function generateBase32Secret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32ToBuffer(base32) {
  const clean = String(base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpCode(secretBase32, counterOffset = 0, nowMs = Date.now()) {
  const key = base32ToBuffer(secretBase32);
  const counter = Math.floor(nowMs / 1000 / 30) + counterOffset;
  const msg = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  msg.writeUInt32BE(high, 0);
  msg.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(codeInt % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secretBase32, candidateCode, window = 1, nowMs = Date.now()) {
  const clean = String(candidateCode || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean) || !secretBase32) return false;
  const candidateBuf = Buffer.from(clean, 'utf8');
  let matched = false;
  for (let delta = -window; delta <= window; delta++) {
    const expected = generateTotpCode(secretBase32, delta, nowMs);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (expectedBuf.length === candidateBuf.length && crypto.timingSafeEqual(expectedBuf, candidateBuf)) {
      matched = true;
    }
  }
  return matched;
}

export function buildOtpAuthUrl({ issuer = 'Kajer Manus', accountEmail, secretBase32 }) {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function hashBackupCode(rawCode) {
  const normalized = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(`km_backup:${normalized}`).digest('hex');
}

export function generateBackupCodes(count = 8) {
  const plainCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < count; i++) {
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += BACKUP_ALPHABET[crypto.randomInt(0, BACKUP_ALPHABET.length)];
    }
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plainCodes.push(formatted);
    hashedCodes.push(hashBackupCode(formatted));
  }
  return { plainCodes, hashedCodes };
}

export function consumeBackupCode(storedHashes, candidateCode) {
  const hashes = Array.isArray(storedHashes) ? storedHashes.map(String) : [];
  const normalized = String(candidateCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 6) {
    return { matched: false, remainingHashes: hashes };
  }
  const candidateHashBuf = Buffer.from(hashBackupCode(normalized), 'hex');
  let matchIndex = -1;
  for (let i = 0; i < hashes.length; i++) {
    try {
      const hBuf = Buffer.from(hashes[i], 'hex');
      if (hBuf.length === candidateHashBuf.length && crypto.timingSafeEqual(hBuf, candidateHashBuf)) {
        matchIndex = i;
      }
    } catch {
      // ignore malformed hash entry
    }
  }
  if (matchIndex === -1) {
    return { matched: false, remainingHashes: hashes };
  }
  const remainingHashes = hashes.filter((_, idx) => idx !== matchIndex);
  return { matched: true, remainingHashes };
}
