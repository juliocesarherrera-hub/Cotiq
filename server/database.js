import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
  const schemaPath = resolve(process.cwd(), 'db/schema.sql');
  await pool.query(await readFile(schemaPath, 'utf8'));
}

export async function inTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
