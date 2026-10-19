import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSmartQuoteItems } from './quote-ai-parser.js';

test('accepts direct arrays and Spanish fields from the quote AI', () => {
  const items = parseSmartQuoteItems('[{"cantidad": 2, "unidad": "Pieza", "descripcion": "Minisplit", "precio": 3200}]');
  assert.deepEqual(items, [{ quantity: 2, unit: 'Pieza', description: 'Minisplit', unitPrice: 3200 }]);
});

test('extracts items wrapped in prose, markdown, or an items object', () => {
  const items = parseSmartQuoteItems('Aquí está el resultado:\n```json\n{"items":[{"quantity":1,"unit":"m²","description":"Tablaroca","unitPrice":420}]}\n```');
  assert.deepEqual(items, [{ quantity: 1, unit: 'm²', description: 'Tablaroca', unitPrice: 420 }]);
});

test('normalizes Mexican-formatted prices returned as text', () => {
  const items = parseSmartQuoteItems('[{"description":"Pintura","unitPrice":"$1.350,50"}]');
  assert.equal(items[0].unitPrice, 1350.5);
});
