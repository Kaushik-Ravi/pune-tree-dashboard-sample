// netlify/functions/get-tree.ts (DIAGNOSTIC VERSION)
import { Handler, HandlerEvent } from "@netlify/functions";
import pkg from 'pg';
//check
const { Pool } = pkg;
let pool: any; // Define pool in a broader scope

const handler: Handler = async (event: HandlerEvent) => {
  console.log("--- get-tree function invoked ---");

  // --- LOG 1: Check if environment variables exist ---
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL environment variable not found.");
    return { statusCode: 500, body: JSON.stringify({ error: "Server config error: Missing DATABASE_URL" }) };
  }
  if (!process.env.DO_CA_CERT) {
    console.error("FATAL: DO_CA_CERT environment variable not found.");
    return { statusCode: 500, body: JSON.stringify({ error: "Server config error: Missing DO_CA_CERT" }) };
  }
  console.log("SUCCESS: DATABASE_URL and DO_CA_CERT environment variables are present.");

  try {
    // --- LOG 2: Attempt to create the connection pool ---
    console.log("Attempting to create new Pool...");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,
        ca: process.env.DO_CA_CERT,
      }
    });
    console.log("SUCCESS: Pool created.");

    const treeId = event.queryStringParameters?.id;
    if (!treeId) {
      console.log("FAILURE: Request missing treeId parameter.");
      return { statusCode: 400, body: JSON.stringify({ error: "A 'id' query parameter is required." }) };
    }
    console.log(`Attempting to query for Tree_ID: ${treeId}`);

    // --- LOG 3: Attempt to execute the query ---
    const { rows } = await pool.query('SELECT * FROM trees WHERE "Tree_ID" = $1', [treeId]);
    console.log(`SUCCESS: Query executed. Found ${rows.length} rows.`);

    if (rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: `Tree with ID ${treeId} not found.` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(rows[0]),
    };

  } catch (error) {
    // --- LOG 4: Catch ANY error and provide detailed output ---
    const e = error as Error;
    console.error("--- CATCH BLOCK EXECUTED ---");
    console.error("ERROR NAME:", e.name);
    console.error("ERROR MESSAGE:", e.message);
    console.error("ERROR STACK:", e.stack);
    console.error("--------------------------");

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: { name: e.name, message: e.message }
      }),
    };
  }
};

export { handler };