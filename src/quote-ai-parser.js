function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
    : cleaned.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getJsonCandidates(text) {
  const cleanText = text.replace(/```(?:json)?/gi, '').trim();
  const candidates = [cleanText];
  const arrayStart = cleanText.indexOf('[');
  const arrayEnd = cleanText.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) candidates.push(cleanText.slice(arrayStart, arrayEnd + 1));
  const objectStart = cleanText.indexOf('{');
  const objectEnd = cleanText.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) candidates.push(cleanText.slice(objectStart, objectEnd + 1));
  return [...new Set(candidates)];
}

export function parseSmartQuoteItems(responseText) {
  if (typeof responseText !== 'string') return [];

  let parsedResponse;
  for (const candidate of getJsonCandidates(responseText)) {
    try {
      parsedResponse = JSON.parse(candidate);
      break;
    } catch {
      // Try the next JSON-shaped fragment returned by the model.
    }
  }

  const items = Array.isArray(parsedResponse)
    ? parsedResponse
    : parsedResponse?.items || parsedResponse?.partidas || parsedResponse?.conceptos || [];
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const description = String(item.description ?? item.descripcion ?? item.concept ?? item.concepto ?? '').trim();
    const unit = String(item.unit ?? item.unidad ?? 'Servicio').trim() || 'Servicio';
    const quantity = parseNumber(item.quantity ?? item.cantidad) || 1;
    const unitPrice = parseNumber(item.unitPrice ?? item.precioUnitario ?? item.precio ?? item.price);
    if (!description) return [];
    return [{ quantity, unit, description, unitPrice: unitPrice ?? '' }];
  });
}
