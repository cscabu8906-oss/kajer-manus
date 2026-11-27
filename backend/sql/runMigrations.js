import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running non-destructive migration 001_initial_schema.sql...');
  await pool.query(sql);
  console.log('Migration complete.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
