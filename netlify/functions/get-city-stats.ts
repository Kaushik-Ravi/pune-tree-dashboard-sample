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
    const cityWideResult = await pool.query(
      'SELECT COUNT(*) AS total_trees, COALESCE(SUM("CO2_Sequestration_kg_yr"), 0) AS total_co2_annual_kg FROM trees'
    );

    // MODIFIED QUERY: Removed the failing CAST and relaxed the WHERE clause.
    // The frontend can handle parsing the ward numbers if needed. This query prioritizes reliability.
    const byWardResult = await pool.query(
      `SELECT
         ward,
         COUNT(*) AS tree_count,
         COALESCE(SUM("CO2_Sequestration_kg_yr"), 0) AS co2_kg
       FROM trees
       WHERE ward IS NOT NULL AND ward != ''
       GROUP BY ward
       ORDER BY ward ASC` // Sorting alphabetically is safe.
    );

    const finalStats = {
      city_wide: {
        total_trees: Number(cityWideResult.rows[0].total_trees),
        total_co2_annual_kg: parseFloat(cityWideResult.rows[0].total_co2_annual_kg)
      },
      by_ward: byWardResult.rows.map(row => ({
        ward: row.ward,
        tree_count: Number(row.tree_count),
        co2_kg: parseFloat(row.co2_kg)
      }))
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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