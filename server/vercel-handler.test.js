import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { LEGAL_TERMS_VERSION } from '../legal-config.js';

process.env.NODE_ENV = 'development';
process.env.APP_ORIGIN = 'http://localhost:4173';
process.env.SESSION_SECRET = 'local-test-session-secret-with-32-bytes';
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-vercel-adapter-check';
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'local-webhook-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/cotiq';

const { pool } = await import('./database.js');
pool.query = async () => ({ rows: [] });
pool.connect = async () => ({
  query: async () => ({ rows: [] }),
  release() {}
});
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

  const registerResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:4173'
    },
    body: JSON.stringify({
      email: 'persona@ejemplo.com',
      password: 'correct-horse-battery-staple',
      acceptedTermsVersion: LEGAL_TERMS_VERSION,
      confirmedAdult: true
    })
  });

  // The database mock returns no inserted row, so reaching 409 proves the email passed format validation.
  assert.equal(registerResponse.status, 409);

  const generateResponse = await fetch(`http://127.0.0.1:${port}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:4173'
    },
    body: JSON.stringify({ modelId: 'gemini-1.5-flash', prompt: 'Partidas de prueba' })
  });

  assert.equal(generateResponse.status, 401);

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

  const loopbackAliasResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:4173'
    },
    body: JSON.stringify({ email: 'missing@example.com', password: 'invalid-password' })
  });

  assert.equal(loopbackAliasResponse.status, 401);
  assert.deepEqual(await loopbackAliasResponse.json(), { error: 'Correo o contraseña incorrectos.' });

  const unexpectedPortResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://127.0.0.1:4174'
    },
    body: JSON.stringify({ email: 'missing@example.com', password: 'invalid-password' })
  });

  assert.equal(unexpectedPortResponse.status, 403);
  assert.deepEqual(await unexpectedPortResponse.json(), { error: 'Origen de solicitud no permitido.' });
});
