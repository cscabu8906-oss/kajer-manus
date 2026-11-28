import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool } from '../src/config/db.js';

async function main() {
  const emailArg = (process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const passArg = (process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  const nameArg = (process.argv[4] || 'Kajer Manus Admin').trim();
  const mobileArg = (process.argv[5] || '9000000000').trim();

  if (!emailArg || !emailArg.includes('@')) {
    console.error('Usage: npm run create-admin -- <admin-email> [password] [full-name]');
    process.exit(1);
  }

  const existing = await pool.query('SELECT id, email, role FROM users WHERE LOWER(email) = $1 LIMIT 1', [emailArg]);
  if (existing.rows.length) {
    if (passArg && passArg.length >= 8) {
      const hash = await bcrypt.hash(passArg, 12);
      await pool.query(
        `UPDATE users SET role = 'admin', is_verified = TRUE, password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [hash, existing.rows[0].id]
      );
      console.log(`Promoted ${emailArg} to admin and updated password.`);
    } else {
      await pool.query(
        `UPDATE users SET role = 'admin', is_verified = TRUE, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      console.log(`Promoted existing user ${emailArg} to admin.`);
    }
  } else {
    if (!passArg || passArg.length < 8) {
      console.error(`Account ${emailArg} does not exist yet. Provide a password (min 8 chars):`);
      console.error(`  npm run create-admin -- ${emailArg} "YourStrongPassword123"`);
      process.exit(1);
    }
    const hash = await bcrypt.hash(passArg, 12);
    await pool.query(
      `INSERT INTO users (full_name, email, mobile_number, full_address, password_hash, role, is_verified, language_preference, bengali_numerals)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE, 'bn', TRUE)`,
      [nameArg, emailArg, mobileArg, 'Kolkata, West Bengal', hash]
    );
    console.log(`Created new admin account: ${emailArg}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create/promote admin:', err);
  process.exit(1);
});
