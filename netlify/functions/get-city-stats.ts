// netlify/functions/get-city-stats.ts
import { Handler } from "@netlify/functions";
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const handler: Handler = async () => {
  try {
    // Query for city-wide statistics
    const cityWideResult = await pool.query(
      'SELECT COUNT(*) AS total_trees, COALESCE(SUM("CO2_Sequestration_kg_yr"), 0) AS total_co2_annual_kg FROM trees'
    );

    // Query for ward-by-ward statistics
    const byWardResult = await pool.query(
      `SELECT
         ward,
         COUNT(*) AS tree_count,
         COALESCE(SUM("CO2_Sequestration_kg_yr"), 0) AS co2_kg
       FROM trees
       WHERE ward IS NOT NULL AND ward ~ E'^\\d+(\\.\\d+)?$' -- Ensures ward is a number (int or float)
       GROUP BY ward
       ORDER BY CAST(ward AS double precision)` // CORRECTED: Cast to float for safe sorting
    );

    const finalStats = {
      city_wide: {
        // Ensure total_trees is a number, as COUNT returns bigint
        total_trees: Number(cityWideResult.rows[0].total_trees),
        total_co2_annual_kg: cityWideResult.rows[0].total_co2_annual_kg
      },
      by_ward: byWardResult.rows
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(finalStats),
    };
  } catch (error) {
    console.error('Database Query Error for Stats:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error fetching stats", details: (error as Error).message }),
    };
  }
};

export { handler };