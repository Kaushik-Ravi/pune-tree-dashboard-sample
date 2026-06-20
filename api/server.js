// server/server.js
//added new line
const fs = require('fs');
const path = require('path'); // ADD THIS
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // REPLACE WITH THIS

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const SunCalc = require('suncalc'); // --- ADDED: For sun position calculations ---

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({
  origin: process.env.VERCEL === '1' 
    ? true // Allow all origins in production (Vercel deployment)
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
  credentials: true
}));
app.use(express.json());

// --- Database Connection ---
// Configured for serverless (Vercel) + PgBouncer connection pooling
// Your DigitalOcean PgBouncer pool: pune-tree-pool, Size: 10, Mode: transaction
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_CA_CERT ? {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'),
  } : { rejectUnauthorized: false }, // Default SSL for DigitalOcean
  
  // Serverless-friendly pool configuration
  // PgBouncer has 10 connections total, multiple Vercel instances share it
  max: 3,                          // Low max per instance - PgBouncer handles pooling
  min: 0,                          // Don't keep idle connections in serverless
  idleTimeoutMillis: 10000,        // Close idle connections after 10s
  connectionTimeoutMillis: 15000,  // Allow 15s for cold start connections
  allowExitOnIdle: true,           // Allow serverless function to exit
  
  // PgBouncer transaction mode compatibility
  // Note: Prepared statements work with transaction mode on DigitalOcean
  application_name: 'pune-tree-dashboard',
});

// Handle pool errors gracefully (prevents crashes on idle connection issues)
pool.on('error', (err, client) => {
  console.error('[Pool] Unexpected error on idle client:', err.message);
});

// Log successful connection on first query (not at startup - avoids race conditions)
let connectionLogged = false;
const logConnection = () => {
  if (!connectionLogged) {
    console.log('Successfully connected to the database via PgBouncer pool.');
    connectionLogged = true;
  }
};

// --- Query Helper with Retry Logic ---
// Essential for serverless environments where cold starts and connection timeouts are common
async function queryWithRetry(queryText, params = [], retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(queryText, params);
      logConnection();
      return result;
    } catch (err) {
      const isConnectionError = err.message.includes('timeout') ||
                                 err.message.includes('connection') ||
                                 err.message.includes('ECONNREFUSED') ||
                                 err.message.includes('Connection terminated') ||
                                 err.code === 'ECONNREFUSED' ||
                                 err.code === 'ECONNRESET' ||
                                 err.code === '57P01'; // admin_shutdown

      if (isConnectionError && attempt < retries) {
        console.warn(`[Query] Attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delay * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
        continue;
      }
      throw err;
    }
  }
}

// --- Supabase Helper (read-only Mysuru data) ---
// Mysuru live tree data lives in a Supabase project owned by the mobile-app
// team. We read with the public anon key (RLS-bound). Never write.
async function supabaseFetch(pathAndQuery) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing from env');
  }
  const fullUrl = `${url.replace(/\/+$/, '')}/rest/v1/${pathAndQuery}`;
  const response = await fetch(fullUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase ${response.status}: ${errorText}`);
  }
  return response.json();
}

// --- Per-city geographic bounds (server-side mirror of frontend CityConfig) ---
const CITY_BBOX = {
  pune:   { minLng: 73.7,  minLat: 18.4,  maxLng: 74.0,  maxLat: 18.6  },
  mysuru: { minLng: 76.57, minLat: 12.24, maxLng: 76.72, maxLat: 12.37 },
};

// --- Health Check Endpoint ---
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  try {
    const result = await queryWithRetry('SELECT NOW() as time, current_database() as db');
    const queryTime = Date.now() - startTime;
    res.json({ 
      status: 'ok', 
      database: result.rows[0].db,
      time: result.rows[0].time,
      queryTimeMs: queryTime,
      poolConfig: {
        max: 3,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount,
        usingPgBouncer: true
      },
      env: {
        hasDbHost: !!process.env.DB_HOST,
        hasDbUser: !!process.env.DB_USER,
        hasDbPassword: !!process.env.DB_PASSWORD,
        hasDbDatabase: !!process.env.DB_DATABASE,
        isVercel: process.env.VERCEL === '1'
      }
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error(`[Health Check] Failed after ${errorTime}ms:`, err.message);
    res.status(500).json({ 
      status: 'error', 
      message: err.message,
      errorTimeMs: errorTime,
      env: {
        hasDbHost: !!process.env.DB_HOST,
        hasDbUser: !!process.env.DB_USER,
        hasDbPassword: !!process.env.DB_PASSWORD,
        hasDbDatabase: !!process.env.DB_DATABASE,
        isVercel: process.env.VERCEL === '1'
      }
    });
  }
});


// --- API Endpoints ---

// NO CHANGES to existing, working endpoints. They remain untouched.

app.get('/api/trees/:id', async (req, res) => {
  const { id } = req.params;
  const cityId = (req.query.cityId || 'pune').toString();

  if (cityId === 'mysuru') {
    try {
      const rows = await supabaseFetch(
        `mapped_trees?select=id,lat,lng,species_name,status,height_m,dbh_cm,created_at,user_id&id=eq.${encodeURIComponent(id)}&limit=1`
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: 'Tree not found' });
      }
      const r = rows[0];
      // Normalize to the shape the frontend expects, leaving Mysuru-unavailable
      // fields (botanical_name, canopy_dia_m, co2_sequestered_kg, economic_i,
      // flowering, ward, wood_density, image_url) as null. Frontend handles N/A.
      return res.json({
        id: r.id,
        common_name: r.species_name || 'Unknown',
        botanical_name: r.species_name || null,
        height_m: r.height_m != null ? parseFloat(r.height_m) : null,
        girth_cm: r.dbh_cm != null ? parseFloat(r.dbh_cm) : null, // dbh ≈ diameter, treat as girth for now
        canopy_dia_m: null,
        co2_sequestered_kg: null,
        ward: null,
        economic_i: null,
        flowering: null,
        wood_density: null,
        image_url: null, // tree_results has image_url but it is RLS-blocked from anon
        status: r.status,
        created_at: r.created_at,
        mapped_by_user_id: r.user_id,
      });
    } catch (err) {
      console.error('[trees/:id][mysuru]', err.message);
      return res.status(500).json({ error: 'Failed to fetch Mysuru tree', details: err.message });
    }
  }

  try {
    const query = `
      SELECT
        id, geom, girth_cm, height_m, canopy_dia_m, botanical_name, common_name,
        "CO2_sequestered_kg" AS co2_sequestered_kg,
        economic_i, flowering, ward, wood_density
      FROM public.trees
      WHERE id = $1
    `;
    const result = await queryWithRetry(query, [id]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Tree not found' });
    }
  } catch (err) {
    console.error('Error executing query for /api/trees/:id', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/city-stats', async (req, res) => {
    const cityId = (req.query.cityId || 'pune').toString();

    if (cityId === 'mysuru') {
      // Live count from Supabase mapped_trees (anon-readable; tree_results is
      // RLS-blocked from the public anon role). mapped_trees is the
      // post-verification table — same data the dashboard's /api/trees-live
      // uses to render markers, so the count matches what's on the map.
      res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
      try {
        const bbox = CITY_BBOX.mysuru;

        const countHeaders = new Headers({
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          Prefer: 'count=exact',
          Range: '0-0',
        });
        const countQs = [
          '?select=*',
          '&status=eq.verified',
          `&lat=gte.${bbox.minLat}&lat=lte.${bbox.maxLat}`,
          `&lng=gte.${bbox.minLng}&lng=lte.${bbox.maxLng}`,
        ].join('');
        const countRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/mapped_trees${countQs}`, { headers: countHeaders });
        const contentRange = countRes.headers.get('content-range') || '*/0';
        const totalTrees = parseInt(contentRange.split('/')[1] || '0', 10);

        // mapped_trees has no co2_sequestered_kg column; lifetime CO2 is left
        // at 0 until we add a server-side allometric estimate from dbh+height.
        return res.json({ total_trees: totalTrees, total_co2_annual_kg: 0 });
      } catch (err) {
        console.error('[city-stats][mysuru]', err.message);
        return res.status(500).json({ error: 'Failed to fetch Mysuru stats', details: err.message });
      }
    }

    if (cityId === 'pune') {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
      try {
        const result = await queryWithRetry(`
          SELECT COUNT(*) AS total_trees, SUM("CO2_sequestered_kg") AS total_co2_annual_kg
          FROM public.trees;
        `);
        return res.json(result.rows[0]);
      } catch (err) {
        console.error('Error executing query for /api/city-stats', err.stack);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(400).json({ error: `Unknown cityId: ${cityId}` });
});

app.get('/api/ward-data', async (req, res) => {
    const cityId = (req.query.cityId || 'pune').toString();

    if (cityId === 'mysuru') {
      // No per-ward tree aggregation yet for Mysuru — trees live in Supabase
      // and the spatial join to mysuru_ward_boundaries (DO Postgres) crosses
      // databases. Return an empty list so the dashboard renders a no-data state
      // instead of stale Pune numbers.
      res.setHeader('Cache-Control', 'public, max-age=10');
      return res.json([]);
    }

    if (cityId === 'pune') {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
      try {
        const result = await queryWithRetry(`
          SELECT ward, COUNT(*) AS tree_count, SUM("CO2_sequestered_kg") AS co2_kg
          FROM public.trees
          WHERE ward IS NOT NULL
          GROUP BY ward
          ORDER BY ward::double precision::int;
        `);
        return res.json(result.rows);
      } catch (err) {
        console.error('Error executing query for /api/ward-data', err.stack);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    return res.status(400).json({ error: `Unknown cityId: ${cityId}` });
});

app.post('/api/stats-in-polygon', async (req, res) => {
    const { polygon } = req.body;
    if (!polygon || !polygon.coordinates) {
        return res.status(400).json({ error: 'Invalid polygon provided.' });
    }

    try {
        const polygonGeoJSON = JSON.stringify(polygon);
        const query = `
            SELECT
                COUNT(*) as tree_count,
                COALESCE(SUM("CO2_sequestered_kg"), 0) as co2_kg
            FROM public.trees
            WHERE ST_Contains(ST_GeomFromGeoJSON($1), geom);
        `;
        const result = await queryWithRetry(query, [polygonGeoJSON]);
        res.json(result.rows[0]);
    } catch (err)        {
        console.error('Error executing query for /api/stats-in-polygon', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- NEW API ENDPOINT FOR PLANTING ADVISOR ---
app.get('/api/tree-archetypes', async (req, res) => {
  const cityId = (req.query.cityId || 'pune').toString();
  if (cityId === 'mysuru') {
    // No species archetypes for Mysuru yet — return empty so the Planting Advisor
    // shows its "no data" state rather than Pune's species list.
    return res.json([]);
  }
  try {
    // We only select Summer data for direct comparison, as it represents the peak cooling need.
    const query = `
      SELECT *
      FROM public.tree_archetypes
      WHERE season = 'Summer'
      ORDER BY common_name, id;
    `;
    const { rows } = await queryWithRetry(query);

    // Group the flat list of archetypes by the truncated botanical_name, which is our unique species key
    const groupedBySpecies = rows.reduce((acc, archetype) => {
      let speciesGroup = acc.find(s => s.botanical_name === archetype.botanical_name);
      
      if (!speciesGroup) {
        // If the species group doesn't exist, create it.
        const allArchetypesForThisSpecies = rows.filter(r => r.botanical_name === archetype.botanical_name);
        
        // Find the single best archetype for this species based on the highest P90 cooling effect.
        // This 'best' archetype will be used for ranking in the "Top 3" list.
        const bestArchetype = allArchetypesForThisSpecies.reduce((best, current) => {
            return current.p90_cooling_effect_celsius > best.p90_cooling_effect_celsius ? current : best;
        }, allArchetypesForThisSpecies[0]);

        speciesGroup = {
          common_name: archetype.common_name,
          botanical_name: archetype.botanical_name,
          // Store the entire best archetype object. This gives the frontend all info needed
          // for the "Top 3" display and for auto-filling when a top species is clicked.
          representative_archetype: bestArchetype,
          archetypes: []
        };
        acc.push(speciesGroup);
      }
      
      // Add the current archetype to its species group
      speciesGroup.archetypes.push(archetype);
      
      return acc;
    }, []);

    // Sort the final list of species based on the P90 cooling of their single best archetype
    const sortedSpecies = groupedBySpecies.sort((a, b) =>
        b.representative_archetype.p90_cooling_effect_celsius - a.representative_archetype.p90_cooling_effect_celsius
    );

    res.json(sortedSpecies);

  } catch (err) {
    console.error('Error executing query for /api/tree-archetypes', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});


// --- NEW API ENDPOINT FOR 3D TREE DATA ---
app.post('/api/trees-in-bounds', async (req, res) => {
  const { bounds, limit } = req.body;

  if (!bounds || !bounds.sw || !bounds.ne) {
    return res.status(400).json({ error: 'Invalid bounds provided.' });
  }

  const [swLon, swLat] = bounds.sw;
  const [neLon, neLat] = bounds.ne;

  // Use provided limit or default to 5000
  const MAX_TREES_RETURN = limit || 5000;

  try {
    // This query uses a spatial index on `geom` for high performance.
    // It selects only the necessary columns for 3D rendering and builds a GeoJSON FeatureCollection.
    const query = `
      SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(ST_AsGeoJSON(t.*)::json)
      )
      FROM (
        SELECT
          id,
          geom,
          height_m,
          girth_cm,
          canopy_dia_m
        FROM public.trees
        WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
        LIMIT $5
      ) AS t;
    `;

    const result = await queryWithRetry(query, [swLon, swLat, neLon, neLat, MAX_TREES_RETURN]);
    
    if (result.rows.length > 0 && result.rows[0].json_build_object) {
      res.json(result.rows[0].json_build_object);
    } else {
      // Return an empty FeatureCollection if no trees are found
      res.json({ type: 'FeatureCollection', features: [] });
    }
  } catch (err) {
    console.error('Error executing query for /api/trees-in-bounds', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- NEW API ENDPOINT FOR SUN PATH ANIMATION ---
app.get('/api/sun-path', (req, res) => {
    const { date, lat, lon } = req.query;

    if (!date || !lat || !lon) {
        return res.status(400).json({ error: 'Missing required query parameters: date, lat, lon.' });
    }

    try {
        const targetDate = new Date(date);
        const latitude = parseFloat(lat);      // --- FIX: Removed invalid 'as string' ---
        const longitude = parseFloat(lon);     // --- FIX: Removed invalid 'as string' ---

        const times = SunCalc.getTimes(targetDate, latitude, longitude);
        const sunrise = times.sunrise.getTime();
        const sunset = times.sunset.getTime();

        const sunPath = [];
        const interval = 15 * 60 * 1000; // 15 minutes in milliseconds

        for (let time = sunrise; time <= sunset; time += interval) {
            const currentTime = new Date(time);
            const sunPos = SunCalc.getPosition(currentTime, latitude, longitude);
            
            // Convert azimuth from radians to degrees (0° North, 180° South)
            const azimuthDegrees = sunPos.azimuth * 180 / Math.PI + 180;
            // Altitude is already 0 at horizon, 90 at zenith
            const altitudeRatio = sunPos.altitude;

            sunPath.push({
                timestamp: currentTime.toISOString(),
                azimuth: azimuthDegrees,
                altitude: altitudeRatio,
            });
        }
        res.json(sunPath);
    } catch (error) {
        console.error('Error calculating sun path:', error);
        res.status(500).json({ error: 'Internal server error while calculating sun path.' });
    }
});


// --- NEW API ENDPOINT FOR FILTER METADATA ---
// Returns available options for dropdowns, ranges for sliders
// Cached on Vercel CDN for fast global access
app.get('/api/filter-metadata', async (req, res) => {
  console.log('[filter-metadata] Request received');
  const startTime = Date.now();
  
  // CDN Cache Headers:
  // s-maxage=3600 = Cache on Vercel CDN for 1 hour
  // stale-while-revalidate=86400 = Serve stale for 24h while revalidating in background
  // This means: Users ALWAYS get instant response (cached or stale), database is hit at most once per hour
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  try {
    // Get distinct species names
    const speciesQuery = `
      SELECT DISTINCT common_name 
      FROM public.trees 
      WHERE common_name IS NOT NULL AND common_name != ''
      ORDER BY common_name
      LIMIT 500;
    `;
    
    // Get distinct wards - simple query, sort in JavaScript
    // (Avoids PostgreSQL DISTINCT + ORDER BY expression mismatch error)
    const wardsQuery = `
      SELECT DISTINCT ward
      FROM public.trees 
      WHERE ward IS NOT NULL AND ward != '';
    `;
    
    // Get range values for numeric filters
    const rangesQuery = `
      SELECT
        COALESCE(MIN(height_m), 0) as height_min,
        COALESCE(MAX(height_m), 30) as height_max,
        COALESCE(MIN(canopy_dia_m), 0) as canopy_min,
        COALESCE(MAX(canopy_dia_m), 20) as canopy_max,
        COALESCE(MIN(girth_cm), 0) as girth_min,
        COALESCE(MAX(girth_cm), 500) as girth_max,
        COALESCE(MIN("CO2_sequestered_kg"), 0) as co2_min,
        COALESCE(MAX("CO2_sequestered_kg"), 10000) as co2_max
      FROM public.trees;
    `;
    
    // Get distinct economic importance values
    const economicQuery = `
      SELECT DISTINCT economic_i 
      FROM public.trees 
      WHERE economic_i IS NOT NULL AND economic_i != ''
      ORDER BY economic_i;
    `;
    
    // Run queries - species first (largest), then others in parallel
    // This reduces connection pressure vs all 4 at once
    const speciesResult = await queryWithRetry(speciesQuery);
    
    const [wardsResult, rangesResult, economicResult] = await Promise.all([
      queryWithRetry(wardsQuery),
      queryWithRetry(rangesQuery),
      queryWithRetry(economicQuery)
    ]);
    
    const ranges = rangesResult.rows[0] || {};
    
    // Sort wards in JavaScript - handles numeric and text wards correctly
    const sortedWards = wardsResult.rows
      .map(r => r.ward)
      .map(ward => {
        // Try to convert to integer for numeric wards
        const num = parseFloat(ward);
        return {
          original: ward,
          display: !isNaN(num) ? String(Math.floor(num)) : ward,
          sortKey: !isNaN(num) ? num : 999999
        };
      })
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.display.localeCompare(b.display);
      })
      .map(w => w.display)
      .filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates after floor()
    
    // Get location counts separately with fallback (uses simpler CASE WHEN syntax)
    let locationCounts = { street: 0, nonStreet: 0, total: 0 };
    try {
      const locationCountsQuery = `
        SELECT
          SUM(CASE WHEN distance_to_road_m IS NOT NULL AND distance_to_road_m <= 15 THEN 1 ELSE 0 END) as street_count,
          SUM(CASE WHEN distance_to_road_m IS NULL OR distance_to_road_m > 15 THEN 1 ELSE 0 END) as non_street_count,
          COUNT(*) as total_count
        FROM public.trees;
      `;
      const locationCountsResult = await queryWithRetry(locationCountsQuery);
      if (locationCountsResult.rows[0]) {
        locationCounts = {
          street: parseInt(locationCountsResult.rows[0].street_count) || 0,
          nonStreet: parseInt(locationCountsResult.rows[0].non_street_count) || 0,
          total: parseInt(locationCountsResult.rows[0].total_count) || 0
        };
      }
    } catch (locErr) {
      console.error('Error getting location counts (non-fatal):', locErr.message);
      // Continue without location counts - they're optional
    }
    
    const responseData = {
      species: speciesResult.rows.map(r => r.common_name),
      wards: sortedWards,
      heightRange: {
        min: Math.floor(parseFloat(ranges.height_min) || 0),
        max: Math.ceil(parseFloat(ranges.height_max) || 30)
      },
      canopyRange: {
        min: Math.floor(parseFloat(ranges.canopy_min) || 0),
        max: Math.ceil(parseFloat(ranges.canopy_max) || 20)
      },
      girthRange: {
        min: Math.floor(parseFloat(ranges.girth_min) || 0),
        max: Math.ceil(parseFloat(ranges.girth_max) || 500)
      },
      co2Range: {
        min: Math.floor(parseFloat(ranges.co2_min) || 0),
        max: Math.ceil(parseFloat(ranges.co2_max) || 10000)
      },
      economicImportanceOptions: economicResult.rows.map(r => r.economic_i),
      locationCounts
    };
    
    console.log(`[filter-metadata] Success in ${Date.now() - startTime}ms - Species: ${responseData.species.length}, Wards: ${responseData.wards.length}`);
    res.json(responseData);
  } catch (err) {
    console.error(`[filter-metadata] Error after ${Date.now() - startTime}ms:`, err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});


// --- NEW API ENDPOINT FOR FILTERED STATS ---
// Returns aggregated stats based on applied filters
app.post('/api/filtered-stats', async (req, res) => {
  const { filters = {} } = req.body || {};
  
  try {
    // Build WHERE clauses based on filters
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    // Location type filter
    if (filters.locationType && filters.locationType !== 'all') {
      if (filters.locationType === 'street') {
        conditions.push(`distance_to_road_m IS NOT NULL AND distance_to_road_m <= 15`);
      } else if (filters.locationType === 'non-street') {
        conditions.push(`(distance_to_road_m > 15 OR distance_to_road_m IS NULL)`);
      }
    }
    
    // Species filter
    if (filters.species && filters.species.length > 0) {
      conditions.push(`common_name = ANY($${paramIndex})`);
      params.push(filters.species);
      paramIndex++;
    }
    
    // Ward filter - handle both integer format (from UI) and original format (in DB)
    if (filters.wards && filters.wards.length > 0) {
      // Match wards that when truncated to integer equal the selected ward
      conditions.push(`(
        ward = ANY($${paramIndex}) OR 
        (ward ~ '^[0-9.]+$' AND FLOOR(ward::numeric)::text = ANY($${paramIndex}))
      )`);
      params.push(filters.wards);
      paramIndex++;
    }
    
    // Height range filter
    if (filters.height) {
      if (filters.height.min !== null) {
        conditions.push(`height_m >= $${paramIndex}`);
        params.push(filters.height.min);
        paramIndex++;
      }
      if (filters.height.max !== null) {
        conditions.push(`height_m <= $${paramIndex}`);
        params.push(filters.height.max);
        paramIndex++;
      }
    }
    
    // Canopy diameter range filter
    if (filters.canopyDiameter) {
      if (filters.canopyDiameter.min !== null) {
        conditions.push(`canopy_dia_m >= $${paramIndex}`);
        params.push(filters.canopyDiameter.min);
        paramIndex++;
      }
      if (filters.canopyDiameter.max !== null) {
        conditions.push(`canopy_dia_m <= $${paramIndex}`);
        params.push(filters.canopyDiameter.max);
        paramIndex++;
      }
    }
    
    // Girth range filter
    if (filters.girth) {
      if (filters.girth.min !== null) {
        conditions.push(`girth_cm >= $${paramIndex}`);
        params.push(filters.girth.min);
        paramIndex++;
      }
      if (filters.girth.max !== null) {
        conditions.push(`girth_cm <= $${paramIndex}`);
        params.push(filters.girth.max);
        paramIndex++;
      }
    }
    
    // CO2 sequestered range filter
    if (filters.co2Sequestered) {
      if (filters.co2Sequestered.min !== null) {
        conditions.push(`"CO2_sequestered_kg" >= $${paramIndex}`);
        params.push(filters.co2Sequestered.min);
        paramIndex++;
      }
      if (filters.co2Sequestered.max !== null) {
        conditions.push(`"CO2_sequestered_kg" <= $${paramIndex}`);
        params.push(filters.co2Sequestered.max);
        paramIndex++;
      }
    }
    
    // Flowering filter
    if (filters.flowering !== null && filters.flowering !== undefined) {
      if (filters.flowering === true) {
        conditions.push(`flowering IS NOT NULL AND flowering != '' AND LOWER(flowering) != 'no'`);
      } else {
        conditions.push(`(flowering IS NULL OR flowering = '' OR LOWER(flowering) = 'no')`);
      }
    }
    
    // Economic importance filter
    if (filters.economicImportance) {
      conditions.push(`economic_i = $${paramIndex}`);
      params.push(filters.economicImportance);
      paramIndex++;
    }
    
    // Build the final query
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT
        COUNT(*) AS total_trees,
        COALESCE(SUM("CO2_sequestered_kg"), 0) AS total_co2_kg
      FROM public.trees
      ${whereClause};
    `;
    
    const result = await queryWithRetry(query, params);
    res.json({
      total_trees: parseInt(result.rows[0]?.total_trees) || 0,
      total_co2_kg: parseFloat(result.rows[0]?.total_co2_kg) || 0
    });
  } catch (err) {
    console.error('Error executing query for /api/filtered-stats', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});


// --- NEW API ENDPOINT FOR DYNAMIC CHART DATA ---
// Flexible aggregation endpoint for the chart builder
app.post('/api/chart-data', async (req, res) => {
  const { groupBy, metric, sortBy, sortOrder, limit, cityId } = req.body;
  const city = (cityId || 'pune').toString();

  // Mysuru's mapped_trees has no per-ward / per-species aggregations the
  // dashboard's current chart presets assume. Return an empty data set so
  // the chart renders its no-data state instead of Pune's numbers.
  if (city === 'mysuru') {
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.json({ data: [], _meta: { source: 'mysuru - no chart aggregations yet' } });
  }

  // Validate required fields
  if (!groupBy || !metric) {
    return res.status(400).json({ error: 'groupBy and metric are required' });
  }

  try {
    // Build the GROUP BY expression based on field
    let groupByExpr;
    let groupByAlias = 'name';
    
    switch (groupBy) {
      case 'ward':
        groupByExpr = `COALESCE(FLOOR(ward::numeric)::text, 'Unknown')`;
        break;
      case 'species':
        groupByExpr = `COALESCE(NULLIF(common_name, ''), 'Unknown')`;
        break;
      case 'economic_importance':
        groupByExpr = `COALESCE(NULLIF(economic_i, ''), 'Not Specified')`;
        break;
      case 'flowering':
        groupByExpr = `CASE 
          WHEN flowering IS NULL OR flowering = '' THEN 'Unknown'
          WHEN LOWER(flowering) = 'no' THEN 'Non-Flowering'
          ELSE 'Flowering'
        END`;
        break;
      case 'location_type':
        groupByExpr = `CASE 
          WHEN distance_to_road_m IS NULL THEN 'Unknown'
          WHEN distance_to_road_m <= 15 THEN 'Street Trees'
          ELSE 'Non-Street Trees'
        END`;
        break;
      case 'height_category':
        groupByExpr = `CASE 
          WHEN height_m IS NULL THEN 'Unknown'
          WHEN height_m < 5 THEN '1. Short (<5m)'
          WHEN height_m >= 5 AND height_m < 10 THEN '2. Medium (5-10m)'
          WHEN height_m >= 10 AND height_m < 15 THEN '3. Tall (10-15m)'
          ELSE '4. Very Tall (>15m)'
        END`;
        break;
      case 'canopy_category':
        groupByExpr = `CASE 
          WHEN canopy_dia_m IS NULL THEN 'Unknown'
          WHEN canopy_dia_m < 3 THEN '1. Small (<3m)'
          WHEN canopy_dia_m >= 3 AND canopy_dia_m < 6 THEN '2. Medium (3-6m)'
          WHEN canopy_dia_m >= 6 AND canopy_dia_m < 10 THEN '3. Large (6-10m)'
          ELSE '4. Very Large (>10m)'
        END`;
        break;
      default:
        return res.status(400).json({ error: `Invalid groupBy field: ${groupBy}` });
    }
    
    // Build the metric expression
    let metricExpr;
    let metricAlias = 'value';
    
    switch (metric) {
      case 'count':
        metricExpr = 'COUNT(*)';
        break;
      case 'sum_co2':
        metricExpr = 'COALESCE(SUM("CO2_sequestered_kg") / 1000, 0)'; // Convert to tons
        break;
      case 'avg_height':
        metricExpr = 'COALESCE(ROUND(AVG(height_m)::numeric, 2), 0)';
        break;
      case 'avg_canopy':
        metricExpr = 'COALESCE(ROUND(AVG(canopy_dia_m)::numeric, 2), 0)';
        break;
      case 'avg_girth':
        metricExpr = 'COALESCE(ROUND(AVG(girth_cm)::numeric, 2), 0)';
        break;
      default:
        return res.status(400).json({ error: `Invalid metric field: ${metric}` });
    }
    
    // Build ORDER BY clause
    const orderByField = sortBy === 'label' ? groupByAlias : metricAlias;
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    // Build LIMIT clause
    const limitClause = limit && limit > 0 ? `LIMIT ${parseInt(limit)}` : '';
    
    // Build and execute the query
    const query = `
      SELECT 
        ${groupByExpr} AS ${groupByAlias},
        ${metricExpr} AS ${metricAlias}
      FROM public.trees
      GROUP BY ${groupByExpr}
      HAVING ${groupByExpr} IS NOT NULL
      ORDER BY ${orderByField} ${orderDirection}
      ${limitClause};
    `;
    
    const result = await queryWithRetry(query);
    
    // Also get total for context
    const totalQuery = `SELECT COUNT(*) as total FROM public.trees;`;
    const totalResult = await queryWithRetry(totalQuery);
    
    res.json({
      data: result.rows.map(row => ({
        name: String(row.name),
        value: parseFloat(row.value) || 0
      })),
      total: parseInt(totalResult.rows[0]?.total) || 0,
      groupBy,
      metric
    });
    
  } catch (err) {
    console.error('Error executing query for /api/chart-data', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});


// =====================================================
// LAND COVER ANALYSIS ENDPOINTS (Concrete vs Trees)
// =====================================================

/**
 * GET /api/ward-boundaries?cityId=pune|mysuru
 * Returns ward polygons as a GeoJSON FeatureCollection.
 * Default cityId is 'pune' for backwards compatibility.
 * Cached for 1 hour, stale for 24 hours (polygon data rarely changes).
 */
app.get('/api/ward-boundaries', async (req, res) => {
  const cityId = (req.query.cityId || 'pune').toString();
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    let query;
    let rowToFeature;

    if (cityId === 'mysuru') {
      query = `
        SELECT ward_no, ward_name, ward_code, area_m2, tree_count,
               ST_AsGeoJSON(geometry)::json AS geometry
        FROM mysuru_ward_boundaries
        ORDER BY ward_no;
      `;
      rowToFeature = row => ({
        type: 'Feature',
        properties: {
          ward_number: row.ward_no,
          ward_name: row.ward_name,
          ward_code: row.ward_code,
          area_m2: row.area_m2,
          tree_count: row.tree_count,
        },
        geometry: row.geometry,
      });
    } else if (cityId === 'pune') {
      query = `
        SELECT ward_number, ward_office, prabhag_name, zone, tree_count,
               ST_AsGeoJSON(geometry)::json AS geometry
        FROM ward_polygons
        ORDER BY ward_number;
      `;
      rowToFeature = row => ({
        type: 'Feature',
        properties: {
          ward_number: row.ward_number,
          ward_office: row.ward_office,
          prabhag_name: row.prabhag_name,
          zone: row.zone,
          tree_count: row.tree_count,
        },
        geometry: row.geometry,
      });
    } else {
      return res.status(400).json({ error: `Unknown cityId: ${cityId}` });
    }

    const result = await queryWithRetry(query);

    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(rowToFeature),
    });
  } catch (err) {
    console.error(`Error fetching ward boundaries for cityId=${cityId}:`, err.message);

    if (err.message.includes('does not exist')) {
      return res.json({
        type: 'FeatureCollection',
        features: [],
        error: `Ward boundaries table for ${cityId} not yet imported.`,
      });
    }
    return res.status(500).json({ error: 'Failed to fetch ward boundaries', details: err.message });
  }
});

/**
 * GET /api/ward-stats
 * Returns tree statistics aggregated by ward from census data
 * Cached for 30 min (census data updates infrequently)
 */
app.get('/api/ward-stats', async (req, res) => {
  // CDN caching: Ward stats change rarely
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  
  try {
    const query = `
      SELECT 
        ROUND(ward::numeric)::integer as ward_number,
        COUNT(*) as tree_count,
        COUNT(DISTINCT common_name) as species_count,
        ROUND(AVG(canopy_dia_m)::numeric, 2) as avg_canopy_m,
        ROUND(AVG(girth_cm)::numeric, 2) as avg_girth_cm,
        ROUND(AVG(height_m)::numeric, 2) as avg_height_m,
        ROUND(SUM(canopy_dia_m * canopy_dia_m * 0.785)::numeric, 2) as total_canopy_area_m2
      FROM trees
      WHERE ward IS NOT NULL
      GROUP BY ROUND(ward::numeric)::integer
      ORDER BY ROUND(ward::numeric)::integer;
    `;
    
    const result = await queryWithRetry(query);
    
    // Add derived metrics
    const stats = result.rows.map(row => ({
      ...row,
      tree_count: parseInt(row.tree_count),
      species_count: parseInt(row.species_count),
      avg_canopy_m: parseFloat(row.avg_canopy_m) || 0,
      avg_girth_cm: parseFloat(row.avg_girth_cm) || 0,
      avg_height_m: parseFloat(row.avg_height_m) || 0,
      total_canopy_area_m2: parseFloat(row.total_canopy_area_m2) || 0,
      // Estimated canopy area in hectares
      total_canopy_area_ha: parseFloat((row.total_canopy_area_m2 / 10000).toFixed(2)) || 0
    }));
    
    res.json({
      data: stats,
      total_wards: stats.length,
      summary: {
        total_trees: stats.reduce((sum, w) => sum + w.tree_count, 0),
        total_species: new Set(stats.flatMap(w => w.species_count)).size,
        total_canopy_area_ha: stats.reduce((sum, w) => sum + w.total_canopy_area_ha, 0).toFixed(2)
      }
    });
  } catch (err) {
    console.error('Error fetching ward stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch ward statistics', details: err.message });
  }
});

/**
 * GET /api/land-cover/wards
 * Returns land cover statistics per ward from GEE export data
 * Cached for 1 hour (satellite data updates infrequently)
 */
app.get('/api/land-cover/wards', async (req, res) => {
  // CDN caching: Land cover data is quasi-static
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  try {
    // Check if land_cover_stats table exists
    const tableCheck = await queryWithRetry(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'land_cover_stats'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      // Fetch from database
      const result = await queryWithRetry(`
        SELECT 
          ward_number,
          year,
          total_area_m2,
          trees_area_m2,
          built_area_m2,
          grass_area_m2,
          bare_area_m2,
          trees_pct,
          built_pct,
          grass_pct,
          bare_pct
        FROM land_cover_stats
        ORDER BY ward_number, year;
      `);
      
      res.json({
        source: 'database',
        data: result.rows
      });
    } else {
      // Return placeholder message
      res.json({
        source: 'pending',
        message: 'Land cover data not yet imported. Run GEE export scripts first.',
        instructions: [
          '1. Open scripts/gee-land-cover-export.js in Google Earth Engine',
          '2. Run the exports to Google Drive',
          '3. Download the CSV files',
          '4. Import using scripts/import-land-cover.cjs'
        ],
        sampleData: generateSampleLandCoverData()
      });
    }
  } catch (err) {
    console.error('Error fetching land cover data:', err.message);
    res.status(500).json({ error: 'Failed to fetch land cover data', details: err.message });
  }
});

/**
 * GET /api/land-cover/comparison
 * Returns comparison between years - supports year-over-year and overall change
 * Cached for 1 hour (historical data doesn't change)
 */
app.get('/api/land-cover/comparison', async (req, res) => {
  // CDN caching: Historical comparison data is static
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  try {
    const fromYear = parseInt(req.query.from_year) || 2019;
    const toYear = parseInt(req.query.to_year) || 2025;
    
    const tableCheck = await queryWithRetry(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'land_cover_change'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      const result = await queryWithRetry(`
        SELECT 
          ward_number,
          from_year,
          to_year,
          period,
          trees_lost_m2,
          trees_gained_m2,
          net_tree_change_m2,
          built_gained_m2,
          trees_to_built_m2
        FROM land_cover_change
        WHERE from_year = $1 AND to_year = $2
        ORDER BY ward_number;
      `, [fromYear, toYear]);
      
      // Calculate summary
      const summary = result.rows.reduce((acc, row) => ({
        total_trees_lost_m2: acc.total_trees_lost_m2 + (parseFloat(row.trees_lost_m2) || 0),
        total_trees_gained_m2: acc.total_trees_gained_m2 + (parseFloat(row.trees_gained_m2) || 0),
        total_built_gained_m2: acc.total_built_gained_m2 + (parseFloat(row.built_gained_m2) || 0),
        total_trees_to_built_m2: acc.total_trees_to_built_m2 + (parseFloat(row.trees_to_built_m2) || 0)
      }), {
        total_trees_lost_m2: 0,
        total_trees_gained_m2: 0,
        total_built_gained_m2: 0,
        total_trees_to_built_m2: 0
      });
      
      summary.net_tree_change_m2 = summary.total_trees_gained_m2 - summary.total_trees_lost_m2;
      summary.net_tree_change_ha = (summary.net_tree_change_m2 / 10000).toFixed(2);
      summary.total_trees_lost_ha = (summary.total_trees_lost_m2 / 10000).toFixed(2);
      summary.total_trees_gained_ha = (summary.total_trees_gained_m2 / 10000).toFixed(2);
      summary.total_built_gained_ha = (summary.total_built_gained_m2 / 10000).toFixed(2);
      summary.period = `${fromYear} to ${toYear}`;
      
      res.json({
        source: 'database',
        from_year: fromYear,
        to_year: toYear,
        data: result.rows,
        summary: summary
      });
    } else {
      res.json({
        source: 'pending',
        message: 'Land cover change data not yet imported.',
        instructions: [
          '1. Run scripts/gee-ward-analysis.js in Google Earth Engine',
          '2. Export the change detection CSV',
          '3. Import using scripts/import-land-cover.cjs'
        ]
      });
    }
  } catch (err) {
    console.error('Error fetching land cover comparison:', err.message);
    res.status(500).json({ error: 'Failed to fetch comparison data', details: err.message });
  }
});

/**
 * GET /api/land-cover/timeline
 * Returns historical timeline of land cover changes (2019-2025)
 * Cached for 1 hour (timeline data is historical)
 */
app.get('/api/land-cover/timeline', async (req, res) => {
  // CDN caching: Timeline data is historical/static
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  try {
    // Get city-wide averages per year
    const yearlyStats = await queryWithRetry(`
      SELECT 
        year,
        COUNT(*) as ward_count,
        ROUND(AVG(trees_pct)::numeric, 2) as avg_trees_pct,
        ROUND(AVG(built_pct)::numeric, 2) as avg_built_pct,
        ROUND(AVG(grass_pct)::numeric, 2) as avg_grass_pct,
        ROUND(AVG(bare_pct)::numeric, 2) as avg_bare_pct,
        ROUND(SUM(trees_area_m2)::numeric, 0) as total_trees_area_m2,
        ROUND(SUM(built_area_m2)::numeric, 0) as total_built_area_m2
      FROM land_cover_stats
      GROUP BY year
      ORDER BY year;
    `);
    
    // Get year-over-year changes
    const yoyChanges = await queryWithRetry(`
      SELECT 
        from_year,
        to_year,
        period,
        ROUND(SUM(trees_lost_m2)::numeric, 0) as total_trees_lost_m2,
        ROUND(SUM(trees_gained_m2)::numeric, 0) as total_trees_gained_m2,
        ROUND(SUM(net_tree_change_m2)::numeric, 0) as net_tree_change_m2,
        ROUND(SUM(built_gained_m2)::numeric, 0) as total_built_gained_m2,
        ROUND(SUM(trees_to_built_m2)::numeric, 0) as trees_to_built_m2
      FROM land_cover_change
      WHERE from_year != 2019 OR to_year != 2025  -- Exclude overall
      GROUP BY from_year, to_year, period
      ORDER BY from_year;
    `);
    
    // Get overall 2019-2025 change
    const overallChange = await queryWithRetry(`
      SELECT 
        ROUND(SUM(trees_lost_m2)::numeric, 0) as total_trees_lost_m2,
        ROUND(SUM(trees_gained_m2)::numeric, 0) as total_trees_gained_m2,
        ROUND(SUM(net_tree_change_m2)::numeric, 0) as net_tree_change_m2,
        ROUND(SUM(built_gained_m2)::numeric, 0) as total_built_gained_m2,
        ROUND(SUM(trees_to_built_m2)::numeric, 0) as trees_to_built_m2
      FROM land_cover_change
      WHERE from_year = 2019 AND to_year = 2025;
    `);
    
    res.json({
      source: 'database',
      years: yearlyStats.rows.map(r => ({
        ...r,
        total_trees_area_ha: (r.total_trees_area_m2 / 10000).toFixed(2),
        total_built_area_ha: (r.total_built_area_m2 / 10000).toFixed(2)
      })),
      year_over_year_changes: yoyChanges.rows.map(r => ({
        ...r,
        net_tree_change_ha: (r.net_tree_change_m2 / 10000).toFixed(2)
      })),
      overall_2019_2025: overallChange.rows[0] ? {
        ...overallChange.rows[0],
        total_trees_lost_ha: (overallChange.rows[0].total_trees_lost_m2 / 10000).toFixed(2),
        total_trees_gained_ha: (overallChange.rows[0].total_trees_gained_m2 / 10000).toFixed(2),
        net_tree_change_ha: (overallChange.rows[0].net_tree_change_m2 / 10000).toFixed(2),
        total_built_gained_ha: (overallChange.rows[0].total_built_gained_m2 / 10000).toFixed(2)
      } : null
    });
  } catch (err) {
    console.error('Error fetching land cover timeline:', err.message);
    res.status(500).json({ error: 'Failed to fetch timeline data', details: err.message });
  }
});

/**
 * GET /api/census-validation
 * Returns tree census validation data comparing census trees to satellite detection
 */
app.get('/api/census-validation', async (req, res) => {
  try {
    // This query finds trees in areas currently classified as non-tree by satellite
    // Requires land_cover raster or point samples to be imported
    const tableCheck = await queryWithRetry(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'land_cover_points'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      // Join trees with land cover classification
      const result = await queryWithRetry(`
        SELECT 
          t.ward::integer as ward_number,
          COUNT(*) as total_trees,
          SUM(CASE WHEN lc.land_class = 'trees' THEN 1 ELSE 0 END) as confirmed_trees,
          SUM(CASE WHEN lc.land_class = 'built' THEN 1 ELSE 0 END) as now_built,
          SUM(CASE WHEN lc.land_class = 'bare' THEN 1 ELSE 0 END) as now_bare,
          SUM(CASE WHEN lc.land_class IS NULL THEN 1 ELSE 0 END) as unclassified
        FROM trees t
        LEFT JOIN land_cover_points lc 
          ON ST_DWithin(t.geom, lc.geom, 0.0001)
        WHERE t.ward IS NOT NULL
        GROUP BY t.ward::integer
        ORDER BY t.ward::integer;
      `);
      
      res.json({
        source: 'database',
        data: result.rows,
        validation_date: new Date().toISOString()
      });
    } else {
      res.json({
        source: 'pending',
        message: 'Census validation requires land cover point data. This will be available after GEE analysis.',
        methodology: {
          step1: 'Export Dynamic World classification for tree locations',
          step2: 'Create point samples at each census tree location',
          step3: 'Compare census tree presence with satellite classification',
          step4: 'Flag discrepancies for field verification'
        }
      });
    }
  } catch (err) {
    console.error('Error fetching census validation:', err.message);
    res.status(500).json({ error: 'Failed to fetch validation data', details: err.message });
  }
});

// ============================================================================
// PERFORMANCE OPTIMIZATION ENDPOINTS
// ============================================================================

/**
 * GET /api/warm-up
 * Warms up database connection pool to reduce cold start latency
 * Call this endpoint periodically (e.g., every 5 min via cron) to keep connections warm
 */
app.get('/api/warm-up', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Run a simple query to warm up the connection
    await queryWithRetry('SELECT 1 as ping');
    
    const warmupTime = Date.now() - startTime;
    
    res.json({
      status: 'warm',
      latency_ms: warmupTime,
      timestamp: new Date().toISOString(),
      pool_stats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'cold',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/green-cover/bundle
 * Returns ALL Green Cover Monitor data in a single request
 * This eliminates 4 separate API calls and reduces cold start impact
 * Cached for 1 hour with 24h stale-while-revalidate
 */
app.get('/api/green-cover/bundle', async (req, res) => {
  const startTime = Date.now();
  
  // Heavy CDN caching - this is the most impactful optimization
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  
  try {
    console.log('[green-cover/bundle] Fetching bundled data...');
    
    // Run all queries in parallel for maximum speed
    const [timelineResult, wardsResult, comparisonResult, statsResult] = await Promise.all([
      // Timeline data
      (async () => {
        const yearlyStats = await queryWithRetry(`
          SELECT 
            year, COUNT(*) as ward_count,
            ROUND(AVG(trees_pct)::numeric, 2) as avg_trees_pct,
            ROUND(AVG(built_pct)::numeric, 2) as avg_built_pct,
            ROUND(SUM(trees_area_m2)::numeric, 0) as total_trees_area_m2,
            ROUND(SUM(built_area_m2)::numeric, 0) as total_built_area_m2
          FROM land_cover_stats GROUP BY year ORDER BY year;
        `);
        
        const yoyChanges = await queryWithRetry(`
          SELECT from_year, to_year, period,
            ROUND(SUM(trees_lost_m2)::numeric, 0) as total_trees_lost_m2,
            ROUND(SUM(trees_gained_m2)::numeric, 0) as total_trees_gained_m2,
            ROUND(SUM(net_tree_change_m2)::numeric, 0) as net_tree_change_m2
          FROM land_cover_change
          WHERE from_year != 2019 OR to_year != 2025
          GROUP BY from_year, to_year, period ORDER BY from_year;
        `);
        
        const overall = await queryWithRetry(`
          SELECT 
            ROUND(SUM(trees_lost_m2)::numeric, 0) as total_trees_lost_m2,
            ROUND(SUM(trees_gained_m2)::numeric, 0) as total_trees_gained_m2,
            ROUND(SUM(net_tree_change_m2)::numeric, 0) as net_tree_change_m2,
            ROUND(SUM(built_gained_m2)::numeric, 0) as total_built_gained_m2
          FROM land_cover_change WHERE from_year = 2019 AND to_year = 2025;
        `);
        
        return {
          source: 'database',
          years: yearlyStats.rows.map(r => ({
            ...r,
            total_trees_area_ha: (r.total_trees_area_m2 / 10000).toFixed(2),
            total_built_area_ha: (r.total_built_area_m2 / 10000).toFixed(2)
          })),
          year_over_year_changes: yoyChanges.rows.map(r => ({
            ...r,
            net_tree_change_ha: (r.net_tree_change_m2 / 10000).toFixed(2)
          })),
          overall_2019_2025: overall.rows[0] ? {
            ...overall.rows[0],
            total_trees_lost_ha: (overall.rows[0].total_trees_lost_m2 / 10000).toFixed(2),
            total_trees_gained_ha: (overall.rows[0].total_trees_gained_m2 / 10000).toFixed(2),
            net_tree_change_ha: (overall.rows[0].net_tree_change_m2 / 10000).toFixed(2),
            total_built_gained_ha: (overall.rows[0].total_built_gained_m2 / 10000).toFixed(2)
          } : null
        };
      })(),
      
      // Wards land cover data
      queryWithRetry(`
        SELECT ward_number, year, total_area_m2, trees_area_m2, built_area_m2,
               grass_area_m2, bare_area_m2, trees_pct, built_pct, grass_pct, bare_pct
        FROM land_cover_stats ORDER BY ward_number, year;
      `),
      
      // Comparison data
      queryWithRetry(`
        SELECT ward_number, from_year, to_year, trees_lost_m2, trees_gained_m2,
               net_tree_change_m2, built_gained_m2
        FROM land_cover_change WHERE from_year = 2019 AND to_year = 2025
        ORDER BY ward_number;
      `),
      
      // Ward stats from tree census
      queryWithRetry(`
        SELECT 
          ROUND(ward::numeric)::integer as ward_number,
          COUNT(*) as tree_count,
          COUNT(DISTINCT common_name) as species_count,
          ROUND(AVG(canopy_dia_m)::numeric, 2) as avg_canopy_m,
          ROUND(AVG(girth_cm)::numeric, 2) as avg_girth_cm,
          ROUND(AVG(height_m)::numeric, 2) as avg_height_m,
          ROUND(SUM(canopy_dia_m * canopy_dia_m * 0.785)::numeric, 2) as total_canopy_area_m2
        FROM trees WHERE ward IS NOT NULL
        GROUP BY ROUND(ward::numeric)::integer
        ORDER BY ROUND(ward::numeric)::integer;
      `)
    ]);
    
    const queryTime = Date.now() - startTime;
    console.log(`[green-cover/bundle] Completed in \${queryTime}ms`);
    
    res.json({
      timeline: timelineResult,
      wards: { source: 'database', data: wardsResult.rows },
      comparison: { source: 'database', data: comparisonResult.rows },
      wardStats: {
        data: statsResult.rows.map(row => ({
          ...row,
          tree_count: parseInt(row.tree_count),
          species_count: parseInt(row.species_count),
          total_canopy_area_ha: parseFloat((row.total_canopy_area_m2 / 10000).toFixed(2)) || 0
        }))
      },
      _meta: {
        query_time_ms: queryTime,
        cached: false,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[green-cover/bundle] Error:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch green cover data', 
      details: err.message 
    });
  }
});

/**
 * GET /api/startup-bundle
 * Returns ALL essential data for app startup in a single request
 * Includes: city stats, ward data, filter metadata
 * This is called on app load to pre-populate stores
 */
app.get('/api/startup-bundle', async (req, res) => {
  const startTime = Date.now();
  
  // Cache for 30 min, serve stale for 24h
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  
  try {
    console.log('[startup-bundle] Fetching essential startup data...');
    
    const [cityStats, wardData, filterMetadata] = await Promise.all([
      // City stats
      queryWithRetry(`
        SELECT COUNT(*) AS total_trees, SUM("CO2_sequestered_kg") AS total_co2_annual_kg
        FROM public.trees;
      `),
      
      // Ward data
      queryWithRetry(`
        SELECT ward, COUNT(*) AS tree_count, SUM("CO2_sequestered_kg") AS co2_kg
        FROM public.trees WHERE ward IS NOT NULL
        GROUP BY ward ORDER BY ward::double precision::int;
      `),
      
      // Filter metadata (species, wards, ranges)
      (async () => {
        const [species, wards, ranges, economic] = await Promise.all([
          queryWithRetry(`SELECT DISTINCT common_name FROM public.trees WHERE common_name IS NOT NULL AND common_name != '' ORDER BY common_name LIMIT 500;`),
          queryWithRetry(`SELECT DISTINCT ward FROM public.trees WHERE ward IS NOT NULL AND ward != '';`),
          queryWithRetry(`SELECT COALESCE(MIN(height_m), 0) as height_min, COALESCE(MAX(height_m), 30) as height_max, COALESCE(MIN(canopy_dia_m), 0) as canopy_min, COALESCE(MAX(canopy_dia_m), 20) as canopy_max, COALESCE(MIN(girth_cm), 0) as girth_min, COALESCE(MAX(girth_cm), 500) as girth_max, COALESCE(MIN("CO2_sequestered_kg"), 0) as co2_min, COALESCE(MAX("CO2_sequestered_kg"), 10000) as co2_max FROM public.trees;`),
          queryWithRetry(`SELECT DISTINCT economic_i FROM public.trees WHERE economic_i IS NOT NULL AND economic_i != '' ORDER BY economic_i;`)
        ]);
        
        const sortedWards = wards.rows.map(r => r.ward).map(ward => {
          const num = parseFloat(ward);
          return { original: ward, display: !isNaN(num) ? String(Math.floor(num)) : ward, sortKey: !isNaN(num) ? num : 999999 };
        }).sort((a, b) => a.sortKey !== b.sortKey ? a.sortKey - b.sortKey : a.display.localeCompare(b.display))
          .map(w => w.display).filter((v, i, arr) => arr.indexOf(v) === i);
        
        const r = ranges.rows[0] || {};
        return {
          species: species.rows.map(row => row.common_name),
          wards: sortedWards,
          heightRange: { min: Math.floor(parseFloat(r.height_min) || 0), max: Math.ceil(parseFloat(r.height_max) || 30) },
          canopyRange: { min: Math.floor(parseFloat(r.canopy_min) || 0), max: Math.ceil(parseFloat(r.canopy_max) || 20) },
          girthRange: { min: Math.floor(parseFloat(r.girth_min) || 0), max: Math.ceil(parseFloat(r.girth_max) || 500) },
          co2Range: { min: Math.floor(parseFloat(r.co2_min) || 0), max: Math.ceil(parseFloat(r.co2_max) || 10000) },
          economicImportanceOptions: economic.rows.map(row => row.economic_i)
        };
      })()
    ]);
    
    const queryTime = Date.now() - startTime;
    console.log(`[startup-bundle] Completed in \${queryTime}ms`);
    
    res.json({
      cityStats: cityStats.rows[0],
      wardData: wardData.rows,
      filterMetadata,
      _meta: {
        query_time_ms: queryTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[startup-bundle] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch startup data', details: err.message });
  }
});

/**
 * Helper: Generate sample land cover data for UI development
 * This will be replaced with real GEE data
 */
function generateSampleLandCoverData() {
  const sampleWards = [];
  for (let i = 1; i <= 77; i++) {
    // Generate realistic-ish percentages for Pune
    const builtPct = 40 + Math.random() * 35; // 40-75% built
    const treesPct = 8 + Math.random() * 20;  // 8-28% trees
    const grassPct = 5 + Math.random() * 15;  // 5-20% grass
    const barePct = 100 - builtPct - treesPct - grassPct; // remainder
    
    sampleWards.push({
      ward_number: i,
      year: 2025,
      trees_pct: parseFloat(treesPct.toFixed(1)),
      built_pct: parseFloat(builtPct.toFixed(1)),
      grass_pct: parseFloat(grassPct.toFixed(1)),
      bare_pct: parseFloat(Math.max(0, barePct).toFixed(1)),
      is_sample: true
    });
  }
  return sampleWards;
}


// --- Live Trees Endpoint (city-aware, primarily Mysuru / Supabase) ---
// Pune trees come from PMTiles (1.79M census) and aren't served here.
// For Mysuru: reads tree_results live from Supabase, filtered by city bbox,
// excluding deleted rows and PENDING_ANALYSIS submissions.
// Returns: { trees: [{id, lat, lng, species_name, status, created_at, co2_sequestered_kg}], count, _meta }
app.get('/api/trees-live', async (req, res) => {
  const cityId = (req.query.cityId || 'mysuru').toString();
  const startTime = Date.now();

  try {
    if (cityId === 'mysuru') {
      // Reads the public mapped_trees table on Supabase (the post-verification
      // "official" tree records). tree_results has stricter RLS and is not
      // anon-readable. mapped_trees mirrors verified submissions and is open.
      const bbox = CITY_BBOX.mysuru;
      const query = [
        'mapped_trees',
        '?select=id,lat,lng,species_name,status,height_m,dbh_cm,created_at',
        '&status=eq.verified',
        `&lat=gte.${bbox.minLat}&lat=lte.${bbox.maxLat}`,
        `&lng=gte.${bbox.minLng}&lng=lte.${bbox.maxLng}`,
        '&order=created_at.desc',
        '&limit=5000',
      ].join('');

      const rows = await supabaseFetch(query);

      const trees = (Array.isArray(rows) ? rows : []).map(r => ({
        id: r.id,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        species_name: r.species_name || 'Unknown',
        status: r.status,
        created_at: r.created_at,
        height_m: r.height_m != null ? parseFloat(r.height_m) : null,
        dbh_cm: r.dbh_cm != null ? parseFloat(r.dbh_cm) : null,
        // mapped_trees has no co2_sequestered_kg; left null until we add
        // a server-side estimate from dbh+height
        co2_sequestered_kg: null,
        image_url: null,
      }));

      res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
      return res.json({
        trees,
        count: trees.length,
        _meta: { query_time_ms: Date.now() - startTime, source: 'supabase:mapped_trees' },
      });
    }

    if (cityId === 'pune') {
      return res.json({
        trees: [],
        count: 0,
        _meta: { source: 'n/a - Pune uses PMTiles', query_time_ms: Date.now() - startTime },
      });
    }

    return res.status(400).json({ error: `Unknown cityId: ${cityId}` });
  } catch (err) {
    console.error('[trees-live] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch live trees', details: err.message });
  }
});

// --- Start Server ---
// Only start server if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
