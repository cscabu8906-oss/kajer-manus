import { env } from '../config/env.js';

export function isSmsConfigured() {
  return Boolean(env.sms.providerUrl && env.sms.apiKey);
}

/**
 * Dispatches an OTP via configured SMS webhook gateway (POST JSON: { to, message, otp, senderId }).
 * Supports standard Indian SMS HTTP webhooks / Twilio / Fast2SMS / MSG91 proxy endpoints.
 */
export async function sendMobileOtpSms({ mobileNumber, otp, lang = 'bn' }) {
  if (!isSmsConfigured()) {
    const err = new Error(
      'SMS OTP service is not configured on the server (set SMS_PROVIDER_URL and SMS_API_KEY in backend .env).'
    );
    err.status = 503;
    err.expose = true;
    throw err;
  }

  const normalizedMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
  const message =
    lang === 'en'
      ? `Your Kajer Manus verification OTP is ${otp}. Valid for 10 minutes. Do not share it.`
      : `কাজের মানুষ যাচাইকরণ ওটিপি: ${otp}। এটি ১০ মিনিটের জন্য বৈধ। কারো সাথে শেয়ার করবেন না।`;

  const response = await fetch(env.sms.providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.sms.apiKey}`,
      'x-api-key': env.sms.apiKey
    },
    body: JSON.stringify({
      to: normalizedMobile,
      countryCode: '91',
      senderId: env.sms.senderId,
      otp,
      message
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`SMS gateway error (${response.status}): ${detail.slice(0, 120)}`);
    err.status = 502;
    err.expose = true;
    throw err;
  }
}
