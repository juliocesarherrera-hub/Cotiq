import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogItemsToQuoteLines, extractCatalogItems, suggestCatalogCategory } from './catalog-import.js';

test('suggests a category from Spanish service and material names', () => {
  assert.equal(suggestCatalogCategory('Kit de afinación para VW Jetta'), 'Automotriz');
  assert.equal(suggestCatalogCategory('Gastos de gestoría de verificación'), 'Automotriz');
  assert.equal(suggestCatalogCategory('Pintura vinílica para muro'), 'Acabados');
  assert.equal(suggestCatalogCategory('Instalación de Minisplit 1.5 Ton'), 'Climatización');
  assert.equal(suggestCatalogCategory('Servicio profesional'), 'Servicios');
  assert.equal(suggestCatalogCategory('Artículo sin categoría'), 'Otros');
});

test('extracts catalog items, units, prices, and categories from a price list', () => {
  const items = extractCatalogItems([
    '1 Pintura vinílica 20 L $1,250.00',
    'Instalación de Minisplit 1.5 Ton     3,200.00',
    '2 Suministro de cable eléctrico 120.50',
    'Subtotal $4,570.50'
  ].join('\n'));

  assert.deepEqual(items, [
    { concept: 'Pintura vinílica 20 L', unit: 'L', price: 1250, category: 'Acabados' },
    { concept: 'Instalación de Minisplit 1.5 Ton', unit: 'Servicio', price: 3200, category: 'Climatización' },
    { concept: 'Suministro de cable eléctrico', unit: 'Servicio', price: 120.5, category: 'Electricidad' }
  ]);
});

test('extracts unmarked whole-peso and Mexican-formatted prices without mistaking a quantity for a price', () => {
  const items = extractCatalogItems([
    'Instalación de lavabo 1500',
    'Retiro de escombro 1.250,00',
    'Limpieza profunda 3 200 MXN',
    'Retiro de equipo 10'
  ].join('\n'));

  assert.deepEqual(items, [
    { concept: 'Instalación de lavabo', unit: 'Servicio', price: 1500, category: 'Plomería' },
    { concept: 'Retiro de escombro', unit: 'Servicio', price: 1250, category: 'Plomería' },
    { concept: 'Limpieza profunda', unit: 'Servicio', price: 3200, category: 'Limpieza' }
  ]);
});

test('deduplicates repeated lines and keeps unpriced recognizable catalog items for review', () => {
  const items = extractCatalogItems([
    'Pintura vinílica $150',
    'Pintura vinílica $150',
    'Tubería de cobre 1/2 m²'
  ].join('\n'));

  assert.equal(items.length, 2);
  assert.equal(items[0].price, 150);
  assert.deepEqual(items[1], {
    concept: 'Tubería de cobre 1/2 m²',
    unit: 'm²',
    price: null,
    category: 'Plomería'
  });
});

test('maps recognized concepts and prices to editable quote lines', () => {
  assert.deepEqual(catalogItemsToQuoteLines([
    { concept: 'Pintura vinílica', unit: 'm²', price: 1250 },
    { concept: 'Mano de obra', unit: 'Servicio', price: null }
  ]), [
    { quantity: 1, unit: 'm²', description: 'Pintura vinílica', unitPrice: '1250' },
    { quantity: 1, unit: 'Servicio', description: 'Mano de obra', unitPrice: '' }
  ]);
});

test('imports rows from a low-quality OCR transcription of a quotation table', () => {
  const items = extractCatalogItems([
    'Gracias por confiar en nosotros para el cuidado de sus automóviles.',
    '[Cantidad                                  Descripción                                            Precio',
    '— 10 RIGE alinación para YN Jefa 20 S9500.00 |',
    'o de obra en 10 vehiculos S5000.00',
    'Costo verificación TO vehiculos 3980.00 |',
    'Gastos de gestoria de verificación | — SIBU0.00 |',
    'SUBTOTAL | — S19 980.00 |',
    'IVA N/A',
    'TOTAL | — S19.980 |',
    'Estos precios estarán vigentes hasta el 28 de junio.',
    'Taller mecánico especializado Carretero',
    'ingeGcarretero-taller.com.mx'
  ].join('\n'));

  assert.deepEqual(items, [
    { concept: 'RIGE alinación para YN Jefa 20', unit: 'Servicio', price: 9500, category: 'Automotriz' },
    { concept: 'o de obra en 10 vehiculos', unit: 'Servicio', price: 5000, category: 'Automotriz' },
    { concept: 'Costo verificación 10 vehiculos', unit: 'Servicio', price: 3980, category: 'Automotriz' },
    { concept: 'Gastos de gestoria de verificación', unit: 'Servicio', price: null, category: 'Automotriz' }
  ]);
});
