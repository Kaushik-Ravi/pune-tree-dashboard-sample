import { Handler, HandlerEvent } from "@netlify/functions";
import pkg from 'pg';

const { Pool } = pkg;

// Create a connection pool. The pool will use the DATABASE_URL
// environment variable we set in the Netlify UI.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Required for DigitalOcean Managed Databases
    rejectUnauthorized: false 
  }
});

const handler: Handler = async (event: HandlerEvent) => {
  // Get the tree ID from the URL query parameter (e.g., /?id=12345)
  const treeId = event.queryStringParameters?.id;

  if (!treeId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "A 'id' query parameter is required." }),
    };
  }

  try {
    // Use a parameterized query to prevent SQL injection
    const { rows } = await pool.query(
      'SELECT * FROM trees WHERE "Tree_ID" = $1', 
      [treeId]
    );

    if (rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Tree with ID ${treeId} not found.` }),
      };
    }

    // Return the found tree data as a JSON response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Allow all origins for simplicity
      },
      body: JSON.stringify(rows[0]),
    };
  } catch (error) {
    console.error('Database Query Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

export { handler };