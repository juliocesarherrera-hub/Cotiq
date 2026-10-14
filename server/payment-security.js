import { createHmac, timingSafeEqual } from 'node:crypto';

export const PRODUCTS = Object.freeze({
  credits_50: Object.freeze({
    title: 'Paquete de 50 Créditos Cotiq',
    amountCents: 14900,
    credits: 50,
    lifetime: false
  }),
  lifetime_pro: Object.freeze({
    title: 'Licencia Vitalicia PRO Cotiq',
    amountCents: 69900,
    credits: 0,
    lifetime: true
  })
});

export function isValidWebhookSignature({ signature, requestId, dataId, secret, now = Date.now() }) {
  if (!signature || !requestId || !dataId || !secret) return false;

  const fields = Object.fromEntries(
    signature.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator === -1 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    })
  );
  const timestamp = Number(fields.ts);
  const receivedHash = fields.v1;

  if (!Number.isFinite(timestamp) || !receivedHash || Math.abs(now - timestamp * 1000) > 5 * 60 * 1000) return false;

  const normalizedId = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${normalizedId};request-id:${requestId};ts:${fields.ts};`;
  const expectedHash = createHmac('sha256', secret).update(manifest).digest('hex');
  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function toCents(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

export function validateMercadoPagoTokenEnvironment(accessToken, isProduction) {
  if (isProduction && !accessToken.startsWith('APP_USR-')) {
    throw new Error('En producción configura el Access Token de producción de Mercado Pago (APP_USR-).');
  }
  if (!isProduction && !accessToken.startsWith('TEST-') && !accessToken.startsWith('APP_USR-')) {
    throw new Error('En desarrollo configura credenciales de prueba de Mercado Pago (TEST- o APP_USR- para Checkout Pro).');
  }
}

export function deriveAccountEntitlements(purchases, consumedCredits) {
  const activePurchases = purchases.filter((purchase) => purchase.status === 'approved' && purchase.fulfilled);
  const grantedCredits = activePurchases.reduce(
    (total, purchase) => total + (PRODUCTS[purchase.product_id]?.credits || 0),
    0
  );
  const consumed = Number.isFinite(Number(consumedCredits)) ? Math.max(0, Number(consumedCredits)) : 0;
  const credits = Math.max(0, grantedCredits - consumed);
  const hasLifetime = activePurchases.some((purchase) => PRODUCTS[purchase.product_id]?.lifetime);

  return {
    hasLifetime,
    credits
  };
}
