import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'wb');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

async function batchUpsert(client, table, cols, rows, conflictCol, updateSet = '') {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params = [];
    const valuesSql = chunk.map((row) => {
      const placeholders = cols.map((_, idx) => {
        params.push(row[idx]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const conflictClause = updateSet
      ? `ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateSet}`
      : `ON CONFLICT (${conflictCol}) DO NOTHING`;
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${valuesSql.join(', ')} ${conflictClause}`;
    await client.query(sql, params);
  }
}

export async function seedWbLocations(existingClient = null) {
  if (!fs.existsSync(DATA_DIR)) {
    console.warn('WB data directory not found, skipping location seed:', DATA_DIR);
    return;
  }
  const client = existingClient || (await pool.connect());
  const shouldRelease = !existingClient;
  try {
    const districts = readJson('districts.json');
    const subdivisions = readJson('subdivisions.json');
    const localBodies = readJson('local_bodies.json');
    const gpWards = readJson('gp_wards.json');
    const villages = readJson('villages.json');
    const pincodes = readJson('pincodes.json');

    await client.query('BEGIN');

    await batchUpsert(
      client,
      'wb_districts',
      ['code', 'lgd_code', 'state_code', 'name_en', 'name_bn', 'latitude', 'longitude'],
      districts.map((d) => [d.code, d.lgd_code || d.code, d.state_code || '19', d.name_en, d.name_bn, d.lat, d.lng]),
      'code'
    );
    const dRes = await client.query('SELECT id, code FROM wb_districts');
    const distIdByCode = new Map(dRes.rows.map((r) => [r.code, r.id]));

    await batchUpsert(
      client,
      'wb_subdivisions',
      ['code', 'district_id', 'district_code', 'name_en', 'name_bn', 'latitude', 'longitude'],
      subdivisions
        .filter((s) => distIdByCode.has(s.district_code))
        .map((s) => [s.code, distIdByCode.get(s.district_code), s.district_code, s.name_en, s.name_bn, s.lat, s.lng]),
      'code'
    );
    const sRes = await client.query('SELECT id, code FROM wb_subdivisions');
    const subIdByCode = new Map(sRes.rows.map((r) => [r.code, r.id]));

    await batchUpsert(
      client,
      'wb_local_bodies',
      ['code', 'lgd_code', 'district_id', 'subdivision_id', 'area_type', 'body_type', 'name_en', 'name_bn', 'pincodes', 'latitude', 'longitude'],
      localBodies
        .filter((l) => distIdByCode.has(l.district_code))
        .map((l) => [
          l.code,
          l.lgd_code || '',
          distIdByCode.get(l.district_code),
          subIdByCode.get(l.subdivision_code) || null,
          l.area_type,
          l.body_type,
          l.name_en,
          l.name_bn,
          JSON.stringify(l.pincodes || []),
          l.lat,
          l.lng
        ]),
      'code'
    );
    const lbRes = await client.query('SELECT id, code FROM wb_local_bodies');
    const lbIdByCode = new Map(lbRes.rows.map((r) => [r.code, r.id]));

    await batchUpsert(
      client,
      'wb_gp_wards',
      ['code', 'lgd_code', 'district_id', 'subdivision_id', 'local_body_id', 'unit_type', 'ward_number', 'name_en', 'name_bn', 'pincode', 'latitude', 'longitude'],
      gpWards
        .filter((g) => distIdByCode.has(g.district_code) && lbIdByCode.has(g.local_body_id ? g.local_body_id : g.local_body_code))
        .map((g) => [
          g.code,
          g.lgd_code || '',
          distIdByCode.get(g.district_code),
          subIdByCode.get(g.subdivision_code) || null,
          lbIdByCode.get(g.local_body_code),
          g.unit_type,
          g.ward_number || null,
          g.name_en,
          g.name_bn,
          g.pincode || null,
          g.lat,
          g.lng
        ]),
      'code'
    );
    const gwRes = await client.query('SELECT id, code FROM wb_gp_wards');
    const gwIdByCode = new Map(gwRes.rows.map((r) => [r.code, r.id]));

    // Deduplicate village codes safely before batch upsert
    const seenVilCodes = new Set();
    const cleanVillages = [];
    for (const v of villages) {
      if (!v.code || seenVilCodes.has(v.code)) continue;
      if (!distIdByCode.has(v.district_code) || !lbIdByCode.has(v.local_body_code)) continue;
      seenVilCodes.add(v.code);
      cleanVillages.push([
        v.code,
        v.lgd_code || null,
        distIdByCode.get(v.district_code),
        subIdByCode.get(v.subdivision_code) || null,
        lbIdByCode.get(v.local_body_code),
        gwIdByCode.get(v.gp_ward_code) || null,
        v.locality_type || 'village',
        v.name_en,
        v.name_bn,
        v.pincode || null,
        v.lat,
        v.lng
      ]);
    }
    await batchUpsert(
      client,
      'wb_villages',
      ['code', 'lgd_code', 'district_id', 'subdivision_id', 'local_body_id', 'gp_ward_id', 'locality_type', 'name_en', 'name_bn', 'pincode', 'latitude', 'longitude'],
      cleanVillages,
      'code'
    );
    const vRes = await client.query('SELECT id, code FROM wb_villages');
    const vIdByCode = new Map(vRes.rows.map((r) => [r.code, r.id]));

    await batchUpsert(
      client,
      'wb_pincodes',
      ['pincode', 'district_id', 'subdivision_id', 'local_body_id', 'gp_ward_id', 'village_id', 'latitude', 'longitude'],
      pincodes
        .filter((p) => p.pincode && distIdByCode.has(p.district_code))
        .map((p) => [
          p.pincode,
          distIdByCode.get(p.district_code) || null,
          subIdByCode.get(p.subdivision_code) || null,
          lbIdByCode.get(p.local_body_code) || null,
          gwIdByCode.get(p.gp_ward_code) || null,
          vIdByCode.get(p.village_code) || null,
          p.lat,
          p.lng
        ]),
      'pincode'
    );

    await client.query('COMMIT');
    console.log(
      `WB Location Seed complete: ${districts.length} districts, ${subdivisions.length} subdivisions, ` +
      `${localBodies.length} blocks/ULBs, ${gpWards.length} GPs/wards, ${cleanVillages.length} villages/localities, ${pincodes.length} PINs.`
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (shouldRelease) client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-wb-locations.js')) {
  seedWbLocations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('WB Location Seed failed:', err);
      process.exit(1);
    });
}
