import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

import { seedWbLocations } from '../scripts/seed-wb-locations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrapAdminFromEnv() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  if (!email || !email.includes('@')) return;

  const existing = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);
  if (existing.rows.length) {
    if (existing.rows[0].role !== 'admin') {
      await pool.query(`UPDATE users SET role = 'admin', is_verified = TRUE, updated_at = NOW() WHERE id = $1`, [existing.rows[0].id]);
      console.log(`Promoted INITIAL_ADMIN_EMAIL (${email}) to admin.`);
    }
  } else if (password && password.length >= 8 && !password.includes('CHANGE_ME')) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (full_name, email, mobile_number, full_address, password_hash, role, is_verified, language_preference, bengali_numerals)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE, 'bn', TRUE)`,
      ['Kajer Manus Admin', email, '9000000000', 'Kolkata, West Bengal', hash]
    );
    console.log(`Created INITIAL_ADMIN_EMAIL (${email}) admin user.`);
  }
}

async function run() {
  const migrations = ['001_initial_schema.sql', '002_wb_locations_and_smart_booking.sql'];
  for (const file of migrations) {
    const sqlPath = path.join(__dirname, file);
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running non-destructive migration ${file}...`);
    await pool.query(sql);
  }
  await seedWbLocations();
  await bootstrapAdminFromEnv();
  console.log('All non-destructive migrations & WB location seeds complete.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
