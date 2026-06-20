/**
 * MYSURU WARD BOUNDARY IMPORT (one-off)
 * =====================================
 *
 * Drops the stub `mysuru_ward_boundaries` table and rebuilds it from the
 * Karnataka GIS KML (`data/raw/Mysuru_Ward_Map.kml`), 65 wards with proper
 * metadata + GIST index.
 *
 * USAGE: node scripts/import-mysuru-wards.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

const KML_PATH = path.join(__dirname, '..', 'data', 'raw', 'Mysuru_Ward_Map.kml');

function parseKml(kmlText) {
  const wards = [];
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  const simpleDataRegex = /<SimpleData name="([^"]+)">([^<]*)<\/SimpleData>/g;
  const coordsRegex = /<coordinates>([\s\S]*?)<\/coordinates>/;

  let match;
  while ((match = placemarkRegex.exec(kmlText)) !== null) {
    const block = match[1];
    const props = {};
    let sd;
    simpleDataRegex.lastIndex = 0;
    while ((sd = simpleDataRegex.exec(block)) !== null) {
      props[sd[1]] = sd[2];
    }
    const coordsMatch = coordsRegex.exec(block);
    if (!coordsMatch) continue;
    const rawCoords = coordsMatch[1].trim();
    const points = rawCoords.split(/\s+/).map(p => {
      const [lng, lat] = p.split(',').map(Number);
      return [lng, lat];
    }).filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    if (points.length < 4) continue;

    wards.push({
      kgis_ward_id: parseInt(props.KGISWardID, 10) || null,
      ward_code: props.KGISWardCode || null,
      ward_name: props.KGISWardName || `Ward ${props.KGISWardNo || 'unknown'}`,
      ward_no: parseInt(props.KGISWardNo, 10) || null,
      lgd_ward_code: parseInt(props.LGD_WardCode, 10) || null,
      area_m2: parseFloat(props['SHAPE.STArea()']) || null,
      perimeter_m: parseFloat(props['SHAPE.STLength()']) || null,
      points,
    });
  }
  return wards;
}

function pointsToWkt(points) {
  // Single-ring POLYGON; PostGIS auto-closes if first != last but we ensure
  const first = points[0];
  const last = points[points.length - 1];
  const closed = (first[0] === last[0] && first[1] === last[1]) ? points : [...points, first];
  const inner = closed.map(([lng, lat]) => `${lng} ${lat}`).join(',');
  return `POLYGON((${inner}))`;
}

async function main() {
  console.log('Reading KML from', KML_PATH);
  const kmlText = fs.readFileSync(KML_PATH, 'utf8');

  const wards = parseKml(kmlText);
  console.log(`Parsed ${wards.length} wards from KML.`);
  if (wards.length === 0) {
    throw new Error('No wards parsed — aborting before touching the DB.');
  }

  const client = await pool.connect();
  try {
    console.log('Beginning transaction.');
    await client.query('BEGIN');

    console.log('Dropping existing mysuru_ward_boundaries table (was stub).');
    await client.query('DROP TABLE IF EXISTS public.mysuru_ward_boundaries CASCADE');

    console.log('Creating fresh mysuru_ward_boundaries table.');
    await client.query(`
      CREATE TABLE public.mysuru_ward_boundaries (
        id SERIAL PRIMARY KEY,
        ward_no INTEGER,
        ward_name TEXT NOT NULL,
        ward_code TEXT,
        kgis_ward_id INTEGER,
        lgd_ward_code INTEGER,
        area_m2 NUMERIC,
        perimeter_m NUMERIC,
        geometry GEOMETRY(POLYGON, 4326) NOT NULL,
        tree_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('Inserting wards.');
    const insertSql = `
      INSERT INTO public.mysuru_ward_boundaries
        (ward_no, ward_name, ward_code, kgis_ward_id, lgd_ward_code, area_m2, perimeter_m, geometry)
      VALUES ($1,$2,$3,$4,$5,$6,$7, ST_GeomFromText($8, 4326))
    `;
    for (const w of wards) {
      const wkt = pointsToWkt(w.points);
      await client.query(insertSql, [
        w.ward_no, w.ward_name, w.ward_code, w.kgis_ward_id,
        w.lgd_ward_code, w.area_m2, w.perimeter_m, wkt,
      ]);
    }

    console.log('Creating GIST + ward_no indexes.');
    await client.query('CREATE INDEX idx_mysuru_wards_geom ON public.mysuru_ward_boundaries USING GIST (geometry)');
    await client.query('CREATE INDEX idx_mysuru_wards_ward_no ON public.mysuru_ward_boundaries (ward_no)');

    await client.query('COMMIT');
    console.log('COMMIT done.');

    const verify = await client.query(`
      SELECT COUNT(*) AS n,
             MIN(ward_no) AS min_ward, MAX(ward_no) AS max_ward,
             ST_GeometryType(geometry) AS geom_type
      FROM public.mysuru_ward_boundaries
      GROUP BY ST_GeometryType(geometry)
    `);
    console.log('Verification:', verify.rows);

    const sample = await client.query(`
      SELECT id, ward_no, ward_name, ward_code, ROUND(area_m2::numeric, 2) AS area_m2
      FROM public.mysuru_ward_boundaries
      ORDER BY ward_no
      LIMIT 5
    `);
    console.log('First 5 wards:');
    sample.rows.forEach(r => console.log(' ', r));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ROLLED BACK due to error:', err.message);
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
