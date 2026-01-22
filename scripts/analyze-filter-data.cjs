// scripts/analyze-filter-data.js
// One-time script to analyze database for filter UI reorganization

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
  max: 3,
  connectionTimeoutMillis: 30000,
});

async function analyzeData() {
  console.log('🌳 Pune Tree Dashboard - Data Analysis for Filter UI\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Top 10 Most Common Species
    console.log('\n📊 TOP 10 MOST COMMON SPECIES:\n');
    const topSpecies = await pool.query(`
      SELECT common_name, COUNT(*) as count 
      FROM public.trees 
      WHERE common_name IS NOT NULL AND common_name != ''
      GROUP BY common_name 
      ORDER BY count DESC 
      LIMIT 10;
    `);
    topSpecies.rows.forEach((row, i) => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${i + 1}. ${row.common_name}: ${parseInt(row.count).toLocaleString()} trees (${pct}%)`);
    });

    // 2. Economic Importance Distribution
    console.log('\n\n💰 ECONOMIC IMPORTANCE DISTRIBUTION:\n');
    const economicDist = await pool.query(`
      SELECT 
        COALESCE(economic_i, 'Not Specified') as category, 
        COUNT(*) as count 
      FROM public.trees 
      GROUP BY economic_i 
      ORDER BY count DESC;
    `);
    economicDist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${row.category}: ${parseInt(row.count).toLocaleString()} (${pct}%)`);
    });

    // 3. Height Distribution (for quick filters)
    console.log('\n\n📏 HEIGHT DISTRIBUTION:\n');
    const heightDist = await pool.query(`
      SELECT 
        CASE 
          WHEN height_m IS NULL THEN 'Unknown'
          WHEN height_m < 5 THEN 'Short (<5m)'
          WHEN height_m >= 5 AND height_m < 10 THEN 'Medium (5-10m)'
          WHEN height_m >= 10 AND height_m < 15 THEN 'Tall (10-15m)'
          ELSE 'Very Tall (>15m)'
        END as height_category,
        COUNT(*) as count,
        ROUND(AVG(height_m)::numeric, 2) as avg_height
      FROM public.trees 
      GROUP BY 1
      ORDER BY count DESC;
    `);
    heightDist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${row.height_category}: ${parseInt(row.count).toLocaleString()} (${pct}%) - Avg: ${row.avg_height}m`);
    });

    // 4. Canopy Size Distribution
    console.log('\n\n🌿 CANOPY SIZE DISTRIBUTION:\n');
    const canopyDist = await pool.query(`
      SELECT 
        CASE 
          WHEN canopy_dia_m IS NULL THEN 'Unknown'
          WHEN canopy_dia_m < 3 THEN 'Small (<3m)'
          WHEN canopy_dia_m >= 3 AND canopy_dia_m < 6 THEN 'Medium (3-6m)'
          WHEN canopy_dia_m >= 6 AND canopy_dia_m < 10 THEN 'Large (6-10m)'
          ELSE 'Very Large (>10m)'
        END as canopy_category,
        COUNT(*) as count
      FROM public.trees 
      GROUP BY 1
      ORDER BY count DESC;
    `);
    canopyDist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${row.canopy_category}: ${parseInt(row.count).toLocaleString()} (${pct}%)`);
    });

    // 5. Flowering Status Distribution
    console.log('\n\n🌸 FLOWERING STATUS DISTRIBUTION:\n');
    const floweringDist = await pool.query(`
      SELECT 
        CASE 
          WHEN flowering IS NULL OR flowering = '' THEN 'Unknown'
          WHEN LOWER(flowering) = 'no' THEN 'Non-Flowering'
          ELSE 'Flowering'
        END as flowering_status,
        COUNT(*) as count
      FROM public.trees 
      GROUP BY 1
      ORDER BY count DESC;
    `);
    floweringDist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${row.flowering_status}: ${parseInt(row.count).toLocaleString()} (${pct}%)`);
    });

    // 6. Street vs Non-Street Distribution
    console.log('\n\n🛣️ LOCATION TYPE DISTRIBUTION:\n');
    const locationDist = await pool.query(`
      SELECT 
        CASE 
          WHEN distance_to_road_m IS NULL THEN 'Unknown'
          WHEN distance_to_road_m <= 15 THEN 'Street Trees (≤15m from road)'
          ELSE 'Non-Street Trees (>15m from road)'
        END as location_type,
        COUNT(*) as count
      FROM public.trees 
      GROUP BY 1
      ORDER BY count DESC;
    `);
    locationDist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${row.location_type}: ${parseInt(row.count).toLocaleString()} (${pct}%)`);
    });

    // 7. CO2 Sequestration Distribution
    console.log('\n\n🌍 CO₂ SEQUESTRATION DISTRIBUTION:\n');
    const co2Dist = await pool.query(`
      SELECT 
        CASE 
          WHEN "CO2_sequestered_kg" IS NULL THEN 'Unknown'
          WHEN "CO2_sequestered_kg" < 50 THEN 'Low (<50 kg)'
          WHEN "CO2_sequestered_kg" >= 50 AND "CO2_sequestered_kg" < 200 THEN 'Medium (50-200 kg)'
          WHEN "CO2_sequestered_kg" >= 200 AND "CO2_sequestered_kg" < 500 THEN 'High (200-500 kg)'
          ELSE 'Very High (>500 kg)'
        END as co2_category,
        COUNT(*) as count,
        ROUND(SUM("CO2_sequestered_kg")::numeric, 0) as total_co2
      FROM public.trees 
      GROUP BY 1
      ORDER BY total_co2 DESC NULLS LAST;
    `);
    co2Dist.rows.forEach(row => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      const co2Tons = row.total_co2 ? (row.total_co2 / 1000).toLocaleString() : 'N/A';
      console.log(`  ${row.co2_category}: ${parseInt(row.count).toLocaleString()} (${pct}%) - Total: ${co2Tons} tons`);
    });

    // 8. Top 5 Wards by Tree Count
    console.log('\n\n🏘️ TOP 10 WARDS BY TREE COUNT:\n');
    const topWards = await pool.query(`
      SELECT ward, COUNT(*) as count 
      FROM public.trees 
      WHERE ward IS NOT NULL 
      GROUP BY ward 
      ORDER BY count DESC 
      LIMIT 10;
    `);
    topWards.rows.forEach((row, i) => {
      const pct = ((row.count / 1789337) * 100).toFixed(2);
      console.log(`  ${i + 1}. Ward ${row.ward}: ${parseInt(row.count).toLocaleString()} trees (${pct}%)`);
    });

    // 9. Species by Economic Importance (Medicinal Trees)
    console.log('\n\n💊 TOP 5 MEDICINAL SPECIES:\n');
    const medicinalSpecies = await pool.query(`
      SELECT common_name, COUNT(*) as count 
      FROM public.trees 
      WHERE economic_i = 'Medicinal'
      GROUP BY common_name 
      ORDER BY count DESC 
      LIMIT 5;
    `);
    medicinalSpecies.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.common_name}: ${parseInt(row.count).toLocaleString()}`);
    });

    // 10. Fruit-bearing Trees
    console.log('\n\n🍎 TOP 5 FRUIT-BEARING SPECIES:\n');
    const fruitSpecies = await pool.query(`
      SELECT common_name, COUNT(*) as count 
      FROM public.trees 
      WHERE economic_i = 'Fruit'
      GROUP BY common_name 
      ORDER BY count DESC 
      LIMIT 5;
    `);
    fruitSpecies.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.common_name}: ${parseInt(row.count).toLocaleString()}`);
    });

    // Summary for UI Design
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 RECOMMENDATIONS FOR QUICK FILTER PRESETS:');
    console.log('='.repeat(60));
    console.log(`
TIER 1 - QUICK PRESET CHIPS (One-tap filters):
  🌳 Location Type: Street / Non-Street (already exists)
  🌸 Flowering / Non-Flowering (already exists)
  📏 Height: Short / Medium / Tall / Very Tall
  💊 Medicinal Trees
  🍎 Fruit Trees
  🏛️ Ornamental Trees
  
TIER 2 - PRIMARY DROPDOWNS:
  🌿 Species (multi-select, searchable)
  🏘️ Ward (multi-select, numerically sorted)
  💰 Economic Importance (dropdown)
  
TIER 3 - ADVANCED FILTERS (Collapsible):
  📏 Height Range (slider)
  🌿 Canopy Diameter (slider)
  📐 Girth (slider)
  🌍 CO₂ Sequestered (slider)
`);

    console.log('='.repeat(60));
    console.log('Analysis complete!\n');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

analyzeData();
