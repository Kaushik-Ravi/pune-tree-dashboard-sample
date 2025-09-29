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
  origin: 'http://localhost:5173'
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
    res.status(500).json({ error: 'Internal server error' });
  }
});


// --- NEW API ENDPOINT FOR 3D TREE DATA ---
app.post('/api/trees-in-bounds', async (req, res) => {
  const { bounds } = req.body;

  if (!bounds || !bounds.sw || !bounds.ne) {
    return res.status(400).json({ error: 'Invalid bounds provided.' });
  }

  const [swLon, swLat] = bounds.sw;
  const [neLon, neLat] = bounds.ne;

  // Added a limit to prevent overwhelming requests for very large areas.
  const MAX_TREES_RETURN = 5000;

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


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app; // ADD THIS LINE
