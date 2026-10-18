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

function parsePrice(value, allowShortInteger = false) {
  const cleanValue = value
    .trim()
    .replace(/^(?:\$\s*|(?<![A-Za-z])S\s*)/i, '')
    .replace(/\s*(?:MXN|M\.N\.)$/i, '')
    .trim();
  if (!/^\d[\d., ]*$/.test(cleanValue)) return null;

  const digits = cleanValue.replace(/\D/g, '');
  if (digits.length === 0 || (!allowShortInteger && digits.length < 3)) return null;

  const lastSeparator = Math.max(cleanValue.lastIndexOf('.'), cleanValue.lastIndexOf(','));
  const trailingDigits = lastSeparator < 0
    ? 0
    : cleanValue.slice(lastSeparator + 1).replace(/\D/g, '').length;
  const separators = cleanValue.match(/[.,]/g) || [];
  const hasDecimal = trailingDigits > 0 && trailingDigits <= 2;
  const hasGroupedDigits = separators.length > 0
    && cleanValue.slice(lastSeparator + 1).replace(/\D/g, '').length === 3;
  const decimalIndex = hasDecimal && !hasGroupedDigits ? lastSeparator : -1;

  const integerPart = (decimalIndex < 0 ? cleanValue : cleanValue.slice(0, decimalIndex))
    .replace(/\D/g, '');
  const decimalPart = decimalIndex < 0
    ? ''
    : cleanValue.slice(decimalIndex + 1).replace(/\D/g, '');
  const price = Number(decimalIndex < 0 ? integerPart : `${integerPart}.${decimalPart}`);
  return Number.isFinite(price) ? price : null;
}

function hasCurrencyMarker(value) {
  return /(?:[$S]\s*|\s*(?:MXN|M\.N\.)\s*$)/i.test(value);
}

function extractTrailingPrice(line) {
  const normalizedLine = line.replace(/[\s|)\]}—–−-]+$/g, '');
  const match = normalizedLine.match(/(?:\$\s*|(?<![A-Za-z])S\s*)?\d[\d., ]*(?:\s*(?:MXN|M\.N\.))?$/i);
  if (!match) return null;

  const prefix = normalizedLine.slice(0, match.index);
  const hasCurrency = hasCurrencyMarker(match[0]);
  if (!hasCurrency && prefix && !/\s$/.test(prefix)) return null;
  const price = parsePrice(match[0], hasCurrency);
  if (price === null) return null;

  return { price, description: prefix };
}

function isPhoneOrContactLine(value) {
  return /\b(tel(?:[ée]fono)?\.?|cel(?:ular)?|whats?app|correo|e-?mail|www\.|https?:\/\/)\b/i.test(value)
    || /(?:\+?52[\s().-]*)?(?:\d[\s().-]*){10,}/.test(value);
}

function isDocumentNoise(value) {
  return value.length < 4
    || /^\s*(?:cantidad|descripci[oó]n|concepto|unidad|precio|importe|subtotal|total|iva|impuesto|descuento|p[aá]gina|observaciones)\b/i.test(value)
    || /^\s*(?:rfc|tel[eé]fono|celular|whats?app|correo|e-?mail|www\.|https?:\/\/)\b/i.test(value)
    || isPhoneOrContactLine(value);
}

function cleanDescription(value) {
  return value
    .replace(/\b(?:tel\.?|tel[eé]fono|cel(?:ular)?|whats?app|correo|e-?mail)\b[\s:.-]*.*$/i, '')
    .replace(/(?:\+?52[\s().-]*)?(?:\d[\s().-]*){10,}/g, '')
    .replace(/\s+[$S][A-Z]{1,4}\d[\w.,]*$/i, '')
    .replace(/^[\s|()[\]{}—–−-]*(?:\d{1,3}|T[O0]|[I1]O)[.)]?\s+/i, '')
    .replace(/\bT[OQ]\b(?=\s+veh[ií]culos?\b)/gi, '10')
    .replace(/[\s|:;,.—–−-]+$/g, '')
    .replace(/[)\]}]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getExplicitUnit(value) {
  const unit = value.trim().toLowerCase().replace(/\.$/, '');
  if (/^(?:m²|m2|mts?²?)$/.test(unit)) return 'm²';
  if (/^(?:m³|m3)$/.test(unit)) return 'm³';
  if (/^(?:ml|m lineal|metros? lineales?)$/.test(unit)) return 'ml';
  if (/^(?:kg|kgs?|kilogramos?)$/.test(unit)) return 'kg';
  if (/^(?:l|lt|lts?|litros?)$/.test(unit)) return 'L';
  if (/^(?:pza?s?|pieza?s?|unidad(?:es)?)$/.test(unit)) return 'Pieza';
  if (/^(?:hr?s?|horas?)$/.test(unit)) return 'Hora';
  if (/^(?:servicio?s?)$/.test(unit)) return 'Servicio';
  if (/^(?:lote?s?)$/.test(unit)) return 'Lote';
  return null;
}

function parseUnit(description, unitCell = '') {
  const explicitCellUnit = getExplicitUnit(unitCell);
  if (explicitCellUnit) return explicitCellUnit;

  const explicitUnit = description.match(/(?:^|\b)(m(?:etros?)?\s+lineales?|m²|m2|m³|m3|ml|kg|kilogramos?|litros?|piezas?|pza?s?|unidades?|servicios?|lotes?|horas?|hr|L)(?=$|\s|\b)/i);
  if (explicitUnit) return getExplicitUnit(explicitUnit[1]);

  const normalized = normalizeText(description);
  if (/\b(?:pintura|pintar|impermeabilizacion|azulejo|piso|tablaroca|aplanado|yeso)\b/.test(normalized)) return 'm²';
  if (/\b(?:concreto|excavacion|relleno|cimentacion)\b/.test(normalized)) return 'm³';
  if (/\b(?:mano de obra|instalacion|reparacion|mantenimiento|servicio|diagnostico)\b/.test(normalized)) return 'Servicio';
  return 'Servicio';
}

function removeInlineUnit(description) {
  return description.replace(
    /\s+(?:\d+(?:[.,]\d+)?\s+)?(?:m(?:etros?)?\s+lineales?|m²|m2|m³|m3|ml|kg|kilogramos?|litros?|piezas?|pza?s?|unidades?|servicios?|lotes?|horas?|hr|L)\s*$/i,
    ''
  ).trim();
}

function isUnitCell(value) {
  return getExplicitUnit(value) !== null;
}

function parseStructuredLine(line) {
  if (!/[\t|]/.test(line)) return null;
  const cells = line.split(/\t+|\s*\|\s*/).map((cell) => cell.trim()).filter(Boolean);
  if (cells.length < 2) return null;
  if (/^\s*(?:cantidad|descripci[oó]n|concepto|unidad|precio|importe|subtotal|total|iva|impuesto|descuento|p[aá]gina|observaciones)\b/i.test(cells.join(' '))) return [];

  let priceIndex = -1;
  let price = null;
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const candidate = parsePrice(cells[index], true);
    if (candidate !== null) {
      priceIndex = index;
      price = candidate;
      break;
    }
  }

  const unitCell = cells.find(isUnitCell) || '';
  const rawDescription = cleanDescription(cells
    .filter((cell, index) => index !== priceIndex
      && !isUnitCell(cell)
      && !(index === 0 && /^\d{1,3}$/.test(cell)))
    .join(' '));
  const unit = parseUnit(rawDescription, unitCell);
  const description = unitCell ? rawDescription : removeInlineUnit(rawDescription);
  if (isDocumentNoise(description)) return [];

  const hasCatalogTerm = ITEM_DESCRIPTION_TERMS.some((term) => normalizeText(description).includes(term));
  if (price === null && !hasCatalogTerm && !unitCell) return [];
  return [{ concept: description, unit, price, category: suggestCatalogCategory(description) }];
}

function parsePlainLine(line, documentCategory) {
  const cleanedLine = cleanDescription(line);
  if (isDocumentNoise(cleanedLine)) return [];
  const trailingPrice = extractTrailingPrice(cleanedLine);
  const price = trailingPrice?.price ?? null;
  const rawDescription = cleanDescription(trailingPrice?.description ?? cleanedLine);
  const unit = parseUnit(rawDescription);
  const description = removeInlineUnit(rawDescription);
  if (isDocumentNoise(description)) return [];

  const suggestedCategory = suggestCatalogCategory(description);
  const hasCatalogTerm = ITEM_DESCRIPTION_TERMS.some((term) => normalizeText(description).includes(term));
  if (price === null && !hasCatalogTerm) return [];

  const category = documentCategory !== 'Otros' && ['Otros', 'Servicios'].includes(suggestedCategory)
    ? documentCategory
    : suggestedCategory;
  return [{ concept: description, unit, price, category }];
}

export function extractCatalogItems(text) {
  const seen = new Set();
  const documentCategory = suggestCatalogCategory(text);
  return text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .flatMap((rawLine) => {
      const line = rawLine.trim();
      if (!line) return [];
      const items = parseStructuredLine(line);
      return items === null ? parsePlainLine(line, documentCategory) : items;
    })
    .filter((item) => {
      const key = normalizeText(item.concept);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
