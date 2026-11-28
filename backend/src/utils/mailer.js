import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  const pass = env.smtp.pass;
  const hasRealPass = Boolean(pass && !pass.includes('CHANGE_ME'));
  if (!transporter && env.smtp.host && env.smtp.user && hasRealPass) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      tls: {
        minVersion: 'TLSv1.2'
      },
      auth: {
        user: env.smtp.user,
        pass
      }
    });
  }
  return transporter;
}

export async function sendOtpEmail({ to, code, purpose, language = 'bn' }) {
  const isBn = language === 'bn';
  const subject =
    purpose === 'password_reset'
      ? isBn
        ? 'কাজের মানুষ — পাসওয়ার্ড রিসেট ওটিপি'
        : 'Kajer Manus — Password Reset OTP'
      : isBn
      ? 'কাজের মানুষ — ইমেল যাচাইকরণ ওটিপি'
      : 'Kajer Manus — Email Verification OTP';

  const html = isBn
    ? `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
         <h2 style="color:#0F5C4D;margin-top:0;">কাজের মানুষ (Kajer Manus)</h2>
         <p>${purpose === 'password_reset' ? 'আপনার পাসওয়ার্ড রিসেট করার জন্য নিচের ওটিপি কোডটি ব্যবহার করুন:' : 'আপনার অ্যাকাউন্ট যাচাই করতে নিচের ৬ সংখ্যার ওটিপি কোডটি দিন:'}</p>
         <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1D4ED8;padding:16px;background:#f8fafc;text-align:center;border-radius:8px;">${code}</div>
         <p style="color:#64748b;font-size:13px;margin-top:16px;">এই কোডটি ১০ মিনিটের জন্য বৈধ। নিরাপত্তার জন্য এটি কারো সাথে শেয়ার করবেন না।</p>
       </div>`
    : `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
         <h2 style="color:#0F5C4D;margin-top:0;">Kajer Manus</h2>
         <p>${purpose === 'password_reset' ? 'Use the verification code below to reset your password:' : 'Enter the 6-digit OTP below to verify your email address:'}</p>
         <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1D4ED8;padding:16px;background:#f8fafc;text-align:center;border-radius:8px;">${code}</div>
         <p style="color:#64748b;font-size:13px;margin-top:16px;">This code is valid for 10 minutes. Never share it with anyone.</p>
       </div>`;

  const mailer = getTransporter();
  if (!mailer) {
    const err = new Error('Hostinger SMTP email service is not configured in backend/.env (set SMTP_HOST, SMTP_USER, and SMTP_PASS).');
    err.status = 503;
    err.expose = true;
    throw err;
  }

  try {
    await mailer.sendMail({
      from: env.smtp.from,
      to,
      subject,
      html
    });
    return { delivered: true };
  } catch (smtpErr) {
    console.error('SMTP sendMail error:', {
      code: smtpErr?.code,
      responseCode: smtpErr?.responseCode,
      command: smtpErr?.command,
      message: smtpErr?.message
    });
    let safeMessage = `Failed to send OTP email via ${env.smtp.host}:${env.smtp.port} (${smtpErr?.code || smtpErr?.responseCode || 'SMTP_ERROR'}).`;
    if (smtpErr?.code === 'EAUTH' || smtpErr?.responseCode === 535) {
      safeMessage = 'Hostinger SMTP authentication failed (535). Verify SMTP_USER and SMTP_PASS in backend/.env.';
    } else if (smtpErr?.responseCode === 553 || smtpErr?.responseCode === 550 || smtpErr?.code === 'EENVELOPE') {
      safeMessage = 'Hostinger SMTP rejected sender address. Ensure SMTP_FROM matches SMTP_USER in backend/.env.';
    } else if (['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ESOCKET'].includes(smtpErr?.code)) {
      safeMessage = `Cannot reach Hostinger SMTP server (${env.smtp.host}:${env.smtp.port}). Check firewall or try port 587/465.`;
    }
    const err = new Error(safeMessage);
    err.status = 502;
    err.expose = true;
    throw err;
  }
}
