import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSmartQuoteDraft } from './quote-ai-draft-parser.js';

test('extracts client, terms, tax settings, and items from a full quote response', () => {
  const result = parseSmartQuoteDraft(JSON.stringify({
    cliente: {
      nombre: 'Juan Pérez / Obras & Mantenimiento',
      contacto: 'Arq. Carlos Mendoza',
      telefono: '4421234567',
      correo: 'contacto@cliente.com',
      direccion: 'Av. Hidalgo 456, Col. Centro, Querétaro, Qro.'
    },
    plazoEjecucion: '8 días hábiles a partir del anticipo',
    garantia: '6 meses de garantía sobre mano de obra.',
    esquemaPagos: '50% anticipo, 50% contra entrega.',
    clausulaInflacion: 'sí',
    incluirIVA: 'no',
    anticipo: 50,
    alcance: 'Suministro e instalación.',
    exclusiones: 'No incluye obra civil.',
    items: [{ cantidad: 2, unidad: 'Servicio', concepto: 'Instalación de minisplit', precio: 3200 }]
  }));

  assert.deepEqual(result.fields, {
    clientName: 'Juan Pérez / Obras & Mantenimiento',
    clientContact: 'Arq. Carlos Mendoza',
    clientPhone: '4421234567',
    clientEmail: 'contacto@cliente.com',
    projectLocation: 'Av. Hidalgo 456, Col. Centro, Querétaro, Qro.',
    scope: 'Suministro e instalación.',
    executionDays: '8 días hábiles a partir del anticipo',
    warrantyInfo: '6 meses de garantía sobre mano de obra.',
    paymentMilestones: '50% anticipo, 50% contra entrega.',
    exclusions: 'No incluye obra civil.',
    inflationClause: true,
    includeIVA: false,
    advancePercent: '50'
  });
  assert.deepEqual(result.items, [{ quantity: 2, unit: 'Servicio', description: 'Instalación de minisplit', unitPrice: 3200 }]);
});
