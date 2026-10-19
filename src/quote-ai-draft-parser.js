import { parseSmartQuoteItems } from './quote-ai-parser.js';

function parseResponse(text) {
  if (typeof text !== 'string') return undefined;
  const cleanText = text.replace(/```(?:json)?/gi, '').trim();
  const candidates = [cleanText];
  const objectStart = cleanText.indexOf('{');
  const objectEnd = cleanText.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) candidates.push(cleanText.slice(objectStart, objectEnd + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue with the next JSON-shaped fragment.
    }
  }
  return undefined;
}

function textValue(...values) {
  const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim();
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['si', 'sí', 'true', 'incluye', 'incluir'].includes(normalized)) return true;
  if (['no', 'false', 'excluir', 'sin'].includes(normalized)) return false;
  return undefined;
}

function percentageValue(value) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).replace('%', '').trim();
  if (!str) return undefined;
  const numeric = typeof value === 'number' ? value : Number(str);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? String(numeric) : undefined;
}

export function parseSmartQuoteDraft(responseText) {
  const parsedResponse = parseResponse(responseText);
  if (!parsedResponse || Array.isArray(parsedResponse)) {
    return { fields: {}, items: parseSmartQuoteItems(responseText) };
  }

  const draft = parsedResponse.cotizacion || parsedResponse.quote || parsedResponse;
  const client = draft.cliente && typeof draft.cliente === 'object' ? draft.cliente : draft.client;
  const fields = {};
  const assignText = (key, ...values) => {
    const value = textValue(...values);
    if (value) fields[key] = value;
  };

  assignText('clientName', draft.clientName, draft.nombreCliente, typeof draft.cliente === 'string' ? draft.cliente : undefined, client?.name, client?.nombre);
  assignText('clientContact', draft.clientContact, draft.contacto, client?.contact, client?.contacto);
  assignText('clientPhone', draft.clientPhone, draft.telefono, draft.phone, client?.phone, client?.telefono);
  assignText('clientEmail', draft.clientEmail, draft.correo, draft.email, client?.email, client?.correo);
  assignText('clientRfc', draft.clientRfc, draft.rfc, client?.rfc);
  assignText('projectLocation', draft.projectLocation, draft.ubicacionProyecto, draft.direccion, draft.location, client?.address, client?.direccion);
  assignText('scope', draft.scope, draft.alcance, draft.alcanceIncluido);
  assignText('executionDays', draft.executionDays, draft.plazoEjecucion, draft.plazo, draft.diasHabiles);
  assignText('warrantyInfo', draft.warrantyInfo, draft.garantia, draft.warranty);
  assignText('paymentMilestones', draft.paymentMilestones, draft.esquemaPagos, draft.pagos, draft.paymentTerms);
  assignText('exclusions', draft.exclusions, draft.exclusiones);

  const inflationClause = booleanValue(draft.inflationClause ?? draft.clausulaInflacion ?? draft.ajusteInflacion);
  const includeIVA = booleanValue(draft.includeIVA ?? draft.incluirIVA ?? draft.iva);
  const advancePercent = percentageValue(draft.advancePercent ?? draft.anticipo);
  const discount = percentageValue(draft.discount ?? draft.descuento);
  if (inflationClause !== undefined) fields.inflationClause = inflationClause;
  if (includeIVA !== undefined) fields.includeIVA = includeIVA;
  if (advancePercent !== undefined) fields.advancePercent = advancePercent;
  if (discount !== undefined) fields.discount = discount;

  return { fields, items: parseSmartQuoteItems(JSON.stringify(draft)) };
}
