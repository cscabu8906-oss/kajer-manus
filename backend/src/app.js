import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { query } from './config/db.js';
import { generalApiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import marketplaceRoutes from './routes/marketplace.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import adminRoutes from './routes/admin.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import locationRoutes from './routes/location.routes.js';
import uploadRoutes, { getUploadRootDir } from './routes/upload.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('Origin not allowed by CORS'));
      },
      credentials: true
    })
  );
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(cookieParser());
  app.use('/uploads', express.static(getUploadRootDir(), { maxAge: '7d', index: false }));
  app.use('/api', generalApiLimiter);

  app.get('/api/v1/health', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({
        status: 'ok',
        service: 'kajer-manus-api',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/locations', locationRoutes);
  app.use('/api/v1/uploads', uploadRoutes);
  app.use('/api/v1', marketplaceRoutes);
  app.use('/api/v1', bookingRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/admin', adminRoutes);

  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('Unhandled server error:', err);
    }
    res.status(status).json({
      error: status >= 500 && !err.expose ? 'Internal server error' : err.message
    });
  });

  return app;
}
