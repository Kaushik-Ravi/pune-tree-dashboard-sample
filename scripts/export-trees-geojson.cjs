// scripts/export-trees-geojson.cjs
// Export trees from PostgreSQL to GeoJSON with all attributes needed for map filtering
// Uses streaming to handle 1.79M trees without memory issues

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
  // Increase timeout for large queries
  statement_timeout: 300000, // 5 minutes
  query_timeout: 300000,
});

async function exportTreesToGeoJSON() {
  console.log('🌳 Exporting trees from PostgreSQL...');
  console.log(`   Database: ${process.env.DB_HOST}`);
  
  const outputPath = path.resolve(__dirname, '../pune-trees-complete.geojson');
  
  try {
    // First, get the count
    const countResult = await pool.query('SELECT COUNT(*) FROM public.trees WHERE geom IS NOT NULL');
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`   Total trees: ${totalCount.toLocaleString()}`);
    
    // Open file for writing
    const writeStream = fs.createWriteStream(outputPath);
    writeStream.write('{"type":"FeatureCollection","name":"pune_trees_complete","features":[\n');
    
    const BATCH_SIZE = 50000;
    let offset = 0;
    let featuresWritten = 0;
    let isFirst = true;
    
    console.log('⏳ Exporting in batches...');
    const startTime = Date.now();
    
    while (offset < totalCount) {
      const query = `
        SELECT 
          id,
          common_name,
          botanical_name,
          height_m,
          canopy_dia_m,
          girth_cm,
          "CO2_sequestered_kg",
          ward,
          economic_i,
          flowering,
          distance_to_road_m,
          ST_X(geom) as lng,
          ST_Y(geom) as lat
        FROM public.trees
        WHERE geom IS NOT NULL
        ORDER BY id
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `;
      
      const result = await pool.query(query);
      
      for (const row of result.rows) {
        const feature = {
          type: 'Feature',
          properties: {
            Tree_ID: String(row.id),
            Common_Name: row.common_name,
            Botanical_Name: row.botanical_name,
            Height_m: row.height_m ? parseFloat(row.height_m) : null,
            Canopy_Diameter_m: row.canopy_dia_m ? parseFloat(row.canopy_dia_m) : null,
            Girth_cm: row.girth_cm ? parseFloat(row.girth_cm) : null,
            CO2_Sequestration_kg_yr: row.CO2_sequestered_kg ? parseFloat(row.CO2_sequestered_kg) : null,
            ward: row.ward,
            economic_i: row.economic_i,
            flowering: row.flowering,
            distance_to_road_m: row.distance_to_road_m ? parseFloat(row.distance_to_road_m) : null,
            is_street_tree: row.distance_to_road_m !== null && parseFloat(row.distance_to_road_m) <= 5
          },
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(row.lng), parseFloat(row.lat)]
          }
        };
        
        const line = (isFirst ? '' : ',\n') + JSON.stringify(feature);
        writeStream.write(line);
        isFirst = false;
        featuresWritten++;
      }
      
      offset += BATCH_SIZE;
      const progress = Math.min(100, (offset / totalCount * 100)).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\r   Progress: ${progress}% (${featuresWritten.toLocaleString()} features, ${elapsed}s)`);
    }
    
    writeStream.write('\n]}');
    writeStream.end();
    
    // Wait for file to finish writing
    await new Promise((resolve) => writeStream.on('finish', resolve));
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n✅ Export complete!`);
    console.log(`   Features: ${featuresWritten.toLocaleString()}`);
    console.log(`   File size: ${fileSizeMB} MB`);
    console.log(`   Time: ${elapsed}s`);
    console.log(`\n📍 Next steps:`);
    console.log(`   1. Convert to MBTiles with tippecanoe`);
    console.log(`   2. Convert to PMTiles`);
    console.log(`   3. Upload to Cloudflare R2`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

exportTreesToGeoJSON();
