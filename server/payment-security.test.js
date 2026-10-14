import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveAccountEntitlements,
  isValidWebhookSignature,
  PRODUCTS,
  toCents,
  validateMercadoPagoTokenEnvironment
} from './payment-security.js';

test('server catalog fixes checkout prices and quantities', () => {
  assert.equal(PRODUCTS.credits_50.amountCents, 14900);
  assert.equal(PRODUCTS.lifetime_pro.amountCents, 69900);
  assert.equal(PRODUCTS.credits_50.credits, 50);
});

test('validates Mercado Pago webhook signatures and rejects tampering or stale events', () => {
  const secret = 'test-webhook-secret';
  const now = 1_800_000_000_000;
  const dataId = 'AB123';
  const requestId = 'request-123';
  const timestamp = String(Math.floor(now / 1000));
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  const signature = `ts=${timestamp},v1=${hash}`;

  assert.equal(isValidWebhookSignature({ signature, requestId, dataId, secret, now }), true);
  assert.equal(isValidWebhookSignature({ signature, requestId, dataId: 'AB124', secret, now }), false);
  assert.equal(isValidWebhookSignature({ signature, requestId, dataId, secret, now: now + 6 * 60 * 1000 }), false);
});

test('converts Mercado Pago decimal amounts to integer cents', () => {
  assert.equal(toCents(149), 14900);
  assert.equal(toCents('699.00'), 69900);
  assert.ok(Number.isNaN(toCents('invalid')));
});

test('requires Mercado Pago tokens to match the runtime environment', () => {
  assert.doesNotThrow(() => validateMercadoPagoTokenEnvironment('TEST-example', false));
  assert.doesNotThrow(() => validateMercadoPagoTokenEnvironment('APP_USR-example', false));
  assert.doesNotThrow(() => validateMercadoPagoTokenEnvironment('APP_USR-example', true));
  assert.throws(() => validateMercadoPagoTokenEnvironment('TEST-example', true), /producción/);
  assert.throws(() => validateMercadoPagoTokenEnvironment('unknown-example', false), /desarrollo/);
});

test('derives account entitlements from approved fulfilled purchases after refunds', () => {
  const purchases = [
    { product_id: 'credits_50', status: 'approved', fulfilled: true },
    { product_id: 'credits_50', status: 'refunded', fulfilled: false },
    { product_id: 'lifetime_pro', status: 'refunded', fulfilled: false }
  ];

  assert.deepEqual(deriveAccountEntitlements(purchases, 12), {
    hasLifetime: false,
    credits: 38
  });
  assert.deepEqual(deriveAccountEntitlements(purchases, 80), {
    hasLifetime: false,
    credits: 0
  });
});
