// netlify/functions/get-tree.ts
import { Handler, HandlerEvent } from "@netlify/functions";
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true, // Enforce security
    ca: process.env.DO_CA_CERT, // Provide the CA certificate
  }
});

const handler: Handler = async (event: HandlerEvent) => {
  const treeId = event.queryStringParameters?.id;
  if (!treeId) { return { statusCode: 400, body: JSON.stringify({ error: "A 'id' query parameter is required." }) }; }
  try {
    const { rows } = await pool.query('SELECT * FROM trees WHERE "Tree_ID" = $1', [treeId]);
    if (rows.length === 0) { return { statusCode: 404, body: JSON.stringify({ error: `Tree with ID ${treeId} not found.` }) }; }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(rows[0]), };
  } catch (error) {
    console.error('Database Query Error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error", details: (error as Error).message }), };
  }
};

export { handler };