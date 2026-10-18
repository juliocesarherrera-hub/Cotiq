import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogItemsToQuoteLines, extractCatalogItems, suggestCatalogCategory } from './catalog-import.js';
import { formatPositionedRows } from './catalog-layout.js';

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
    { concept: 'Pintura vinílica', unit: 'L', price: 1250, quantity: 1, category: 'Acabados' },
    { concept: 'Instalación de Minisplit 1.5 Ton', unit: 'Servicio', price: 3200, quantity: 1, category: 'Climatización' },
    { concept: 'Suministro de cable eléctrico', unit: 'Servicio', price: 120.5, quantity: 2, category: 'Electricidad' }
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
    { concept: 'Instalación de lavabo', unit: 'Pieza', price: 1500, quantity: 1, category: 'Plomería' },
    { concept: 'Retiro de escombro', unit: 'Servicio', price: 1250, quantity: 1, category: 'Plomería' },
    { concept: 'Limpieza profunda', unit: 'Servicio', price: 3200, quantity: 1, category: 'Limpieza' }
  ]);
});

test('uses table columns to keep quantities, units, prices, and phone details out of the concept', () => {
  const items = extractCatalogItems([
    'Cantidad\tConcepto\tUnidad\tPrecio',
    '2\tPintura vinílica Tel. 442 123 4567\tm2\t1.250,00',
    '1\tInstalación de minisplit\tServicio\t3,200.50',
    '442 123 4567'
  ].join('\n'));

  assert.deepEqual(items, [
    { concept: 'Pintura vinílica', unit: 'm²', price: 1250, quantity: 2, category: 'Acabados' },
    { concept: 'Instalación de minisplit', unit: 'Servicio', price: 3200.5, quantity: 1, category: 'Climatización' }
  ]);
});

test('maps the two sample quote table layouts to quantity and unit price', () => {
  const firstSample = extractCatalogItems([
    'Cantidad\tDescripción\tPrecio',
    '10\tKit de afinación para VW Jetta 2.0\t$9,500.00',
    '\tMano de obra en 10 vehículos\t$5,000.00',
    '\tCosto de verificación 10 vehículos\t$3,980.00'
  ].join('\n'));
  assert.deepEqual(firstSample.map(({ concept, quantity, price }) => ({ concept, quantity, price })), [
    { concept: 'Kit de afinación para VW Jetta 2.0', quantity: 10, price: 950 },
    { concept: 'Mano de obra en 10 vehículos', quantity: 1, price: 5000 },
    { concept: 'Costo de verificación 10 vehículos', quantity: 1, price: 3980 }
  ]);

  const secondSample = extractCatalogItems([
    'Cantidad\tDescripción\tValor unitario\tPrecio',
    '20\tShorts\t$35.000\t$700.000',
    '30\tJean de colores\t$45.000\t$1.350.000',
    '10\tCacheteros de dama\t$50.000\t$500.000',
    '25\tFaldas\t$55.000\t$1.375.000',
    '5\tVestidos\t$40.000\t$200.000'
  ].join('\n'));
  assert.deepEqual(secondSample.map(({ concept, quantity, price }) => ({ concept, quantity, price })), [
    { concept: 'Shorts', quantity: 20, price: 35000 },
    { concept: 'Jean de colores', quantity: 30, price: 45000 },
    { concept: 'Cacheteros de dama', quantity: 10, price: 50000 },
    { concept: 'Faldas', quantity: 25, price: 55000 },
    { concept: 'Vestidos', quantity: 5, price: 40000 }
  ]);
  assert.deepEqual(secondSample.map(({ unit }) => unit), ['Pieza', 'Pieza', 'Pieza', 'Pieza', 'Pieza']);
  assert.deepEqual(catalogItemsToQuoteLines(secondSample).map(({ quantity, unit, unitPrice }) => ({
    quantity,
    unit,
    unitPrice
  })), [
    { quantity: 20, unit: 'Pieza', unitPrice: '35000' },
    { quantity: 30, unit: 'Pieza', unitPrice: '45000' },
    { quantity: 10, unit: 'Pieza', unitPrice: '50000' },
    { quantity: 25, unit: 'Pieza', unitPrice: '55000' },
    { quantity: 5, unit: 'Pieza', unitPrice: '40000' }
  ]);
});

test('uses header column positions to rebuild rows from OCR word coordinates', () => {
  const rows = [
    { y: 100, words: [
      { text: 'Cantidad', left: 10, right: 55 },
      { text: 'Descripción', left: 100, right: 175 },
      { text: 'Valor', left: 220, right: 250 },
      { text: 'unitario', left: 252, right: 285 },
      { text: 'Precio', left: 320, right: 360 }
    ] },
    { y: 80, words: [
      { text: '20', left: 15, right: 30 },
      { text: 'Shorts', left: 105, right: 145 },
      { text: '$35.000', left: 222, right: 270 },
      { text: '$700.000', left: 322, right: 370 }
    ] }
  ];

  const text = formatPositionedRows(rows);
  assert.deepEqual(extractCatalogItems(text).map(({ concept, quantity, price }) => ({ concept, quantity, price })), [
    { concept: 'Shorts', quantity: 20, price: 35000 }
  ]);
});

test('infers common area and volume units when the document omits a unit column', () => {
  const items = extractCatalogItems([
    'Pintura vinílica para muros $180',
    'Suministro de concreto 2,450'
  ].join('\n'));

  assert.deepEqual(items.map(({ concept, unit, price }) => ({ concept, unit, price })), [
    { concept: 'Pintura vinílica para muros', unit: 'm²', price: 180 },
    { concept: 'Suministro de concreto', unit: 'm³', price: 2450 }
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
    concept: 'Tubería de cobre 1/2',
    unit: 'm²',
    price: null,
    quantity: 1,
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
    { concept: 'RIGE alinación para YN Jefa 20', unit: 'Servicio', price: 9500, quantity: 1, category: 'Automotriz' },
    { concept: 'o de obra en 10 vehiculos', unit: 'Servicio', price: 5000, quantity: 1, category: 'Automotriz' },
    { concept: 'Costo verificación 10 vehiculos', unit: 'Servicio', price: 3980, quantity: 1, category: 'Automotriz' },
    { concept: 'Gastos de gestoria de verificación', unit: 'Servicio', price: null, quantity: 1, category: 'Automotriz' }
  ]);
});
