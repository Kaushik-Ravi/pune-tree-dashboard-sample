import { Handler, HandlerEvent } from "@netlify/functions";
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true, ca: process.env.DO_CA_CERT }
});

const handler: Handler = async (event: HandlerEvent) => {
  const treeId = event.queryStringParameters?.id;
  if (!treeId) {
    return { statusCode: 400, body: JSON.stringify({ error: "Tree ID is required." }) };
  }

  try {
    const { rows } = await pool.query('SELECT * FROM trees WHERE "Tree_ID" = $1', [treeId]);
    if (rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "Not Found" }) };
    }
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(rows[0]) 
    };
  } catch (e) {
    const error = e as Error;
    console.error("DB Error in get-tree:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: "DB Error", details: error.message }) };
  }
};

export { handler };