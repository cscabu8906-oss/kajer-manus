import admin from 'firebase-admin';
import { env } from './env.js';
import { query } from './db.js';

// Firebase Admin SDK is configured STRICTLY for Firebase Cloud Messaging (FCM) push delivery.
// Never used for Authentication, Firestore, or Storage.
let messagingInstance = null;

if (env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey
        })
      });
    }
    messagingInstance = admin.messaging();
    console.log('FCM push messaging initialized.');
  } catch (err) {
    console.warn('FCM initialization skipped:', err.message);
  }
}

export async function sendPushNotificationToUser(userId, { title, body, data = {} }) {
  if (!messagingInstance) return { sent: 0 };
  const res = await query(
    `SELECT dt.fcm_token, u.push_notifications_enabled
     FROM device_tokens dt
     JOIN users u ON u.id = dt.user_id
     WHERE dt.user_id = $1`,
    [userId]
  );

  const tokens = res.rows
    .filter((r) => r.push_notifications_enabled)
    .map((r) => r.fcm_token);

  if (!tokens.length) return { sent: 0 };

  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
  );

  const response = await messagingInstance.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringData
  });

  // Clean up invalid unregistered tokens
  const invalidTokens = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
      invalidTokens.push(tokens[idx]);
    }
  });
  if (invalidTokens.length) {
    await query('DELETE FROM device_tokens WHERE fcm_token = ANY($1::text[])', [invalidTokens]);
  }

  return { sent: response.successCount };
}
