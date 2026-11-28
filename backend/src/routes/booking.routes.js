import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createUserNotification } from '../utils/notifications.js';
import { resolveLocationHierarchy } from './location.routes.js';

const router = Router();

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

// Public contact form / support submission (supports authenticated or guest)
router.post(
  '/support/contact',
  validateBody(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().trim().email().optional(),
      bookingId: optionalUuid,
      subject: z.string().trim().min(2).max(160),
      message: z.string().trim().min(5).max(1500),
      languageCode: z.enum(['bn', 'en']).default('bn')
    })
  ),
  async (req, res, next) => {
    try {
      const d = req.validated;
      const result = await query(
        `INSERT INTO complaints (user_id, name, email, booking_id, subject, message, language_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.user?.id || null, d.name || '', d.email || '', d.bookingId || null, d.subject, d.message, d.languageCode]
      );
      res.status(201).json({ ticket: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

router.use(requireAuth);

router.post(
  '/bookings',
  validateBody(
    z
      .object({
        serviceId: optionalUuid,
        providerId: optionalUuid,
        categorySlug: z.string().trim().max(60).optional().default(''),
        customerName: z.string().trim().min(2).max(120),
        customerPhone: z.string().trim().min(10).max(20),
        serviceAddress: z.string().trim().min(4).max(400),
        districtId: optionalUuid,
        subdivisionId: optionalUuid,
        localBodyId: optionalUuid,
        gpWardId: optionalUuid,
        villageId: optionalUuid,
        pincode: z.string().trim().max(16).optional().default(''),
        latitude: optionalCoord,
        longitude: optionalCoord,
        problemPhotos: z.array(z.string().trim().max(500)).max(5).optional().default([]),
        idempotencyKey: z.string().trim().max(120).optional().default(''),
        preferredDate: z.string().trim().min(4).max(40),
        preferredTime: z.string().trim().min(2).max(60),
        instructions: z.string().trim().max(800).default(''),
        paymentMethod: z.enum(['cash', 'razorpay']).default('cash'),
        languageAtBooking: z.enum(['bn', 'en']).default('bn')
      })
      .refine((v) => Boolean(v.serviceId || (v.providerId && v.categorySlug)), {
        message: 'Either a serviceId or a providerId with categorySlug must be provided.'
      })
  ),
  async (req, res, next) => {
    try {
      const d = req.validated;

      // Resolve service & provider info safely
      let svc = null;
      if (d.serviceId) {
        const svcRes = await query('SELECT * FROM services WHERE id = $1 AND is_active = TRUE', [d.serviceId]);
        if (!svcRes.rows.length) {
          return res.status(404).json({ error: 'Selected service not found.' });
        }
        svc = svcRes.rows[0];
      }

      const targetProviderId = d.providerId || svc?.provider_user_id || null;
      const targetCategorySlug = d.categorySlug || svc?.category_slug || 'other_services';

      let providerUser = null;
      let providerProf = null;
      if (targetProviderId) {
        const pRes = await query(
          `SELECT u.id, u.full_name, pp.is_approved, pp.approval_status, pp.is_available, pp.starting_price_inr
           FROM users u
           JOIN provider_profiles pp ON pp.user_id = u.id
           WHERE u.id = $1 LIMIT 1`,
          [targetProviderId]
        );
        if (!pRes.rows.length || !pRes.rows[0].is_approved || pRes.rows[0].approval_status !== 'approved') {
          return res.status(400).json({ error: 'Selected service provider is currently unavailable or not verified.' });
        }
        providerUser = pRes.rows[0];
        providerProf = pRes.rows[0];
      }

      let catRow = null;
      const catRes = await query('SELECT * FROM service_categories WHERE slug = $1 LIMIT 1', [targetCategorySlug]);
      catRow = catRes.rows[0] || null;

      const titleBn = svc?.title_bn || catRow?.name_bn || 'গৃহপরিষেবা বুকিং';
      const titleEn = svc?.title_en || catRow?.name_en || 'Service Booking';
      const provNameBn = providerUser?.full_name || svc?.provider_name_bn || 'কাজের মানুষ কর্মী';
      const provNameEn = providerUser?.full_name || svc?.provider_name_en || 'Kajer Manus Pro';
      const amountInr = svc?.base_price_inr ?? providerProf?.starting_price_inr ?? 299;

      const loc = await resolveLocationHierarchy({
        districtId: d.districtId,
        subdivisionId: d.subdivisionId,
        localBodyId: d.localBodyId,
        gpWardId: d.gpWardId,
        villageId: d.villageId,
        pincode: d.pincode
      });

      const booking = await withTransaction(async (client) => {
        // Prevent duplicate bookings (both idempotency key and active slot/provider/service guard)
        if (d.idempotencyKey) {
          const idemCheck = await client.query(
            `SELECT * FROM bookings WHERE customer_id = $1 AND idempotency_key = $2 LIMIT 1`,
            [req.user.id, d.idempotencyKey]
          );
          if (idemCheck.rows.length) {
            return idemCheck.rows[0];
          }
        }

        const dupCheck = await client.query(
          `SELECT id FROM bookings
           WHERE customer_id = $1
             AND category_slug = $2
             AND preferred_date = $3
             AND preferred_time = $4
             AND status IN ('pending', 'accepted', 'in_progress')
             AND (($5::uuid IS NOT NULL AND provider_id = $5) OR ($6::uuid IS NOT NULL AND service_id = $6))
           LIMIT 1`,
          [req.user.id, targetCategorySlug, d.preferredDate, d.preferredTime, targetProviderId, d.serviceId]
        );
        if (dupCheck.rows.length) {
          const err = new Error(
            'A booking for this service/provider on the same date and time slot is already active.'
          );
          err.status = 409;
          err.expose = true;
          throw err;
        }

        const inserted = await client.query(
          `INSERT INTO bookings (
             customer_id, provider_id, service_id, category_slug,
             service_title_bn, service_title_en, provider_name_bn, provider_name_en,
             customer_name, customer_phone, service_address,
             district_id, subdivision_id, local_body_id, gp_ward_id, village_id,
             pincode, latitude, longitude, problem_photos, idempotency_key,
             preferred_date, preferred_time, instructions, amount_inr,
             payment_method, payment_status, status, language_at_booking
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,
             $22,$23,$24,$25,$26,'unpaid','pending',$27
           )
           RETURNING *`,
          [
            req.user.id,
            targetProviderId,
            svc?.id || null,
            targetCategorySlug,
            titleBn,
            titleEn,
            provNameBn,
            provNameEn,
            d.customerName,
            d.customerPhone,
            d.serviceAddress,
            d.districtId,
            d.subdivisionId,
            d.localBodyId,
            d.gpWardId,
            d.villageId,
            d.pincode || loc.resolvedPincode || '',
            d.latitude ?? loc.centroidLat,
            d.longitude ?? loc.centroidLng,
            JSON.stringify(d.problemPhotos),
            d.idempotencyKey,
            d.preferredDate,
            d.preferredTime,
            d.instructions,
            amountInr,
            d.paymentMethod,
            d.languageAtBooking
          ]
        );
        return inserted.rows[0];
      });

      await createUserNotification({
        userId: req.user.id,
        titleBn: `বুকিং জমা হয়েছে: ${titleBn}`,
        titleEn: `Booking Submitted: ${titleEn}`,
        bodyBn: `আপনার ${titleBn} বুকিং (${d.preferredDate}) এখন অপেক্ষমান অবস্থায় আছে।`,
        bodyEn: `Your booking for ${titleEn} (${d.preferredDate}) is pending provider confirmation.`,
        bookingId: booking.id,
        type: 'booking_created',
        languageCode: d.languageAtBooking
      });

      if (targetProviderId) {
        await createUserNotification({
          userId: targetProviderId,
          titleBn: `নতুন কাজের অনুরোধ: ${titleBn}`,
          titleEn: `New Job Request: ${titleEn}`,
          bodyBn: `${d.customerName} (${d.preferredDate}) নতুন সেবা বুক করেছেন।`,
          bodyEn: `${d.customerName} requested ${titleEn} on ${d.preferredDate}.`,
          bookingId: booking.id,
          type: 'booking_created',
          languageCode: 'bn'
        });
      }

      res.status(201).json({ booking });
    } catch (err) {
      next(err);
    }
  }
);

router.get('/bookings/me', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn
       FROM bookings b
       LEFT JOIN wb_districts d ON d.id = b.district_id
       LEFT JOIN wb_local_bodies lb ON lb.id = b.local_body_id
       WHERE b.customer_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/provider', async (req, res, next) => {
  try {
    if (req.user.role !== 'provider' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Provider account required.' });
    }
    const provRes = await query('SELECT is_approved, approval_status FROM provider_profiles WHERE user_id = $1', [
      req.user.id
    ]);
    const prof = provRes.rows[0];
    if (req.user.role === 'provider' && (!prof || !prof.is_approved || prof.approval_status === 'suspended')) {
      return res.json({ bookings: [], approved: false, approvalStatus: prof?.approval_status || 'pending' });
    }
    const result = await query(
      `SELECT b.*,
              d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn
       FROM bookings b
       LEFT JOIN wb_districts d ON d.id = b.district_id
       LEFT JOIN wb_local_bodies lb ON lb.id = b.local_body_id
       WHERE b.provider_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bookings: result.rows, approved: true, approvalStatus: prof?.approval_status || 'approved' });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/bookings/:id/status',
  validateBody(
    z.object({
      status: z.enum(['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'])
    })
  ),
  async (req, res, next) => {
    try {
      const { status } = req.validated;
      const existingRes = await query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
      if (!existingRes.rows.length) return res.status(404).json({ error: 'Booking not found' });
      const booking = existingRes.rows[0];

      const isCustomer = booking.customer_id === req.user.id;
      const isProvider = booking.provider_id === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (status === 'cancelled') {
        if (!isCustomer && !isAdmin) return res.status(403).json({ error: 'Only customer or admin can cancel.' });
        if (!['pending', 'accepted'].includes(booking.status) && !isAdmin) {
          return res.status(400).json({ error: 'Only pending or accepted bookings can be cancelled.' });
        }
      } else {
        if (!isProvider && !isAdmin) {
          return res.status(403).json({ error: 'Only assigned provider or admin can update job status.' });
        }
        if (isProvider && !isAdmin) {
          const provCheck = await query(
            'SELECT is_approved, approval_status FROM provider_profiles WHERE user_id = $1',
            [req.user.id]
          );
          if (!provCheck.rows[0]?.is_approved || provCheck.rows[0]?.approval_status !== 'approved') {
            return res
              .status(403)
              .json({ error: 'Admin approval is required before accepting or managing public bookings.' });
          }
        }
      }

      const updated = await withTransaction(async (client) => {
        const resUp = await client.query(
          'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [status, booking.id]
        );
        if (status === 'completed' && booking.provider_id) {
          await client.query(
            'UPDATE provider_profiles SET completed_jobs = completed_jobs + 1, updated_at = NOW() WHERE user_id = $1',
            [booking.provider_id]
          );
        }
        return resUp.rows[0];
      });

      const msgMap = {
        accepted: ['আপনার বুকিং গ্রহণ করা হয়েছে।', 'Your booking has been accepted.'],
        rejected: ['আপনার বুকিং প্রত্যাখ্যান করা হয়েছে।', 'Your booking was declined by the provider.'],
        in_progress: ['কর্মী কাজ শুরু করেছেন।', 'Work on your booking is now in progress.'],
        completed: ['আপনার সেবা সম্পন্ন হয়েছে। অনুগ্রহ করে রিভিউ দিন।', 'Your service is completed. Please leave a review!'],
        cancelled: ['আপনার বুকিং বাতিল করা হয়েছে।', 'Your booking has been cancelled.']
      };
      const [bodyBn, bodyEn] = msgMap[status];

      await createUserNotification({
        userId: booking.customer_id,
        titleBn: booking.service_title_bn,
        titleEn: booking.service_title_en,
        bodyBn,
        bodyEn,
        bookingId: booking.id,
        type: 'booking_status',
        languageCode: booking.language_at_booking || 'bn'
      });

      if (status === 'cancelled' && booking.provider_id && booking.provider_id !== req.user.id) {
        await createUserNotification({
          userId: booking.provider_id,
          titleBn: booking.service_title_bn,
          titleEn: booking.service_title_en,
          bodyBn: `${booking.customer_name} বুকিংটি বাতিল করেছেন।`,
          bodyEn: `${booking.customer_name} cancelled this booking.`,
          bookingId: booking.id,
          type: 'booking_status',
          languageCode: 'bn'
        });
      }

      res.json({ booking: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/reviews',
  validateBody(
    z.object({
      bookingId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(800).default('')
    })
  ),
  async (req, res, next) => {
    try {
      const { bookingId, rating, comment } = req.validated;
      const bRes = await query('SELECT * FROM bookings WHERE id = $1 AND customer_id = $2', [
        bookingId,
        req.user.id
      ]);
      if (!bRes.rows.length) return res.status(404).json({ error: 'Booking not found' });
      const booking = bRes.rows[0];
      if (booking.status !== 'completed') {
        return res.status(400).json({ error: 'Only completed bookings can be reviewed.' });
      }

      const review = await withTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [bookingId, req.user.id, booking.provider_id, rating, comment]
        );
        if (booking.provider_id) {
          await client.query(
            `UPDATE provider_profiles
             SET reviews_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = $1 AND is_visible = TRUE),
                 rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE provider_id = $1 AND is_visible = TRUE), 5.00),
                 updated_at = NOW()
             WHERE user_id = $1`,
            [booking.provider_id]
          );
        }
        return inserted.rows[0];
      });

      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
