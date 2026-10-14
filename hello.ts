import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000
});

export default async function cotiqHealth(): Promise<Response> {
  try {
    await pool.query("SELECT 1");
    return Response.json({ status: "ok", database: "connected" });
  } catch {
    console.error("Cotiq health check could not connect to Postgres.");
    return Response.json(
      { status: "error", database: "unavailable" },
      { status: 503 }
    );
  }
}
