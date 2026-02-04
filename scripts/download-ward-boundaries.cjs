// scripts/download-ward-boundaries.cjs
// Downloads PMC ward boundaries from OpenCity.in and converts to GeoJSON
// Also creates SQL for importing into PostGIS

const fs = require('fs');
const path = require('path');
const https = require('https');

// OpenCity.in PMC Electoral Wards 2012 (76 wards - closest match to 77 in census)
const WARD_KML_URL = 'https://data.opencity.in/dataset/98f28dac-9158-46ee-a91e-a514d9af427c/resource/bfd393d4-5496-4f88-84b3-d794bf661ec0/download/06209242-c2c6-40f7-b70c-db0783cb7ccd.kml';

const OUTPUT_DIR = path.resolve(__dirname, '../data');
const KML_FILE = path.join(OUTPUT_DIR, 'pune-wards-2012.kml');
const GEOJSON_FILE = path.join(OUTPUT_DIR, 'pune-wards.geojson');

// Simple KML to GeoJSON converter (handles basic Polygon/MultiPolygon)
// Enhanced to parse SimpleData fields from PMC KML
function parseKMLToGeoJSON(kmlContent) {
  const features = [];
  
  // Extract all Placemark elements
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let match;
  
  while ((match = placemarkRegex.exec(kmlContent)) !== null) {
    const placemark = match[1];
    
    // Extract SimpleData fields (PMC KML uses these)
    const simpleDataRegex = /<SimpleData\s+name="([^"]+)"[^>]*>([^<]*)<\/SimpleData>/gi;
    const properties = {};
    let sdMatch;
    
    while ((sdMatch = simpleDataRegex.exec(placemark)) !== null) {
      const key = sdMatch[1].toLowerCase();
      const value = sdMatch[2].trim();
      properties[key] = value;
    }
    
    // Extract name if present
    const nameMatch = /<name[^>]*>([\s\S]*?)<\/name>/i.exec(placemark);
    if (nameMatch && !properties.name) {
      properties.name = nameMatch[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
    }
    
    // Extract coordinates from Polygon
    const coordsRegex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
    const rings = [];
    let coordMatch;
    
    while ((coordMatch = coordsRegex.exec(placemark)) !== null) {
      const coordString = coordMatch[1].trim();
      const ring = coordString
        .split(/\s+/)
        .filter(s => s.length > 0)
        .map(coord => {
          const [lng, lat, alt] = coord.split(',').map(parseFloat);
          return [lng, lat]; // GeoJSON is [lng, lat]
        })
        .filter(c => !isNaN(c[0]) && !isNaN(c[1]));
      
      if (ring.length > 0) {
        rings.push(ring);
      }
    }
    
    if (rings.length > 0) {
      // Get ward number from various possible fields
      const wardNumber = parseInt(properties.ward_no) || 
                        parseInt(properties.ward_id) || 
                        parseInt(properties.objectid) || 
                        null;
      
      const feature = {
        type: 'Feature',
        properties: {
          ward_number: wardNumber,
          ward_text: properties.text || null,          // e.g., "W-10"
          ward_office: properties.wardoffice || null,   // e.g., "KOTHRUD-BAVDHAN"
          prabhag_name: properties.prabhag_na || null,  // e.g., "Bavdhan - Kothrud Depot"
          zone: parseInt(properties.zone) || null,
          zone_id: parseInt(properties.zone_id) || null,
          prabhag_id: parseInt(properties.prabhag_id) || null,
          area_m2: parseFloat(properties.st_area_sh) || parseFloat(properties.shape_area) || null,
        },
        geometry: {
          type: 'Polygon',
          coordinates: rings,
        }
      };
      
      features.push(feature);
    }
  }
  
  return {
    type: 'FeatureCollection',
    name: 'pune_wards',
    features: features
  };
}

// Download file from URL
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading from: ${url}`);
    
    const file = fs.createWriteStream(destPath);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`   ↪️ Redirecting to: ${response.headers.location}`);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`   ✅ Downloaded to: ${destPath}`);
        resolve();
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function main() {
  console.log('\n🗺️  PUNE WARD BOUNDARIES DOWNLOAD & CONVERSION\n');
  console.log('='.repeat(60));
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}`);
  }
  
  try {
    // Step 1: Download KML
    await downloadFile(WARD_KML_URL, KML_FILE);
    
    // Step 2: Parse KML to GeoJSON
    console.log('\n🔄 Converting KML to GeoJSON...');
    const kmlContent = fs.readFileSync(KML_FILE, 'utf8');
    const geojson = parseKMLToGeoJSON(kmlContent);
    
    console.log(`   Found ${geojson.features.length} ward polygons`);
    
    // Step 3: Validate and log ward numbers
    const wardNumbers = geojson.features
      .map(f => f.properties.ward_number)
      .filter(n => n !== null)
      .sort((a, b) => a - b);
    
    console.log(`   Ward numbers found: ${wardNumbers.length}`);
    console.log(`   Range: ${wardNumbers[0]} to ${wardNumbers[wardNumbers.length - 1]}`);
    
    // Step 4: Save GeoJSON
    fs.writeFileSync(GEOJSON_FILE, JSON.stringify(geojson, null, 2));
    console.log(`\n✅ Saved GeoJSON to: ${GEOJSON_FILE}`);
    
    // Step 5: Generate SQL for PostGIS import
    console.log('\n📝 Generating PostGIS import SQL...');
    
    const sqlStatements = [
      '-- Pune Ward Boundaries Import Script',
      '-- Run this in your PostgreSQL database',
      '',
      '-- Create table for ward polygons',
      'DROP TABLE IF EXISTS public.ward_polygons CASCADE;',
      '',
      'CREATE TABLE public.ward_polygons (',
      '  id SERIAL PRIMARY KEY,',
      '  ward_number INTEGER,',
      '  ward_text VARCHAR(20),',
      '  ward_office VARCHAR(100),',
      '  prabhag_name VARCHAR(255),',
      '  zone INTEGER,',
      '  zone_id INTEGER,',
      '  prabhag_id INTEGER,',
      '  geometry GEOMETRY(MultiPolygon, 4326),',
      '  area_km2 NUMERIC,',
      '  tree_count INTEGER DEFAULT 0,',
      '  created_at TIMESTAMP DEFAULT NOW()',
      ');',
      '',
      '-- Create spatial index',
      'CREATE INDEX idx_ward_polygons_geom ON public.ward_polygons USING GIST(geometry);',
      'CREATE INDEX idx_ward_polygons_number ON public.ward_polygons(ward_number);',
      '',
      '-- Insert ward data',
    ];
    
    geojson.features.forEach((feature, i) => {
      const p = feature.properties;
      const wardNum = p.ward_number || 'NULL';
      const wardText = p.ward_text ? `'${p.ward_text.replace(/'/g, "''")}'` : 'NULL';
      const wardOffice = p.ward_office ? `'${p.ward_office.replace(/'/g, "''")}'` : 'NULL';
      const prabhagName = p.prabhag_name ? `'${p.prabhag_name.replace(/'/g, "''")}'` : 'NULL';
      const zone = p.zone || 'NULL';
      const zoneId = p.zone_id || 'NULL';
      const prabhagId = p.prabhag_id || 'NULL';
      const geomJson = JSON.stringify(feature.geometry);
      
      sqlStatements.push(`INSERT INTO public.ward_polygons (ward_number, ward_text, ward_office, prabhag_name, zone, zone_id, prabhag_id, geometry) VALUES (${wardNum}, ${wardText}, ${wardOffice}, ${prabhagName}, ${zone}, ${zoneId}, ${prabhagId}, ST_Multi(ST_GeomFromGeoJSON('${geomJson}')));`);
    });
    
    sqlStatements.push('');
    sqlStatements.push('-- Calculate area for each ward');
    sqlStatements.push('UPDATE public.ward_polygons SET area_km2 = ST_Area(geometry::geography) / 1000000;');
    sqlStatements.push('');
    sqlStatements.push('-- Update tree count from trees table');
    sqlStatements.push(`UPDATE public.ward_polygons wp SET tree_count = (
  SELECT COUNT(*) FROM public.trees t 
  WHERE FLOOR(t.ward::numeric) = wp.ward_number
);`);
    sqlStatements.push('');
    sqlStatements.push('-- Verify import');
    sqlStatements.push('SELECT ward_number, ward_text, ward_office, tree_count, ROUND(area_km2::numeric, 2) as area_km2, ST_IsValid(geometry) as is_valid FROM public.ward_polygons ORDER BY ward_number;');
    
    const sqlFile = path.join(OUTPUT_DIR, 'import-ward-polygons.sql');
    fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
    console.log(`✅ Saved SQL to: ${sqlFile}`);
    
    // Step 6: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total wards in KML: ${geojson.features.length}`);
    console.log(`   Ward numbers extracted: ${wardNumbers.length}`);
    console.log(`   Output files:`);
    console.log(`     - ${GEOJSON_FILE}`);
    console.log(`     - ${sqlFile}`);
    console.log('\n📌 NEXT STEPS:');
    console.log('   1. Run the SQL file in your PostgreSQL database');
    console.log('   2. Or use: psql -f data/import-ward-polygons.sql');
    console.log('\n✅ DOWNLOAD & CONVERSION COMPLETE\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
