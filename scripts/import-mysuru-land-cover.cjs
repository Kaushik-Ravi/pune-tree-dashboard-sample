/**
 * Import Mysuru per-ward land-cover stats CSV (produced by
 * gee_mysuru_zonal_stats.py) into DO Postgres tables.
 *
 * Tables (parallel to Pune's land_cover_stats / land_cover_change):
 *   - mysuru_land_cover_stats  (ward_number, year, *_area_m2, *_pct)
 *   - mysuru_land_cover_change (ward_number, from_year, to_year, period, ...)
 *
 * USAGE: node scripts/import-mysuru-land-cover.cjs
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

const ZONAL_DIR = path.join(__dirname, '..', 'data', 'processed-rasters', 'mysuru', 'zonal_stats');

async function createTables() {
  console.log('Creating Mysuru land-cover tables...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mysuru_land_cover_stats (
      id SERIAL PRIMARY KEY,
      ward_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_area_m2 NUMERIC,
      trees_area_m2 NUMERIC, built_area_m2 NUMERIC, grass_area_m2 NUMERIC,
      bare_area_m2 NUMERIC, water_area_m2 NUMERIC, crops_area_m2 NUMERIC,
      trees_pct NUMERIC, built_pct NUMERIC, grass_pct NUMERIC,
      bare_pct NUMERIC, water_pct NUMERIC, crops_pct NUMERIC,
      import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ward_number, year)
    );
    CREATE TABLE IF NOT EXISTS mysuru_land_cover_change (
      id SERIAL PRIMARY KEY,
      ward_number INTEGER NOT NULL,
      from_year INTEGER NOT NULL,
      to_year INTEGER NOT NULL,
      period VARCHAR(50),
      trees_lost_m2 NUMERIC, trees_gained_m2 NUMERIC, net_tree_change_m2 NUMERIC,
      built_gained_m2 NUMERIC, trees_to_built_m2 NUMERIC,
      import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ward_number, from_year, to_year)
    );
    CREATE INDEX IF NOT EXISTS idx_mysuru_lcs_ward ON mysuru_land_cover_stats(ward_number);
    CREATE INDEX IF NOT EXISTS idx_mysuru_lcs_year ON mysuru_land_cover_stats(year);
    CREATE INDEX IF NOT EXISTS idx_mysuru_lcc_ward ON mysuru_land_cover_change(ward_number);
  `);
  console.log('  tables ready');
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    return row;
  });
}

async function importYearly() {
  const files = fs.readdirSync(ZONAL_DIR).filter(f => f.startsWith('mysuru_ward_landcover_'));
  let inserted = 0;
  await pool.query('TRUNCATE mysuru_land_cover_stats RESTART IDENTITY');
  for (const file of files) {
    const rows = parseCSV(fs.readFileSync(path.join(ZONAL_DIR, file), 'utf8'));
    for (const r of rows) {
      await pool.query(
        `INSERT INTO mysuru_land_cover_stats
          (ward_number, year, total_area_m2, trees_area_m2, built_area_m2, grass_area_m2,
           bare_area_m2, water_area_m2, crops_area_m2,
           trees_pct, built_pct, grass_pct, bare_pct, water_pct, crops_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (ward_number, year) DO UPDATE SET
           total_area_m2=EXCLUDED.total_area_m2,
           trees_area_m2=EXCLUDED.trees_area_m2, built_area_m2=EXCLUDED.built_area_m2,
           grass_area_m2=EXCLUDED.grass_area_m2, bare_area_m2=EXCLUDED.bare_area_m2,
           water_area_m2=EXCLUDED.water_area_m2, crops_area_m2=EXCLUDED.crops_area_m2,
           trees_pct=EXCLUDED.trees_pct, built_pct=EXCLUDED.built_pct,
           grass_pct=EXCLUDED.grass_pct, bare_pct=EXCLUDED.bare_pct,
           water_pct=EXCLUDED.water_pct, crops_pct=EXCLUDED.crops_pct`,
        [r.ward_number, r.year, r.total_area_m2, r.trees_area_m2, r.built_area_m2,
         r.grass_area_m2, r.bare_area_m2, r.water_area_m2, r.crops_area_m2,
         r.trees_pct, r.built_pct, r.grass_pct, r.bare_pct, r.water_pct, r.crops_pct],
      );
      inserted++;
    }
    console.log(`  imported ${file} (${rows.length} wards)`);
  }
  console.log(`  total: ${inserted} rows in mysuru_land_cover_stats`);
}

async function importChange() {
  const files = fs.readdirSync(ZONAL_DIR).filter(f => f.startsWith('mysuru_ward_change_'));
  let inserted = 0;
  await pool.query('TRUNCATE mysuru_land_cover_change RESTART IDENTITY');
  for (const file of files) {
    const rows = parseCSV(fs.readFileSync(path.join(ZONAL_DIR, file), 'utf8'));
    for (const r of rows) {
      await pool.query(
        `INSERT INTO mysuru_land_cover_change
          (ward_number, from_year, to_year, period,
           trees_lost_m2, trees_gained_m2, net_tree_change_m2,
           built_gained_m2, trees_to_built_m2)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (ward_number, from_year, to_year) DO UPDATE SET
           trees_lost_m2=EXCLUDED.trees_lost_m2,
           trees_gained_m2=EXCLUDED.trees_gained_m2,
           net_tree_change_m2=EXCLUDED.net_tree_change_m2,
           built_gained_m2=EXCLUDED.built_gained_m2,
           trees_to_built_m2=EXCLUDED.trees_to_built_m2`,
        [r.ward_number, r.from_year, r.to_year, r.period,
         r.trees_lost_m2, r.trees_gained_m2, r.net_tree_change_m2,
         r.built_gained_m2, r.trees_to_built_m2],
      );
      inserted++;
    }
    console.log(`  imported ${file} (${rows.length} wards)`);
  }
  console.log(`  total: ${inserted} rows in mysuru_land_cover_change`);
}

async function summary() {
  const s = await pool.query(`
    SELECT year, COUNT(*) AS wards,
           AVG(trees_pct)::numeric(5,2) AS avg_trees_pct,
           AVG(built_pct)::numeric(5,2) AS avg_built_pct
    FROM mysuru_land_cover_stats
    GROUP BY year ORDER BY year
  `);
  console.log('\nYear-by-year averages:');
  console.table(s.rows);
}

async function main() {
  await createTables();
  console.log('\n=== mysuru_land_cover_stats ===');
  await importYearly();
  console.log('\n=== mysuru_land_cover_change ===');
  await importChange();
  await summary();
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
