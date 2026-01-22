/**
 * Script to import Pune road data from OpenStreetMap via Overpass API
 * and calculate distance from each tree to the nearest road.
 * 
 * Usage: node scripts/import-pune-roads.js
 * 
 * Prerequisites:
 *   - Node.js installed
 *   - npm install pg node-fetch@2
 *   - PostgreSQL with PostGIS extension
 *   - Set your database connection in .env file (same as api/server.js uses)
 */

// Load environment variables from .env file if present
require('dotenv').config();

const { Pool } = require('pg');

// Database connection - uses same env vars as api/server.js
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_CA_CERT ? {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'),
  } : { rejectUnauthorized: false },
});

// Pune bounding box (approximate)
const PUNE_BBOX = {
  south: 18.4,
  west: 73.7,
  north: 18.7,
  east: 74.0
};

// Overpass API query for roads in Pune
const OVERPASS_QUERY = `
[out:json][timeout:300];
(
  way["highway"~"primary|secondary|tertiary|residential|unclassified|trunk|primary_link|secondary_link|tertiary_link"](${PUNE_BBOX.south},${PUNE_BBOX.west},${PUNE_BBOX.north},${PUNE_BBOX.east});
);
out body;
>;
out skel qt;
`;

async function fetchPuneRoads() {
  console.log('📡 Fetching Pune road data from OpenStreetMap Overpass API...');
  console.log('   This may take 2-5 minutes depending on server load...\n');
  
  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`✅ Received ${data.elements.length} elements from OSM\n`);
  return data;
}

function parseOsmData(osmData) {
  console.log('🔄 Parsing OSM data into road geometries...');
  
  // Build a node lookup table
  const nodes = {};
  osmData.elements.forEach(el => {
    if (el.type === 'node') {
      nodes[el.id] = { lat: el.lat, lon: el.lon };
    }
  });

  // Extract ways (roads) with their coordinates
  const roads = [];
  osmData.elements.forEach(el => {
    if (el.type === 'way' && el.nodes && el.nodes.length >= 2) {
      const coords = el.nodes
        .map(nodeId => nodes[nodeId])
        .filter(n => n !== undefined);
      
      if (coords.length >= 2) {
        roads.push({
          osm_id: el.id,
          name: el.tags?.name || null,
          highway: el.tags?.highway || 'unknown',
          coords: coords
        });
      }
    }
  });

  console.log(`✅ Parsed ${roads.length} road segments\n`);
  return roads;
}

async function createRoadsTable(client) {
  console.log('🏗️  Creating/resetting roads table...');
  
  await client.query(`
    DROP TABLE IF EXISTS public.roads CASCADE;
    
    CREATE TABLE public.roads (
      id SERIAL PRIMARY KEY,
      osm_id BIGINT,
      name VARCHAR(255),
      highway VARCHAR(50),
      geom GEOMETRY(LineString, 4326)
    );
  `);
  
  console.log('✅ Roads table created\n');
}

async function insertRoads(client, roads) {
  console.log(`📥 Inserting ${roads.length} roads into database...`);
  
  let inserted = 0;
  const batchSize = 500;
  
  for (let i = 0; i < roads.length; i += batchSize) {
    const batch = roads.slice(i, i + batchSize);
    
    const values = batch.map((road, idx) => {
      const lineString = road.coords.map(c => `${c.lon} ${c.lat}`).join(', ');
      const baseIdx = idx * 4;
      return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, ST_GeomFromText('LINESTRING(${lineString})', 4326))`;
    }).join(', ');
    
    const params = batch.flatMap(road => [road.osm_id, road.name, road.highway]);
    
    await client.query(
      `INSERT INTO public.roads (osm_id, name, highway, geom) VALUES ${values}`,
      params
    );
    
    inserted += batch.length;
    process.stdout.write(`\r   Progress: ${inserted}/${roads.length} roads`);
  }
  
  console.log('\n✅ All roads inserted\n');
}

async function createSpatialIndex(client) {
  console.log('📊 Creating spatial index on roads...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_roads_geom ON public.roads USING GIST (geom);
  `);
  console.log('✅ Spatial index created\n');
}

async function addDistanceColumn(client) {
  console.log('➕ Adding distance_to_road_m column to trees table...');
  await client.query(`
    ALTER TABLE public.trees 
    ADD COLUMN IF NOT EXISTS distance_to_road_m NUMERIC(10, 2);
  `);
  console.log('✅ Column added\n');
}

async function calculateDistances(client) {
  console.log('📏 Calculating distance from each tree to nearest road...');
  console.log('   This will take several minutes for 1.79M trees...\n');
  
  // Process in batches to show progress and avoid timeout
  const countResult = await client.query('SELECT COUNT(*) FROM public.trees');
  const totalTrees = parseInt(countResult.rows[0].count);
  console.log(`   Total trees to process: ${totalTrees.toLocaleString()}\n`);
  
  const batchSize = 50000;
  let processed = 0;
  
  // Get min and max IDs for batching
  const idRange = await client.query('SELECT MIN(id) as min_id, MAX(id) as max_id FROM public.trees');
  const minId = idRange.rows[0].min_id;
  const maxId = idRange.rows[0].max_id;
  
  // Process by ID ranges
  let currentMinId = minId;
  
  while (currentMinId <= maxId) {
    const currentMaxId = currentMinId + batchSize;
    
    await client.query(`
      UPDATE public.trees t
      SET distance_to_road_m = subquery.min_distance
      FROM (
        SELECT 
          t2.id,
          COALESCE(
            (
              SELECT MIN(ST_Distance(t2.geom::geography, r.geom::geography))
              FROM public.roads r
              WHERE ST_DWithin(t2.geom::geography, r.geom::geography, 100)
            ),
            999
          ) as min_distance
        FROM public.trees t2
        WHERE t2.id >= $1 AND t2.id < $2
      ) subquery
      WHERE t.id = subquery.id
    `, [currentMinId, currentMaxId]);
    
    // Count how many were actually updated in this batch
    const updatedCount = await client.query(`
      SELECT COUNT(*) FROM public.trees 
      WHERE id >= $1 AND id < $2
    `, [currentMinId, currentMaxId]);
    
    processed += parseInt(updatedCount.rows[0].count);
    const pct = ((processed / totalTrees) * 100).toFixed(1);
    process.stdout.write(`\r   Progress: ${processed.toLocaleString()}/${totalTrees.toLocaleString()} trees (${pct}%)`);
    
    currentMinId = currentMaxId;
  }
  
  console.log('\n✅ Distance calculation complete\n');
}

async function createDistanceIndex(client) {
  console.log('📊 Creating index on distance_to_road_m...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_trees_distance_to_road 
    ON public.trees (distance_to_road_m);
  `);
  console.log('✅ Index created\n');
}

async function showStats(client) {
  console.log('📈 Street Tree Classification Results:\n');
  
  const stats = await client.query(`
    SELECT 
      CASE 
        WHEN distance_to_road_m <= 15 THEN '🌳 Street Trees (≤15m from road)'
        WHEN distance_to_road_m <= 50 THEN '🌲 Near Road (15-50m)'
        WHEN distance_to_road_m < 999 THEN '🏡 Non-Street (>50m)'
        ELSE '❓ No road nearby (>100m search)'
      END as category,
      COUNT(*) as tree_count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM public.trees
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  
  console.log('   Category                              | Count       | %');
  console.log('   ' + '-'.repeat(65));
  stats.rows.forEach(row => {
    const cat = row.category.padEnd(40);
    const count = row.tree_count.toLocaleString().padStart(10);
    const pct = (row.percentage + '%').padStart(7);
    console.log(`   ${cat} | ${count} | ${pct}`);
  });
  console.log();
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Pune Street Tree Classification - OSM Road Import');
  console.log('='.repeat(60) + '\n');
  
  const client = await pool.connect();
  
  try {
    // Step 1: Fetch OSM data
    const osmData = await fetchPuneRoads();
    
    // Step 2: Parse into road geometries
    const roads = parseOsmData(osmData);
    
    // Step 3: Create roads table
    await createRoadsTable(client);
    
    // Step 4: Insert roads
    await insertRoads(client, roads);
    
    // Step 5: Create spatial index
    await createSpatialIndex(client);
    
    // Step 6: Add distance column to trees
    await addDistanceColumn(client);
    
    // Step 7: Calculate distances (this is the slow part)
    await calculateDistances(client);
    
    // Step 8: Create index on distance column
    await createDistanceIndex(client);
    
    // Step 9: Show results
    await showStats(client);
    
    console.log('✅ All done! Street tree classification is now available.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
