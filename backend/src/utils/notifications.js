import { query } from '../config/db.js';
import { sendPushNotificationToUser } from '../config/fcm.js';

export async function createUserNotification({
  userId,
  titleBn,
  titleEn,
  bodyBn,
  bodyEn,
  bookingId = null,
  type = 'system',
  languageCode = 'bn'
}) {
  const result = await query(
    `INSERT INTO notifications (user_id, title_bn, title_en, body_bn, body_en, booking_id, type, language_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, titleBn, titleEn, bodyBn, bodyEn, bookingId, type, languageCode]
  );

  try {
    const userPref = await query('SELECT language_preference FROM users WHERE id = $1', [userId]);
    const lang = userPref.rows[0]?.language_preference || languageCode;
    await sendPushNotificationToUser(userId, {
      title: lang === 'bn' ? titleBn : titleEn,
      body: lang === 'bn' ? bodyBn : bodyEn,
      data: { type, bookingId: bookingId || '' }
    });
  } catch (err) {
    console.warn('Push notification dispatch skipped:', err.message);
  }

  return result.rows[0];
}
