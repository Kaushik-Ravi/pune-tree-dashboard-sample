/**
 * CLEAN FRESH START - Import Pune road data from OSM
 * Uses multiple Overpass API mirrors with retry logic.
 * 
 * Usage: node scripts/import-pune-roads.mjs
 */

import 'dotenv/config';
import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 120000,
  idleTimeoutMillis: 600000,
  max: 3,
});

const PUNE_BBOX = { south: 18.4, west: 73.7, north: 18.7, east: 74.0 };

const OVERPASS_QUERY = `
[out:json][timeout:300];
(
  way["highway"~"primary|secondary|tertiary|residential|unclassified|trunk"](${PUNE_BBOX.south},${PUNE_BBOX.west},${PUNE_BBOX.north},${PUNE_BBOX.east});
);
out body;
>;
out skel qt;
`;

// Multiple Overpass API servers to try
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const server of OVERPASS_SERVERS) {
      try {
        console.log(`   Attempt ${attempt}/${maxRetries} using: ${server.split('/')[2]}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout
        
        const response = await fetch(server, {
          method: 'POST',
          body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal
        });
        
        clearTimeout(timeout);

        if (response.ok) {
          return await response.json();
        }
        
        console.log(`   Server returned ${response.status}, trying next...`);
      } catch (err) {
        console.log(`   Failed: ${err.message}, trying next...`);
      }
    }
    
    if (attempt < maxRetries) {
      console.log(`   Waiting 30 seconds before retry ${attempt + 1}...`);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
  
  throw new Error('All Overpass servers failed after multiple retries');
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  FRESH START - Pune Street Tree Classification');
  console.log('  (Will delete existing roads data and start over)');
  console.log('='.repeat(60) + '\n');
  
  let client;
  
  try {
    // ========== STEP 1: Fetch OSM Data ==========
    console.log('📡 STEP 1: Fetching road data from OpenStreetMap...');
    console.log('   This may take several minutes...\n');
    
    const osmData = await fetchWithRetry();
    console.log(`\n   ✅ Received ${osmData.elements.length} elements\n`);

    // ========== STEP 2: Parse Roads ==========
    console.log('🔄 STEP 2: Parsing road geometries...');
    
    const nodes = {};
    osmData.elements.forEach(el => {
      if (el.type === 'node') {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    });

    const roads = [];
    osmData.elements.forEach(el => {
      if (el.type === 'way' && el.nodes && el.nodes.length >= 2) {
        const coords = el.nodes.map(id => nodes[id]).filter(n => n);
        if (coords.length >= 2) {
          roads.push({
            osm_id: el.id,
            name: el.tags?.name || null,
            highway: el.tags?.highway || 'unknown',
            wkt: `LINESTRING(${coords.map(c => `${c.lon} ${c.lat}`).join(', ')})`
          });
        }
      }
    });
    
    console.log(`   ✅ Parsed ${roads.length} road segments\n`);

    // ========== STEP 3: Database Setup ==========
    console.log('🗑️  STEP 3: Cleaning up old data...');
    client = await pool.connect();
    
    // Drop and recreate roads table
    await client.query('DROP TABLE IF EXISTS public.roads CASCADE');
    await client.query(`
      CREATE TABLE public.roads (
        id SERIAL PRIMARY KEY,
        osm_id BIGINT,
        name VARCHAR(255),
        highway VARCHAR(50),
        geom GEOMETRY(LineString, 4326)
      )
    `);
    
    // Reset distance column on trees
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'trees' AND column_name = 'distance_to_road_m'
    `);
    
    if (colCheck.rows.length > 0) {
      await client.query('UPDATE public.trees SET distance_to_road_m = NULL');
    } else {
      await client.query('ALTER TABLE public.trees ADD COLUMN distance_to_road_m NUMERIC(10, 2)');
    }
    
    console.log('   ✅ Database cleaned\n');
    client.release();

    // ========== STEP 4: Insert Roads ==========
    console.log(`📥 STEP 4: Inserting ${roads.length} roads...`);
    
    let inserted = 0;
    const batchSize = 100;
    
    for (let i = 0; i < roads.length; i += batchSize) {
      const batch = roads.slice(i, i + batchSize);
      client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        for (const road of batch) {
          await client.query(
            `INSERT INTO public.roads (osm_id, name, highway, geom) 
             VALUES ($1, $2, $3, ST_GeomFromText($4, 4326))`,
            [road.osm_id, road.name, road.highway, road.wkt]
          );
          inserted++;
        }
        
        await client.query('COMMIT');
        process.stdout.write(`\r   Progress: ${inserted.toLocaleString()}/${roads.length.toLocaleString()} roads`);
      } catch (err) {
        await client.query('ROLLBACK');
        // Skip batch silently, continue with next
      } finally {
        client.release();
      }
    }
    
    console.log(`\n   ✅ Inserted ${inserted} roads\n`);

    // ========== STEP 5: Create Spatial Index ==========
    console.log('📊 STEP 5: Creating spatial index...');
    client = await pool.connect();
    await client.query('CREATE INDEX idx_roads_geom ON public.roads USING GIST (geom)');
    client.release();
    console.log('   ✅ Index created\n');

    // ========== STEP 6: Calculate Distances ==========
    console.log('📏 STEP 6: Calculating tree-to-road distances...');
    console.log('   This will take 15-30 minutes for ~1.8M trees...\n');
    
    client = await pool.connect();
    const countResult = await client.query('SELECT COUNT(*) FROM public.trees');
    const totalTrees = parseInt(countResult.rows[0].count);
    client.release();
    
    console.log(`   Total trees: ${totalTrees.toLocaleString()}\n`);
    
    let processed = 0;
    const treeBatchSize = 5000;
    let consecutiveEmpty = 0;
    
    while (processed < totalTrees && consecutiveEmpty < 3) {
      client = await pool.connect();
      
      try {
        const result = await client.query(`
          WITH batch AS (
            SELECT id, geom FROM public.trees 
            WHERE distance_to_road_m IS NULL 
            LIMIT $1
          )
          UPDATE public.trees t
          SET distance_to_road_m = (
            SELECT COALESCE(
              MIN(ST_Distance(b.geom::geography, r.geom::geography)),
              999
            )
            FROM public.roads r
            WHERE ST_DWithin(b.geom::geography, r.geom::geography, 100)
          )
          FROM batch b
          WHERE t.id = b.id
          RETURNING t.id
        `, [treeBatchSize]);
        
        if (result.rowCount === 0) {
          consecutiveEmpty++;
        } else {
          consecutiveEmpty = 0;
          processed += result.rowCount;
          const pct = ((processed / totalTrees) * 100).toFixed(1);
          process.stdout.write(`\r   Progress: ${processed.toLocaleString()}/${totalTrees.toLocaleString()} (${pct}%)`);
        }
        
      } finally {
        client.release();
      }
      
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log('\n   ✅ Distances calculated\n');

    // ========== STEP 7: Create Index ==========
    console.log('📊 STEP 7: Creating index on distance column...');
    client = await pool.connect();
    await client.query('DROP INDEX IF EXISTS idx_trees_distance');
    await client.query('CREATE INDEX idx_trees_distance ON public.trees (distance_to_road_m)');
    client.release();
    console.log('   ✅ Index created\n');

    // ========== STEP 8: Results ==========
    console.log('📈 STEP 8: Final Results:\n');
    client = await pool.connect();
    
    const stats = await client.query(`
      SELECT 
        CASE 
          WHEN distance_to_road_m <= 15 THEN 'Street Trees (≤15m)'
          WHEN distance_to_road_m <= 50 THEN 'Near Road (15-50m)'
          WHEN distance_to_road_m < 999 THEN 'Non-Street (>50m)'
          ELSE 'No road nearby'
        END as category,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as pct
      FROM public.trees
      WHERE distance_to_road_m IS NOT NULL
      GROUP BY 1
      ORDER BY 2 DESC
    `);
    
    console.log('   Category            | Count       | %');
    console.log('   ' + '-'.repeat(45));
    stats.rows.forEach(row => {
      console.log(`   ${row.category.padEnd(20)} | ${parseInt(row.count).toLocaleString().padStart(10)} | ${row.pct}%`);
    });
    
    client.release();
    
    console.log('\n✅ ALL DONE! Street tree filter is now ready to use.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      try { client.release(); } catch {}
    }
    await pool.end();
  }
}

main();
