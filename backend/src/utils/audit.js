import { query } from '../config/db.js';

export async function recordAuditLog({ actorUserId = null, action, targetType, targetId = '', ipAddress = '', details = {} }) {
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [actorUserId, action, targetType, String(targetId || ''), String(ipAddress || ''), JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}
