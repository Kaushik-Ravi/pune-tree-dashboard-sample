/**
 * PUNE TREE DASHBOARD - LAND COVER DATA IMPORT SCRIPT
 * ====================================================
 * 
 * This script imports the CSV files exported from Google Earth Engine
 * into the PostgreSQL database.
 * 
 * PREREQUISITES:
 * 1. Run the GEE scripts and export to Google Drive
 * 2. Download the CSV files to the data/ folder:
 *    - pune_ward_landcover_2025.csv
 *    - pune_ward_landcover_2019.csv
 *    - pune_ward_change_2019_2025.csv
 * 
 * USAGE:
 * node scripts/import-land-cover.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

const DATA_DIR = path.join(__dirname, '..', 'data');

console.log('🌍 PUNE LAND COVER DATA IMPORT');
console.log('=' .repeat(50));

async function createTables() {
  console.log('\n📋 Creating land cover tables...');
  
  await pool.query(`
    -- Land cover statistics per ward per year
    CREATE TABLE IF NOT EXISTS land_cover_stats (
      id SERIAL PRIMARY KEY,
      ward_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_area_m2 NUMERIC,
      trees_area_m2 NUMERIC,
      built_area_m2 NUMERIC,
      grass_area_m2 NUMERIC,
      bare_area_m2 NUMERIC,
      water_area_m2 NUMERIC,
      crops_area_m2 NUMERIC,
      trees_pct NUMERIC,
      built_pct NUMERIC,
      grass_pct NUMERIC,
      bare_pct NUMERIC,
      water_pct NUMERIC,
      crops_pct NUMERIC,
      import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ward_number, year)
    );
    
    -- Land cover change detection (year-over-year)
    CREATE TABLE IF NOT EXISTS land_cover_change (
      id SERIAL PRIMARY KEY,
      ward_number INTEGER NOT NULL,
      from_year INTEGER NOT NULL,
      to_year INTEGER NOT NULL,
      period VARCHAR(50),
      trees_lost_m2 NUMERIC,
      trees_gained_m2 NUMERIC,
      net_tree_change_m2 NUMERIC,
      built_gained_m2 NUMERIC,
      trees_to_built_m2 NUMERIC,
      import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ward_number, from_year, to_year)
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_land_cover_stats_ward ON land_cover_stats(ward_number);
    CREATE INDEX IF NOT EXISTS idx_land_cover_stats_year ON land_cover_stats(year);
    CREATE INDEX IF NOT EXISTS idx_land_cover_change_ward ON land_cover_change(ward_number);
  `);
  
  console.log('   ✅ Tables created successfully');
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });
    rows.push(row);
  }
  
  return rows;
}

async function importLandCoverStats(filename, year) {
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️  ${filename} not found - skipping`);
    return 0;
  }
  
  console.log(`\n📥 Importing ${filename}...`);
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const rows = parseCSV(content);
  
  let imported = 0;
  for (const row of rows) {
    try {
      await pool.query(`
        INSERT INTO land_cover_stats (
          ward_number, year, total_area_m2,
          trees_area_m2, built_area_m2, grass_area_m2, bare_area_m2,
          trees_pct, built_pct, grass_pct, bare_pct
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (ward_number, year) 
        DO UPDATE SET
          total_area_m2 = EXCLUDED.total_area_m2,
          trees_area_m2 = EXCLUDED.trees_area_m2,
          built_area_m2 = EXCLUDED.built_area_m2,
          grass_area_m2 = EXCLUDED.grass_area_m2,
          bare_area_m2 = EXCLUDED.bare_area_m2,
          trees_pct = EXCLUDED.trees_pct,
          built_pct = EXCLUDED.built_pct,
          grass_pct = EXCLUDED.grass_pct,
          bare_pct = EXCLUDED.bare_pct,
          import_date = CURRENT_TIMESTAMP;
      `, [
        parseInt(row.ward_number) || parseInt(row.ward_no) || null,
        year,
        parseFloat(row.total_area_m2) || null,
        parseFloat(row.trees_area_m2) || null,
        parseFloat(row.built_area_m2) || null,
        parseFloat(row.grass_area_m2) || null,
        parseFloat(row.bare_area_m2) || null,
        parseFloat(row.trees_pct) || null,
        parseFloat(row.built_pct) || null,
        parseFloat(row.grass_pct) || null,
        parseFloat(row.bare_pct) || null
      ]);
      imported++;
    } catch (err) {
      console.log(`   ⚠️  Error importing ward ${row.ward_number}: ${err.message}`);
    }
  }
  
  console.log(`   ✅ Imported ${imported} ward records for ${year}`);
  return imported;
}

async function importChangeDetection(filename) {
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️  ${filename} not found - skipping`);
    return 0;
  }
  
  console.log(`📥 Importing ${filename}...`);
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const rows = parseCSV(content);
  
  let imported = 0;
  for (const row of rows) {
    try {
      await pool.query(`
        INSERT INTO land_cover_change (
          ward_number, from_year, to_year, period,
          trees_lost_m2, trees_gained_m2, 
          net_tree_change_m2, built_gained_m2, trees_to_built_m2
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (ward_number, from_year, to_year) 
        DO UPDATE SET
          period = EXCLUDED.period,
          trees_lost_m2 = EXCLUDED.trees_lost_m2,
          trees_gained_m2 = EXCLUDED.trees_gained_m2,
          net_tree_change_m2 = EXCLUDED.net_tree_change_m2,
          built_gained_m2 = EXCLUDED.built_gained_m2,
          trees_to_built_m2 = EXCLUDED.trees_to_built_m2,
          import_date = CURRENT_TIMESTAMP;
      `, [
        parseInt(row.ward_number) || parseInt(row.ward_no) || null,
        parseInt(row.from_year) || null,
        parseInt(row.to_year) || null,
        row.period || null,
        parseFloat(row.trees_lost_m2) || null,
        parseFloat(row.trees_gained_m2) || null,
        parseFloat(row.net_tree_change_m2) || null,
        parseFloat(row.built_gained_m2) || null,
        parseFloat(row.trees_to_built_m2) || null
      ]);
      imported++;
    } catch (err) {
      console.log(`   ⚠️  Error importing ward ${row.ward_number}: ${err.message}`);
    }
  }
  
  console.log(`   ✅ Imported ${imported} change detection records`);
  return imported;
}

async function verifySummary() {
  console.log('\n📊 IMPORT SUMMARY');
  console.log('-'.repeat(50));
  
  const statsCount = await pool.query('SELECT COUNT(*) as count, year FROM land_cover_stats GROUP BY year ORDER BY year');
  console.log('Land Cover Stats by Year:');
  for (const row of statsCount.rows) {
    console.log(`   Year ${row.year}: ${row.count} wards`);
  }
  
  const changeCount = await pool.query(`
    SELECT from_year, to_year, COUNT(*) as count 
    FROM land_cover_change 
    GROUP BY from_year, to_year 
    ORDER BY from_year, to_year
  `);
  console.log('\nChange Detection by Period:');
  for (const row of changeCount.rows) {
    console.log(`   ${row.from_year} → ${row.to_year}: ${row.count} wards`);
  }
  
  // Show tree cover trend
  console.log('\n🌳 TREE COVER TREND:');
  const trend = await pool.query(`
    SELECT year, 
           ROUND(AVG(trees_pct)::numeric, 2) as avg_trees_pct,
           ROUND(AVG(built_pct)::numeric, 2) as avg_built_pct
    FROM land_cover_stats
    GROUP BY year
    ORDER BY year
  `);
  console.log('   Year | Avg Trees % | Avg Built %');
  console.log('   -----|-------------|------------');
  for (const row of trend.rows) {
    console.log(`   ${row.year} |    ${row.avg_trees_pct}%   |   ${row.avg_built_pct}%`);
  }
}

async function run() {
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    
    // Create tables
    await createTables();
    
    // Check if data files exist
    console.log('\n📂 Checking for GEE export files in data/ folder...');
    const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      console.log('\n⚠️  No CSV files found in data/ folder.');
      console.log('\nTo import land cover data:');
      console.log('1. Run scripts/gee-land-cover-export.js in Google Earth Engine');
      console.log('2. Run scripts/gee-ward-analysis.js in Google Earth Engine');
      console.log('3. Export the results to Google Drive');
      console.log('4. Download the CSV files to data/ folder:');
      console.log('   - pune_ward_landcover_2025.csv');
      console.log('   - pune_ward_landcover_2019.csv');
      console.log('   - pune_ward_change_2019_2025.csv');
      console.log('5. Run this script again');
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('\n📁 Created data/ directory');
      }
    } else {
      console.log(`   Found ${csvFiles.length} CSV file(s)`);
      
      // Import all years of land cover data (2019-2025)
      console.log('\n📊 Importing yearly land cover data...');
      const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
      for (const year of years) {
        await importLandCoverStats(`pune_ward_landcover_${year}.csv`, year);
      }
      
      // Import year-over-year change data
      console.log('\n📈 Importing year-over-year change data...');
      const changePairs = [
        'pune_ward_change_2019_2020.csv',
        'pune_ward_change_2020_2021.csv',
        'pune_ward_change_2021_2022.csv',
        'pune_ward_change_2022_2023.csv',
        'pune_ward_change_2023_2024.csv',
        'pune_ward_change_2024_2025.csv',
        'pune_ward_change_2019_2025_overall.csv'
      ];
      for (const file of changePairs) {
        await importChangeDetection(file);
      }
      
      // Verify
      await verifySummary();
    }
    
    console.log('\n✅ IMPORT PROCESS COMPLETE');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
