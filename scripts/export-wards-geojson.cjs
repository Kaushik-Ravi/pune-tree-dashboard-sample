/**
 * Export ward polygons from PostgreSQL to GeoJSON for Google Earth Engine
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function exportWards() {
  try {
    console.log('Connecting to database...');
    
    const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
          json_build_object(
            'type', 'Feature',
            'properties', json_build_object(
              'ward_number', ward_number,
              'ward_office', ward_office,
              'zone', zone,
              'prabhag_name', prabhag_name,
              'tree_count', tree_count
            ),
            'geometry', ST_AsGeoJSON(geometry)::json
          )
        )
      ) as geojson
      FROM ward_polygons
      WHERE geometry IS NOT NULL;
    `;
    
    const result = await pool.query(query);
    const geojson = result.rows[0].geojson;
    
    const outputPath = path.join(__dirname, '..', 'data', 'pune-wards-for-gee.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    
    console.log(`✅ Exported ${geojson.features.length} wards to:`);
    console.log(`   ${outputPath}`);
    console.log('\nNext steps:');
    console.log('1. Go to https://code.earthengine.google.com/');
    console.log('2. Click Assets tab (left panel)');
    console.log('3. Click NEW > Shape files or GeoJSON');
    console.log('4. Upload pune-wards-for-gee.geojson');
    console.log('5. Note the asset path (e.g., users/YOUR_USERNAME/pune-wards)');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

exportWards();
