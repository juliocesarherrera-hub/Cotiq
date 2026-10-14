import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.NODE_ENV = 'development';
process.env.APP_ORIGIN = 'http://localhost:4173';
process.env.SESSION_SECRET = 'local-test-session-secret-with-32-bytes';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-vercel-adapter-check';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'local-webhook-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/cotiq';

const { pool } = await import('./database.js');
pool.query = async () => ({ rows: [] });
const { default: handler } = await import('../api/[...path].js');

test('Vercel API handler initializes and dispatches Express routes', async (t) => {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });

  const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:4173'
    },
    body: JSON.stringify({ email: 'missing@example.com', password: 'invalid-password' })
  });

  assert.equal(loginResponse.status, 401);
  assert.deepEqual(await loginResponse.json(), { error: 'Correo o contraseña incorrectos.' });
});
