import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createUserNotification } from '../utils/notifications.js';

const router = Router();

// Public contact form / support submission (supports authenticated or guest)
router.post('/support/contact', validateBody(z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  bookingId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(1500),
  languageCode: z.enum(['bn', 'en']).default('bn')
})), async (req, res, next) => {
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
});

router.use(requireAuth);

router.post('/bookings', validateBody(z.object({
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(20),
  serviceAddress: z.string().trim().min(4).max(400),
  preferredDate: z.string().trim().min(4).max(40),
  preferredTime: z.string().trim().min(2).max(60),
  instructions: z.string().trim().max(500).default(''),
  languageAtBooking: z.enum(['bn', 'en']).default('bn')
})), async (req, res, next) => {
  try {
    const d = req.validated;
    const svcRes = await query('SELECT * FROM services WHERE id = $1 AND is_active = TRUE', [d.serviceId]);
    if (!svcRes.rows.length) {
      return res.status(404).json({ error: 'Selected service not found.' });
    }
    const svc = svcRes.rows[0];

    const booking = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO bookings (
           customer_id, provider_id, service_id, category_slug,
           service_title_bn, service_title_en, provider_name_bn, provider_name_en,
           customer_name, customer_phone, service_address, preferred_date, preferred_time,
           instructions, amount_inr, status, language_at_booking
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending',$16)
         RETURNING *`,
        [
          req.user.id, svc.provider_user_id, svc.id, svc.category_slug,
          svc.title_bn, svc.title_en, svc.provider_name_bn, svc.provider_name_en,
          d.customerName, d.customerPhone, d.serviceAddress, d.preferredDate, d.preferredTime,
          d.instructions, svc.base_price_inr, d.languageAtBooking
        ]
      );
      return inserted.rows[0];
    });

    await createUserNotification({
      userId: req.user.id,
      titleBn: `বুকিং জমা হয়েছে: ${svc.title_bn}`,
      titleEn: `Booking Submitted: ${svc.title_en}`,
      bodyBn: `আপনার ${svc.title_bn} বুকিং (${d.preferredDate}) এখন অপেক্ষমান অবস্থায় আছে।`,
      bodyEn: `Your booking for ${svc.title_en} (${d.preferredDate}) is pending provider confirmation.`,
      bookingId: booking.id,
      type: 'booking_created',
      languageCode: d.languageAtBooking
    });

    if (svc.provider_user_id) {
      await createUserNotification({
        userId: svc.provider_user_id,
        titleBn: `নতুন কাজের অনুরোধ: ${svc.title_bn}`,
        titleEn: `New Job Request: ${svc.title_en}`,
        bodyBn: `${d.customerName} (${d.preferredDate}) নতুন সেবা বুক করেছেন।`,
        bodyEn: `${d.customerName} requested ${svc.title_en} on ${d.preferredDate}.`,
        bookingId: booking.id,
        type: 'booking_created',
        languageCode: 'bn'
      });
    }

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

router.get('/bookings/me', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review
       FROM bookings b
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
    const provRes = await query('SELECT is_approved FROM provider_profiles WHERE user_id = $1', [req.user.id]);
    if (req.user.role === 'provider' && (!provRes.rows.length || !provRes.rows[0].is_approved)) {
      return res.json({ bookings: [], approved: false });
    }
    const result = await query(
      'SELECT * FROM bookings WHERE provider_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ bookings: result.rows, approved: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/bookings/:id/status', validateBody(z.object({
  status: z.enum(['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'])
})), async (req, res, next) => {
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
        const provCheck = await query('SELECT is_approved FROM provider_profiles WHERE user_id = $1', [req.user.id]);
        if (!provCheck.rows[0]?.is_approved) {
          return res.status(403).json({ error: 'Admin approval is required before accepting or managing public bookings.' });
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

    res.json({ booking: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/reviews', validateBody(z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(800).default('')
})), async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.validated;
    const bRes = await query('SELECT * FROM bookings WHERE id = $1 AND customer_id = $2', [bookingId, req.user.id]);
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
});

export default router;
