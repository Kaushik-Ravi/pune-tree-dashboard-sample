import { Handler } from "@netlify/functions";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const handler: Handler = async () => {
  try {
    // CORRECTED: Use lowercase unquoted column names.
    const cityResult = await pool.query('SELECT COUNT(*) as total_trees, SUM(co2_sequestration_kg_yr) as total_co2 FROM trees');
    const wardResult = await pool.query('SELECT ward, COUNT(*) as tree_count, SUM(co2_sequestration_kg_yr) as co2_kg FROM trees WHERE ward IS NOT NULL AND ward != \'\' GROUP BY ward ORDER BY ward ASC');
    
    const stats = {
      city_wide: {
        total_trees: Number(cityResult.rows[0].total_trees),
        total_co2_annual_kg: Number(cityResult.rows[0].total_co2)
      },
      by_ward: wardResult.rows.map(r => ({
        ...r,
        tree_count: Number(r.tree_count),
        co2_kg: Number(r.co2_kg)
      }))
    };

    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(stats) 
    };
  } catch (e) {
    const error = e as Error;
    console.error("DB Error in get-city-stats:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: "DB Stats Error", details: error.message }) };
  }
};
export { handler };