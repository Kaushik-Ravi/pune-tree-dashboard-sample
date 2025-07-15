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
       WHERE ward IS NOT NULL AND ward != ''
       GROUP BY ward
       ORDER BY CAST(ward AS INTEGER)`
    );

    const finalStats = {
      city_wide: cityWideResult.rows[0],
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
      body: JSON.stringify({ error: "Internal Server Error fetching stats" }),
    };
  }
};

export { handler };