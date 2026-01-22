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
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// --- Database Connection ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_CA_CERT ? {
    rejectUnauthorized: false,
    ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'),
  } : false,
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Successfully connected to the database.');
    client.release();
});

// --- Health Check Endpoint ---
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    res.json({ 
      status: 'ok', 
      database: result.rows[0].db,
      time: result.rows[0].time,
      env: {
        hasDbHost: !!process.env.DB_HOST,
        hasDbUser: !!process.env.DB_USER,
        hasDbPassword: !!process.env.DB_PASSWORD,
        hasDbDatabase: !!process.env.DB_DATABASE,
        isVercel: process.env.VERCEL === '1'
      }
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: err.message,
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
  try {
    const query = `
      SELECT
        id, geom, girth_cm, height_m, canopy_dia_m, botanical_name, common_name,
        "CO2_sequestered_kg" AS co2_sequestered_kg,
        economic_i, flowering, ward, wood_density
      FROM public.trees
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);

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
    try {
        const query = `
            SELECT
                COUNT(*) AS total_trees,
                SUM("CO2_sequestered_kg") AS total_co2_annual_kg
            FROM public.trees;
        `;
        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error executing query for /api/city-stats', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/ward-data', async (req, res) => {
    try {
        const query = `
            SELECT
                ward,
                COUNT(*) AS tree_count,
                SUM("CO2_sequestered_kg") AS co2_kg
            FROM public.trees
            WHERE ward IS NOT NULL
            GROUP BY ward
            ORDER BY ward::double precision::int;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error executing query for /api/ward-data', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
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
        const result = await pool.query(query, [polygonGeoJSON]);
        res.json(result.rows[0]);
    } catch (err)        {
        console.error('Error executing query for /api/stats-in-polygon', err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- NEW API ENDPOINT FOR PLANTING ADVISOR ---
app.get('/api/tree-archetypes', async (req, res) => {
  try {
    // We only select Summer data for direct comparison, as it represents the peak cooling need.
    const query = `
      SELECT *
      FROM public.tree_archetypes
      WHERE season = 'Summer'
      ORDER BY common_name, id;
    `;
    const { rows } = await pool.query(query);

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

    const result = await pool.query(query, [swLon, swLat, neLon, neLat, MAX_TREES_RETURN]);
    
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
app.get('/api/filter-metadata', async (req, res) => {
  console.log('[filter-metadata] Request received');
  const startTime = Date.now();
  
  try {
    // Get distinct species names
    const speciesQuery = `
      SELECT DISTINCT common_name 
      FROM public.trees 
      WHERE common_name IS NOT NULL AND common_name != ''
      ORDER BY common_name
      LIMIT 500;
    `;
    
    // Get distinct wards - sort numerically and format as integers
    const wardsQuery = `
      SELECT DISTINCT 
        CASE 
          WHEN ward ~ '^[0-9.]+$' THEN FLOOR(ward::numeric)::text
          ELSE ward
        END as ward
      FROM public.trees 
      WHERE ward IS NOT NULL AND ward != ''
      ORDER BY 
        CASE 
          WHEN ward ~ '^[0-9.]+$' THEN FLOOR(ward::numeric)
          ELSE 999999
        END,
        ward;
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
    
    // Run main queries in parallel
    const [speciesResult, wardsResult, rangesResult, economicResult] = await Promise.all([
      pool.query(speciesQuery),
      pool.query(wardsQuery),
      pool.query(rangesQuery),
      pool.query(economicQuery)
    ]);
    
    const ranges = rangesResult.rows[0] || {};
    
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
      const locationCountsResult = await pool.query(locationCountsQuery);
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
      wards: wardsResult.rows.map(r => r.ward),
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
    
    const result = await pool.query(query, params);
    res.json({
      total_trees: parseInt(result.rows[0]?.total_trees) || 0,
      total_co2_kg: parseFloat(result.rows[0]?.total_co2_kg) || 0
    });
  } catch (err) {
    console.error('Error executing query for /api/filtered-stats', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
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
