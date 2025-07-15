import { Handler } from "@netlify/functions";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// This query asks the database's internal information schema for all column names
// in the 'public' schema for the table named 'trees'.
const schemaQuery = `
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'trees';
`;

const handler: Handler = async () => {
  try {
    const { rows } = await pool.query(schemaQuery);
    const columnNames = rows.map(r => r.column_name);
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ columns: columnNames })
    };
  } catch (e) {
    const error = e as Error;
    console.error("DB Error in get-schema:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: "DB Schema Fetch Error", details: error.message }) };
  }
};

export { handler };