// scripts/db-diagnostics.cjs
// Quick diagnostic script to understand database structure for Land Cover Analysis

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

async function runDiagnostics() {
  console.log('\n🔍 DATABASE DIAGNOSTICS FOR LAND COVER ANALYSIS\n');
  console.log('='.repeat(60));

  try {
    // 1. Total tree count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM public.trees');
    console.log(`\n📊 TOTAL TREES: ${parseInt(countResult.rows[0].total).toLocaleString()}`);

    // 2. Ward distribution
    console.log('\n📍 WARD DISTRIBUTION:');
    const wardResult = await pool.query(`
      SELECT 
        ward,
        COUNT(*) as tree_count
      FROM public.trees 
      WHERE ward IS NOT NULL
      GROUP BY ward 
      ORDER BY ward::numeric
    `);
    
    console.log(`   Total unique wards: ${wardResult.rows.length}`);
    console.log(`   Ward range: ${wardResult.rows[0]?.ward} to ${wardResult.rows[wardResult.rows.length - 1]?.ward}`);
    
    // Show top 5 and bottom 5 wards by tree count
    const sorted = [...wardResult.rows].sort((a, b) => parseInt(b.tree_count) - parseInt(a.tree_count));
    console.log('\n   Top 5 wards by tree count:');
    sorted.slice(0, 5).forEach((w, i) => {
      console.log(`     ${i + 1}. Ward ${w.ward}: ${parseInt(w.tree_count).toLocaleString()} trees`);
    });
    
    console.log('\n   Bottom 5 wards by tree count:');
    sorted.slice(-5).forEach((w, i) => {
      console.log(`     ${sorted.length - 4 + i}. Ward ${w.ward}: ${parseInt(w.tree_count).toLocaleString()} trees`);
    });

    // 3. Bounding box for GEE export
    console.log('\n🗺️  BOUNDING BOX (for Google Earth Engine):');
    const bboxResult = await pool.query(`
      SELECT 
        ST_XMin(ST_Extent(geom)) as min_lng,
        ST_YMin(ST_Extent(geom)) as min_lat,
        ST_XMax(ST_Extent(geom)) as max_lng,
        ST_YMax(ST_Extent(geom)) as max_lat
      FROM public.trees
      WHERE geom IS NOT NULL
    `);
    
    const bbox = bboxResult.rows[0];
    console.log(`   Min Longitude: ${parseFloat(bbox.min_lng).toFixed(6)}`);
    console.log(`   Max Longitude: ${parseFloat(bbox.max_lng).toFixed(6)}`);
    console.log(`   Min Latitude:  ${parseFloat(bbox.min_lat).toFixed(6)}`);
    console.log(`   Max Latitude:  ${parseFloat(bbox.max_lat).toFixed(6)}`);
    console.log(`\n   GEE Rectangle: ee.Geometry.Rectangle([${parseFloat(bbox.min_lng).toFixed(6)}, ${parseFloat(bbox.min_lat).toFixed(6)}, ${parseFloat(bbox.max_lng).toFixed(6)}, ${parseFloat(bbox.max_lat).toFixed(6)}])`);

    // 4. Sample tree data structure
    console.log('\n📋 SAMPLE TREE RECORD:');
    const sampleResult = await pool.query(`
      SELECT 
        id, common_name, botanical_name, height_m, canopy_dia_m, girth_cm,
        "CO2_sequestered_kg", ward, economic_i, flowering, distance_to_road_m,
        ST_X(geom) as lng, ST_Y(geom) as lat
      FROM public.trees 
      WHERE geom IS NOT NULL 
      LIMIT 1
    `);
    
    if (sampleResult.rows[0]) {
      const sample = sampleResult.rows[0];
      Object.entries(sample).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    // 5. Check for existing tables we might need
    console.log('\n📦 EXISTING TABLES:');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // 6. Trees per ward statistics
    console.log('\n📈 WARD STATISTICS SUMMARY:');
    const statsResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT ward) as total_wards,
        ROUND(AVG(tree_count)) as avg_trees_per_ward,
        MIN(tree_count) as min_trees,
        MAX(tree_count) as max_trees
      FROM (
        SELECT ward, COUNT(*) as tree_count
        FROM public.trees
        WHERE ward IS NOT NULL
        GROUP BY ward
      ) subq
    `);
    
    const stats = statsResult.rows[0];
    console.log(`   Total wards: ${stats.total_wards}`);
    console.log(`   Average trees per ward: ${parseInt(stats.avg_trees_per_ward).toLocaleString()}`);
    console.log(`   Min trees in a ward: ${parseInt(stats.min_trees).toLocaleString()}`);
    console.log(`   Max trees in a ward: ${parseInt(stats.max_trees).toLocaleString()}`);

    // 7. Check ward format
    console.log('\n🔢 WARD FORMAT ANALYSIS:');
    const formatResult = await pool.query(`
      SELECT DISTINCT ward, LENGTH(ward) as len
      FROM public.trees
      WHERE ward IS NOT NULL
      ORDER BY ward::numeric
      LIMIT 10
    `);
    
    console.log('   Sample ward values:');
    formatResult.rows.forEach(row => {
      console.log(`     "${row.ward}" (length: ${row.len})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTICS COMPLETE\n');

  } catch (error) {
    console.error('❌ Error running diagnostics:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

runDiagnostics();
