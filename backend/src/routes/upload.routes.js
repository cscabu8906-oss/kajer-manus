import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { authEndpointLimiter } from '../middleware/rateLimit.js';

const router = Router();
const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploads.dir || 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_FOLDERS = new Set(['avatars', 'portfolio', 'kyc', 'bookings']);

function detectImageExtension(buffer) {
  if (!buffer || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(1, env.uploads.maxMb) * 1024 * 1024,
    files: 5
  }
});

function persistValidatedImage(file, folder) {
  const safeFolder = ALLOWED_FOLDERS.has(folder) ? folder : 'bookings';
  const ext = detectImageExtension(file.buffer);
  if (!ext) {
    const err = new Error('Only valid JPEG, PNG, or WebP images are allowed.');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const destDir = path.join(UPLOAD_ROOT, safeFolder);
  fs.mkdirSync(destDir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fullPath = path.resolve(destDir, filename);
  if (!fullPath.startsWith(UPLOAD_ROOT)) {
    const err = new Error('Invalid upload destination.');
    err.status = 400;
    throw err;
  }
  fs.writeFileSync(fullPath, file.buffer);
  return `/uploads/${safeFolder}/${filename}`;
}

// Pre-registration avatar upload (strictly single small image, rate-limited)
router.post('/avatar', authEndpointLimiter, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const url = persistValidatedImage(req.file, 'avatars');
    res.status(201).json({ url, urls: [url] });
  } catch (err) {
    next(err);
  }
});

// Authenticated multi-photo upload (portfolio, KYC documents, booking problem photos, profile photo)
router.post('/', requireAuth, upload.array('files', 5), (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ error: 'No image files uploaded.' });
    }
    const folder = String(req.body?.folder || req.query?.folder || 'bookings');
    const urls = files.map((f) => persistValidatedImage(f, folder));
    res.status(201).json({ url: urls[0], urls });
  } catch (err) {
    next(err);
  }
});

export function getUploadRootDir() {
  return UPLOAD_ROOT;
}

export default router;
