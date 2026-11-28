import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createUserNotification } from '../utils/notifications.js';
import { recordAuditLog } from '../utils/audit.js';

const router = Router();

function getRazorpayAuthHeader() {
  const token = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function isRazorpayConfigured() {
  return Boolean(env.razorpay.keyId && env.razorpay.keySecret);
}

function timingSafeHexEqual(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex || ''), 'utf8');
    const b = Buffer.from(String(bHex || ''), 'utf8');
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

router.get('/config', (_req, res) => {
  res.json({
    configured: isRazorpayConfigured(),
    keyId: isRazorpayConfigured() ? env.razorpay.keyId : ''
  });
});

router.post('/razorpay/order', requireAuth, validateBody(z.object({
  bookingId: z.string().uuid()
})), async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: 'Online payments via Razorpay are not configured on the server yet. Please choose Cash After Service or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      });
    }

    const { bookingId } = req.validated;
    const bRes = await query('SELECT * FROM bookings WHERE id = $1 LIMIT 1', [bookingId]);
    if (!bRes.rows.length) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    const booking = bRes.rows[0];

    if (booking.customer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to pay for this booking.' });
    }
    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({ error: 'Cancelled or rejected bookings cannot be paid.' });
    }
    if (booking.payment_status === 'paid') {
      return res.status(400).json({ error: 'This booking is already paid.' });
    }

    const amountInr = Number(booking.amount_inr || 0);
    if (amountInr <= 0) {
      return res.status(400).json({ error: 'Booking amount must be greater than zero.' });
    }
    const amountPaise = Math.round(amountInr * 100);
    const receipt = `km_${booking.id.replace(/-/g, '').slice(0, 32)}`;

    const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: getRazorpayAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes: {
          booking_id: booking.id,
          customer_id: booking.customer_id
        }
      })
    });

    const rzpData = await rzpResp.json().catch(() => ({}));
    if (!rzpResp.ok || !rzpData.id) {
      const msg = rzpData?.error?.description || 'Failed to initialize Razorpay order.';
      return res.status(502).json({ error: msg });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO payments (booking_id, user_id, gateway, razorpay_order_id, amount_paise, currency, status)
         VALUES ($1, $2, 'razorpay', $3, $4, $5, 'created')
         ON CONFLICT (razorpay_order_id) DO NOTHING`,
        [booking.id, booking.customer_id, rzpData.id, amountPaise, rzpData.currency || 'INR']
      );
      await client.query(
        `UPDATE bookings
         SET payment_method = 'razorpay',
             payment_status = 'pending',
             razorpay_order_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [rzpData.id, booking.id]
      );
    });

    res.json({
      keyId: env.razorpay.keyId,
      orderId: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency || 'INR',
      bookingId: booking.id,
      serviceName: booking.service_title_en || booking.service_title_bn,
      prefill: {
        name: booking.customer_name || req.user.full_name,
        email: req.user.email,
        contact: booking.customer_phone || req.user.mobile_number
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/razorpay/verify', requireAuth, validateBody(z.object({
  bookingId: z.string().uuid(),
  razorpayOrderId: z.string().trim().min(5).max(80),
  razorpayPaymentId: z.string().trim().min(5).max(80),
  razorpaySignature: z.string().trim().min(16).max(256)
})), async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ error: 'Razorpay is not configured on the server.' });
    }

    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.validated;
    const bRes = await query('SELECT * FROM bookings WHERE id = $1 LIMIT 1', [bookingId]);
    if (!bRes.rows.length) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    const booking = bRes.rows[0];

    if (booking.customer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to verify payment for this booking.' });
    }

    const orderCheck = await query(
      'SELECT id FROM payments WHERE booking_id = $1 AND razorpay_order_id = $2 LIMIT 1',
      [booking.id, razorpayOrderId]
    );
    if (!orderCheck.rows.length && booking.razorpay_order_id !== razorpayOrderId) {
      return res.status(400).json({ error: 'Order ID does not match this booking.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (!timingSafeHexEqual(expectedSignature, razorpaySignature)) {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE payments
           SET status = 'failed', failure_reason = 'Signature mismatch', updated_at = NOW()
           WHERE razorpay_order_id = $1`,
          [razorpayOrderId]
        );
        await client.query(
          `UPDATE bookings
           SET payment_status = 'failed', updated_at = NOW()
           WHERE id = $1 AND payment_status <> 'paid'`,
          [booking.id]
        );
      });
      await recordAuditLog({
        actorUserId: req.user.id,
        action: 'RAZORPAY_SIGNATURE_INVALID',
        targetType: 'booking',
        targetId: booking.id,
        ipAddress: req.ip,
        details: { razorpayOrderId }
      });
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    const updatedBooking = await withTransaction(async (client) => {
      await client.query(
        `UPDATE payments
         SET status = 'paid',
             razorpay_payment_id = $1,
             razorpay_signature = $2,
             failure_reason = '',
             updated_at = NOW()
         WHERE razorpay_order_id = $3`,
        [razorpayPaymentId, razorpaySignature, razorpayOrderId]
      );
      const resBooking = await client.query(
        `UPDATE bookings
         SET payment_method = 'razorpay',
             payment_status = 'paid',
             razorpay_order_id = $1,
             razorpay_payment_id = $2,
             paid_at = COALESCE(paid_at, NOW()),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [razorpayOrderId, razorpayPaymentId, booking.id]
      );
      return resBooking.rows[0];
    });

    await createUserNotification({
      userId: booking.customer_id,
      titleBn: `পেমেন্ট সফল হয়েছে: ${booking.service_title_bn}`,
      titleEn: `Payment Successful: ${booking.service_title_en}`,
      bodyBn: `Razorpay-এর মাধ্যমে ₹${booking.amount_inr} পেমেন্ট সফলভাবে সম্পন্ন হয়েছে।`,
      bodyEn: `Your Razorpay payment of ₹${booking.amount_inr} was verified successfully.`,
      bookingId: booking.id,
      type: 'payment_status',
      languageCode: booking.language_at_booking || 'bn'
    });

    if (booking.provider_id) {
      await createUserNotification({
        userId: booking.provider_id,
        titleBn: `গ্রাহকের পেমেন্ট সম্পন্ন: ${booking.service_title_bn}`,
        titleEn: `Booking Paid Online: ${booking.service_title_en}`,
        bodyBn: `${booking.customer_name} ₹${booking.amount_inr} অনলাইনে পরিশোধ করেছেন।`,
        bodyEn: `${booking.customer_name} completed online payment of ₹${booking.amount_inr}.`,
        bookingId: booking.id,
        type: 'payment_status',
        languageCode: 'bn'
      });
    }

    await recordAuditLog({
      actorUserId: req.user.id,
      action: 'RAZORPAY_PAYMENT_VERIFIED',
      targetType: 'booking',
      targetId: booking.id,
      ipAddress: req.ip,
      details: { razorpayOrderId, razorpayPaymentId, amountInr: booking.amount_inr }
    });

    res.json({ verified: true, booking: updatedBooking });
  } catch (err) {
    next(err);
  }
});

router.post('/razorpay/webhook', async (req, res, next) => {
  try {
    if (!env.razorpay.webhookSecret) {
      return res.status(503).json({ error: 'Razorpay webhook secret not configured.' });
    }
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody;
    if (!signature || !rawBody) {
      return res.status(400).json({ error: 'Missing webhook signature or payload.' });
    }

    const expected = crypto
      .createHmac('sha256', env.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeHexEqual(expected, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;
    const refundEntity = req.body?.payload?.refund?.entity;
    const orderId = paymentEntity?.order_id || '';
    const paymentId = paymentEntity?.id || refundEntity?.payment_id || '';

    if ((event === 'payment.captured' || event === 'order.paid') && orderId) {
      await withTransaction(async (client) => {
        const payRes = await client.query(
          `UPDATE payments
           SET status = 'paid',
               razorpay_payment_id = COALESCE(NULLIF($1, ''), razorpay_payment_id),
               updated_at = NOW()
           WHERE razorpay_order_id = $2
           RETURNING booking_id`,
          [paymentId, orderId]
        );
        const bookingId = payRes.rows[0]?.booking_id;
        if (bookingId) {
          await client.query(
            `UPDATE bookings
             SET payment_method = 'razorpay',
                 payment_status = 'paid',
                 razorpay_order_id = $1,
                 razorpay_payment_id = COALESCE(NULLIF($2, ''), razorpay_payment_id),
                 paid_at = COALESCE(paid_at, NOW()),
                 updated_at = NOW()
             WHERE id = $3`,
            [orderId, paymentId, bookingId]
          );
        }
      });
    } else if (event === 'payment.failed' && orderId) {
      const reason = paymentEntity?.error_description || 'Payment failed';
      await withTransaction(async (client) => {
        const payRes = await client.query(
          `UPDATE payments
           SET status = 'failed', failure_reason = $1, updated_at = NOW()
           WHERE razorpay_order_id = $2 AND status <> 'paid'
           RETURNING booking_id`,
          [reason, orderId]
        );
        const bookingId = payRes.rows[0]?.booking_id;
        if (bookingId) {
          await client.query(
            `UPDATE bookings
             SET payment_status = 'failed', updated_at = NOW()
             WHERE id = $1 AND payment_status <> 'paid'`,
            [bookingId]
          );
        }
      });
    } else if (event === 'refund.processed' && paymentId) {
      await withTransaction(async (client) => {
        const payRes = await client.query(
          `UPDATE payments
           SET status = 'refunded', updated_at = NOW()
           WHERE razorpay_payment_id = $1
           RETURNING booking_id`,
          [paymentId]
        );
        const bookingId = payRes.rows[0]?.booking_id;
        if (bookingId) {
          await client.query(
            `UPDATE bookings
             SET payment_status = 'refunded', updated_at = NOW()
             WHERE id = $1`,
            [bookingId]
          );
        }
      });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;
