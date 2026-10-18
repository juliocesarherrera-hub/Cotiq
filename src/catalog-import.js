export const CATALOG_CATEGORIES = [
  'Automotriz',
  'Acabados',
  'Carpintería',
  'Climatización',
  'Construcción',
  'Electricidad',
  'Herrería',
  'Limpieza',
  'Mantenimiento',
  'Plomería',
  'Servicios',
  'Otros'
];

const CATEGORY_RULES = [
  {
    category: 'Automotriz',
    terms: ['automotriz', 'afinacion', 'alinacion', 'mecanico', 'verificacion', 'gestoria', 'taller']
  },
  {
    category: 'Climatización',
    terms: ['minisplit', 'aire acondicionado', 'refrigeracion', 'refrigerante', 'ducto de aire']
  },
  {
    category: 'Electricidad',
    terms: ['electrico', 'cable', 'contacto', 'tomacorriente', 'interruptor', 'tablero', 'luminaria']
  },
  {
    category: 'Plomería',
    terms: ['plomeria', 'tuberia', 'lavabo', 'sanitario', 'calentador', 'drenaje', 'mezcladora']
  },
  {
    category: 'Acabados',
    terms: ['pintura', 'azulejo', 'yeso', 'impermeabilizante', 'sellador', 'recubrimiento', 'piso']
  },
  {
    category: 'Construcción',
    terms: ['construccion', 'cemento', 'block', 'ladrillo', 'concreto', 'cimentacion', 'demolicion', 'muro']
  },
  {
    category: 'Carpintería',
    terms: ['carpinteria', 'madera', 'puerta', 'closet', 'mueble']
  },
  {
    category: 'Herrería',
    terms: ['herreria', 'soldadura', 'reja', 'porton', 'estructura metalica']
  },
  {
    category: 'Limpieza',
    terms: ['limpieza', 'lavado', 'desinfeccion', 'sanitizacion']
  },
  {
    category: 'Mantenimiento',
    terms: ['mantenimiento', 'reparacion', 'revision', 'diagnostico']
  },
  {
    category: 'Servicios',
    terms: ['instalacion', 'mano de obra', 'servicio']
  }
];

const ITEM_DESCRIPTION_TERMS = CATEGORY_RULES
  .flatMap(({ terms }) => terms)
  .filter((term) => !['automotriz', 'mecanico', 'taller', 'servicio'].includes(term));

function normalizeText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function suggestCatalogCategory(description) {
  const normalized = normalizeText(description);
  return CATEGORY_RULES.find(({ terms }) => terms.some((term) => normalized.includes(term)))?.category || 'Otros';
}

export function catalogItemsToQuoteLines(items) {
  return items.map(({ concept, unit, price }) => ({
    quantity: 1,
    unit: unit || 'Servicio',
    description: concept,
    unitPrice: price === null ? '' : String(price)
  }));
}

function extractTrailingPrice(line) {
  const normalizedLine = line.replace(/[\s|)\]}—–−-]+$/g, '');
  const match = normalizedLine.match(/(?:\$\s*|S\s*)?(\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:[Mm][Xx][Nn]|[Mm]\.[Nn]\.))?$/);
  if (!match) return null;

  const prefix = normalizedLine.slice(0, match.index);
  const hasCurrencyMarker = /^\$|^S/.test(match[0]);
  const amount = match[1];
  const hasDecimal = /[.,]\d{1,2}$/.test(amount);
  const hasColumnSpacing = /\s{2,}$/.test(prefix);
  const hasGroupedAmount = /^\d{1,3}[ ,.]\d{3}/.test(amount);
  const hasLongIntegerAmount = /^\d{3,}$/.test(amount);
  const lastPrefixCharacter = prefix.at(-1);
  const hasSeparatedAmount = !lastPrefixCharacter
    || /\s/.test(lastPrefixCharacter)
    || '|)]}'.includes(lastPrefixCharacter);
  if (!hasCurrencyMarker && !hasDecimal && !hasGroupedAmount && !hasLongIntegerAmount && !hasColumnSpacing) return null;
  if (!hasCurrencyMarker && !hasSeparatedAmount) return null;

  const separators = amount.match(/[.,]/g) || [];
  const lastSeparator = Math.max(amount.lastIndexOf('.'), amount.lastIndexOf(','));
  const decimalDigits = lastSeparator < 0 ? 0 : amount.length - lastSeparator - 1;
  const hasDecimalSeparator = decimalDigits > 0 && decimalDigits <= 2;
  let normalizedAmount = amount.replace(/ /g, '');
  if (separators.length > 0) {
    const decimalSeparator = hasDecimalSeparator ? amount[lastSeparator] : '';
    normalizedAmount = normalizedAmount.replace(/[.,]/g, '');
    if (decimalSeparator) {
      const decimalIndex = amount.lastIndexOf(decimalSeparator);
      const integerPart = amount.slice(0, decimalIndex).replace(/[., ]/g, '');
      const decimalPart = amount.slice(decimalIndex + 1);
      normalizedAmount = `${integerPart}.${decimalPart}`;
    }
  }
  const price = Number(normalizedAmount);
  if (!Number.isFinite(price)) return null;

  return {
    price,
    description: prefix
  };
}

function removeUnrecognizedTrailingPrice(line) {
  return line.replace(/[$S][A-Z]{0,4}\s*\d[\d,]*(?:\.\d{1,2})?\s*(?:MXN)?[\s|)\]}—–−-]*$/, '').trim();
}

function hasPriceLikeSuffix(line) {
  return /(?:[$S][A-Z]{0,4}\s*)?(?:\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d{1,2})?|\d{3,}(?:[.,]\d{1,2})?|\d+[.,]\d{1,2})(?:\s*(?:[Mm][Xx][Nn]|[Mm]\.[Nn]\.))?[\s|)\]}—–−-]*$/.test(line);
}

function trimTrailingPunctuation(value) {
  return value
    .replace(/[\s|:;,.—–−-]+$/g, '')
    .replace(/[)\]}]+$/g, '')
    .trim();
}

function parseUnit(description) {
  const match = description.match(/(?:^|\b)(m²|m2|m³|m3|ml|kg|litros?|piezas?|pza|servicio|lote|hora|hr|L)(?=$|\s|\b)/i);
  if (!match) return 'Servicio';
  const unit = match[1].toLowerCase();
  if (unit === 'm2') return 'm²';
  if (unit === 'm3') return 'm³';
  if (unit === 'pza' || unit === 'piezas') return 'Pieza';
  if (unit === 'hora' || unit === 'hr') return 'Hora';
  if (unit === 'litro' || unit === 'litros' || unit === 'l') return 'L';
  return match[1];
}

export function extractCatalogItems(text) {
  const lines = text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set();
  const documentCategory = suggestCatalogCategory(text);

  return lines.flatMap((line) => {
    if (line.length < 4 || /\b(cantidad|descripci[oó]n|precio|subtotal|total|iva|impuesto|descuento|p[aá]gina)\b/i.test(line)) return [];

    const trailingPrice = extractTrailingPrice(line);
    const price = trailingPrice?.price ?? null;
    const hasPrice = price !== null || hasPriceLikeSuffix(line);
    const description = trimTrailingPunctuation(
      (trailingPrice?.description ?? removeUnrecognizedTrailingPrice(line))
        .replace(/^[\s|()[\]{}—–−-]*(?:\d{1,3}|T[O0]|[I1]O)[.)]?\s+/i, '')
        .replace(/\bT[OQ]\b(?=\s+veh[ií]culos?\b)/gi, '10')
    );

    if (description.length < 4) return [];
    const suggestedCategory = suggestCatalogCategory(description);
    const hasRecognizableUnit = /(?:^|\b)(m²|m2|m³|m3|ml|kg|litros?|piezas?|pza|servicio|lote|hora|hr|L)(?=$|\s|\b)/i.test(description);
    const hasCatalogTerm = ITEM_DESCRIPTION_TERMS.some((term) => normalizeText(description).includes(term));
    if (!hasPrice && !hasRecognizableUnit && !hasCatalogTerm) return [];
    const category = documentCategory !== 'Otros' && ['Otros', 'Servicios'].includes(suggestedCategory)
      ? documentCategory
      : suggestedCategory;

    const normalizedDescription = description.replace(/\s+/g, ' ').trim();
    const key = normalizeText(normalizedDescription);
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      concept: normalizedDescription,
      unit: parseUnit(normalizedDescription),
      price,
      category
    }];
  });
}
