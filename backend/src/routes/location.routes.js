import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

export async function resolveLocationHierarchy({
  districtId,
  subdivisionId,
  localBodyId,
  gpWardId,
  villageId,
  pincode
}) {
  const result = {
    district: null,
    subdivision: null,
    localBody: null,
    gpWard: null,
    village: null,
    areaLabelEn: '',
    areaLabelBn: '',
    centroidLat: null,
    centroidLng: null,
    resolvedPincode: pincode ? String(pincode).trim() : ''
  };

  if (districtId) {
    const r = await query('SELECT * FROM wb_districts WHERE id = $1 LIMIT 1', [districtId]);
    result.district = r.rows[0] || null;
  }
  if (subdivisionId) {
    const r = await query('SELECT * FROM wb_subdivisions WHERE id = $1 LIMIT 1', [subdivisionId]);
    result.subdivision = r.rows[0] || null;
  }
  if (localBodyId) {
    const r = await query('SELECT * FROM wb_local_bodies WHERE id = $1 LIMIT 1', [localBodyId]);
    result.localBody = r.rows[0] || null;
  }
  if (gpWardId) {
    const r = await query('SELECT * FROM wb_gp_wards WHERE id = $1 LIMIT 1', [gpWardId]);
    result.gpWard = r.rows[0] || null;
  }
  if (villageId) {
    const r = await query('SELECT * FROM wb_villages WHERE id = $1 LIMIT 1', [villageId]);
    result.village = r.rows[0] || null;
  }

  const enParts = [
    result.village?.name_en,
    result.gpWard?.name_en,
    result.localBody?.name_en,
    result.subdivision?.name_en,
    result.district?.name_en
  ].filter(Boolean);
  const bnParts = [
    result.village?.name_bn,
    result.gpWard?.name_bn,
    result.localBody?.name_bn,
    result.subdivision?.name_bn,
    result.district?.name_bn
  ].filter(Boolean);

  result.areaLabelEn = enParts.join(', ');
  result.areaLabelBn = bnParts.join(', ');

  if (!result.resolvedPincode) {
    result.resolvedPincode =
      result.village?.pincode ||
      result.gpWard?.pincode ||
      (Array.isArray(result.localBody?.pincodes) ? result.localBody.pincodes[0] : '') ||
      '';
  }

  const coordSource =
    [result.village, result.gpWard, result.localBody, result.subdivision, result.district].find(
      (x) => x && Number.isFinite(x.latitude) && Number.isFinite(x.longitude)
    ) || null;

  if (coordSource) {
    result.centroidLat = coordSource.latitude;
    result.centroidLng = coordSource.longitude;
  } else if (result.resolvedPincode) {
    const pRes = await query('SELECT latitude, longitude FROM wb_pincodes WHERE pincode = $1 LIMIT 1', [
      result.resolvedPincode
    ]);
    if (pRes.rows.length) {
      result.centroidLat = pRes.rows[0].latitude;
      result.centroidLng = pRes.rows[0].longitude;
    }
  }

  return result;
}

router.get('/states', (_req, res) => {
  res.json({
    states: [{ code: '19', name_en: 'West Bengal', name_bn: 'পশ্চিমবঙ্গ' }]
  });
});

router.get('/districts', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT id, code, lgd_code, state_code, name_en, name_bn, latitude, longitude, is_active
       FROM wb_districts
       WHERE is_active = TRUE
       ORDER BY name_en ASC`
    );
    res.json({ districts: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/subdivisions', async (req, res, next) => {
  try {
    const { districtId } = req.query;
    if (!districtId) {
      return res.json({ subdivisions: [] });
    }
    const result = await query(
      `SELECT id, code, district_id, district_code, name_en, name_bn, latitude, longitude, is_active
       FROM wb_subdivisions
       WHERE district_id = $1 AND is_active = TRUE
       ORDER BY name_en ASC`,
      [districtId]
    );
    res.json({ subdivisions: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/local-bodies', async (req, res, next) => {
  try {
    const { districtId, subdivisionId, areaType } = req.query;
    const params = [];
    const conditions = ['is_active = TRUE'];

    if (districtId) {
      params.push(districtId);
      conditions.push(`district_id = $${params.length}`);
    }
    if (subdivisionId) {
      params.push(subdivisionId);
      conditions.push(`subdivision_id = $${params.length}`);
    }
    if (areaType === 'urban' || areaType === 'rural') {
      params.push(areaType);
      conditions.push(`area_type = $${params.length}`);
    }
    if (!districtId && !subdivisionId) {
      return res.json({ localBodies: [] });
    }

    const result = await query(
      `SELECT id, code, lgd_code, district_id, subdivision_id, area_type, body_type,
              name_en, name_bn, pincodes, latitude, longitude, is_active
       FROM wb_local_bodies
       WHERE ${conditions.join(' AND ')}
       ORDER BY name_en ASC`,
      params
    );
    res.json({ localBodies: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/gp-wards', async (req, res, next) => {
  try {
    const { localBodyId, unitType } = req.query;
    if (!localBodyId) {
      return res.json({ gpWards: [] });
    }
    const params = [localBodyId];
    const conditions = ['local_body_id = $1', 'is_active = TRUE'];
    if (unitType === 'gp' || unitType === 'ward') {
      params.push(unitType);
      conditions.push(`unit_type = $${params.length}`);
    }
    const result = await query(
      `SELECT id, code, lgd_code, district_id, subdivision_id, local_body_id, unit_type,
              ward_number, name_en, name_bn, pincode, latitude, longitude, is_active
       FROM wb_gp_wards
       WHERE ${conditions.join(' AND ')}
       ORDER BY NULLIF(regexp_replace(COALESCE(ward_number, ''), '\\D', '', 'g'), '')::int NULLS LAST,
                name_en ASC`,
      params
    );
    res.json({ gpWards: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/villages', async (req, res, next) => {
  try {
    const { gpWardId, localBodyId, q, limit } = req.query;
    if (!gpWardId && !localBodyId) {
      return res.json({ villages: [] });
    }
    const params = [];
    const conditions = ['is_active = TRUE'];
    if (gpWardId) {
      params.push(gpWardId);
      conditions.push(`gp_ward_id = $${params.length}`);
    } else if (localBodyId) {
      params.push(localBodyId);
      conditions.push(`local_body_id = $${params.length}`);
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(`(name_en ILIKE $${idx} OR name_bn ILIKE $${idx} OR pincode ILIKE $${idx})`);
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 250, 1), 500);
    params.push(safeLimit);

    const result = await query(
      `SELECT id, code, lgd_code, district_id, subdivision_id, local_body_id, gp_ward_id,
              locality_type, name_en, name_bn, pincode, latitude, longitude, is_active
       FROM wb_villages
       WHERE ${conditions.join(' AND ')}
       ORDER BY name_en ASC
       LIMIT $${params.length}`,
      params
    );
    res.json({ villages: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/by-pincode/:pincode', async (req, res, next) => {
  try {
    const pin = String(req.params.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Valid 6-digit West Bengal PIN code required.' });
    }
    const pinRes = await query('SELECT * FROM wb_pincodes WHERE pincode = $1 LIMIT 1', [pin]);
    const vilRes = await query(
      `SELECT v.*, d.name_en AS district_name_en, d.name_bn AS district_name_bn,
              s.name_en AS subdivision_name_en, s.name_bn AS subdivision_name_bn,
              lb.name_en AS local_body_name_en, lb.name_bn AS local_body_name_bn, lb.area_type, lb.body_type,
              gw.name_en AS gp_ward_name_en, gw.name_bn AS gp_ward_name_bn
       FROM wb_villages v
       JOIN wb_districts d ON d.id = v.district_id
       LEFT JOIN wb_subdivisions s ON s.id = v.subdivision_id
       JOIN wb_local_bodies lb ON lb.id = v.local_body_id
       LEFT JOIN wb_gp_wards gw ON gw.id = v.gp_ward_id
       WHERE v.pincode = $1 AND v.is_active = TRUE
       ORDER BY v.name_en ASC
       LIMIT 50`,
      [pin]
    );

    const pRow = pinRes.rows[0] || vilRes.rows[0] || null;
    if (!pRow) {
      return res.status(404).json({ error: 'PIN code not found in West Bengal directory.' });
    }

    res.json({
      pincode: pin,
      districtId: pRow.district_id,
      subdivisionId: pRow.subdivision_id,
      localBodyId: pRow.local_body_id,
      gpWardId: pRow.gp_ward_id,
      villageId: pRow.village_id || vilRes.rows[0]?.id || null,
      areaType: vilRes.rows[0]?.area_type || null,
      latitude: pRow.latitude,
      longitude: pRow.longitude,
      matches: vilRes.rows
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const qRaw = String(req.query.q || '').trim();
    if (qRaw.length < 2) {
      return res.json({ results: [] });
    }
    const like = `%${qRaw}%`;
    const [dists, lbs, vils] = await Promise.all([
      query(
        `SELECT 'district' AS level, id, NULL::uuid AS district_id, NULL::uuid AS subdivision_id, NULL::uuid AS local_body_id,
                name_en, name_bn, NULL::varchar AS pincode, latitude, longitude
         FROM wb_districts WHERE is_active = TRUE AND (name_en ILIKE $1 OR name_bn ILIKE $1) LIMIT 10`,
        [like]
      ),
      query(
        `SELECT 'local_body' AS level, lb.id, lb.district_id, lb.subdivision_id, lb.id AS local_body_id,
                lb.name_en || ', ' || d.name_en AS name_en, lb.name_bn || ', ' || d.name_bn AS name_bn,
                NULL::varchar AS pincode, lb.latitude, lb.longitude, lb.area_type, lb.body_type
         FROM wb_local_bodies lb JOIN wb_districts d ON d.id = lb.district_id
         WHERE lb.is_active = TRUE AND (lb.name_en ILIKE $1 OR lb.name_bn ILIKE $1) LIMIT 15`,
        [like]
      ),
      query(
        `SELECT 'village' AS level, v.id, v.district_id, v.subdivision_id, v.local_body_id, v.gp_ward_id,
                v.name_en || ' (' || lb.name_en || ', ' || d.name_en || ')' AS name_en,
                v.name_bn || ' (' || lb.name_bn || ', ' || d.name_bn || ')' AS name_bn,
                v.pincode, v.latitude, v.longitude, lb.area_type
         FROM wb_villages v
         JOIN wb_local_bodies lb ON lb.id = v.local_body_id
         JOIN wb_districts d ON d.id = v.district_id
         WHERE v.is_active = TRUE AND (v.name_en ILIKE $1 OR v.name_bn ILIKE $1 OR v.pincode ILIKE $1)
         LIMIT 20`,
        [like]
      )
    ]);

    res.json({ results: [...dists.rows, ...lbs.rows, ...vils.rows] });
  } catch (err) {
    next(err);
  }
});

export default router;
