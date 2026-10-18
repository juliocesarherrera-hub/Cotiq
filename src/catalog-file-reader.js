import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { extractCatalogItems } from './catalog-import.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 10;
const MAX_OCR_DIMENSION = 2400;

function getOcrAssetUrl(path) {
  return new URL(`${import.meta.env.BASE_URL}ocr/${path}`, window.location.origin).href;
}

function getPdfPageText(content) {
  let text = '';
  let previousY = null;
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    const currentY = item.transform?.[5];
    const isNewLine = Number.isFinite(currentY)
      && Number.isFinite(previousY)
      && Math.abs(currentY - previousY) > 2;
    if (text && !text.endsWith('\n')) text += isNewLine ? '\n' : ' ';
    text += item.str;
    if (item.hasEOL) text += '\n';
    previousY = currentY;
  }
  return text;
}

async function getOcrWorker(onProgress) {
  const worker = await createWorker('spa', OEM.LSTM_ONLY, {
    workerPath: getOcrAssetUrl('worker.min.js'),
    corePath: getOcrAssetUrl('tesseract-core-lstm.wasm.js'),
    langPath: getOcrAssetUrl(''),
    gzip: true,
    cachePath: 'cotiq-ocr-v2',
    cacheMethod: 'write',
    workerBlobURL: false,
    logger: ({ status, progress }) => {
      const percentage = Number.isFinite(progress) ? ` ${Math.round(progress * 100)}%` : '';
      onProgress(`Leyendo texto: ${status}${percentage}`);
    }
  });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    user_defined_dpi: '300',
    preserve_interword_spaces: '1'
  });
  return worker;
}

function getPriceRows(tsv) {
  const rows = new Map();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split('\t');
    if (columns[0] !== '5' || columns.length < 12) continue;

    const key = columns.slice(1, 5).join(':');
    const word = {
      text: columns[11],
      confidence: Number(columns[10]),
      left: Number(columns[6]),
      right: Number(columns[6]) + Number(columns[8]),
      top: Number(columns[7]),
      bottom: Number(columns[7]) + Number(columns[9])
    };
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(word);
  }

  return Array.from(rows.values())
    .map((words) => ({
      text: words.map(({ text }) => text).join(' '),
      confidence: words.reduce((total, { confidence }) => total + confidence, 0) / words.length,
      left: Math.min(...words.map(({ left }) => left)),
      right: Math.max(...words.map(({ right }) => right)),
      top: Math.min(...words.map(({ top }) => top)),
      bottom: Math.max(...words.map(({ bottom }) => bottom))
    }))
    .filter(({ text }) => !/\b(subtotal|total|iva|impuesto|descuento)\b/i.test(text)
      && /(?:\d{1,3}(?:[ ,.]\d{3})+(?:[.,]\d{1,2})?|\d{3,}(?:[.,]\d{1,2})?|[$S]\s*\d[\d.,]*)/.test(text))
    .sort((first, second) => first.top - second.top);
}

function getTableRectangle(tsv, width, height) {
  const rows = getPriceRows(tsv);
  if (rows.length === 0) return null;

  const left = Math.max(0, Math.min(...rows.map(({ left }) => left)) - 160);
  const right = Math.min(width, Math.max(...rows.map(({ right }) => right)) + 110);
  const top = Math.max(0, Math.min(...rows.map(({ top }) => top)) - 18);
  const bottom = Math.min(height, Math.max(...rows.map(({ bottom }) => bottom)) + 18);
  if (right <= left || bottom <= top) return null;

  return { left, top, width: right - left, height: bottom - top };
}

function mergeFocusedDescriptions(primaryData, focusedData) {
  const primaryItems = extractCatalogItems(primaryData.text);
  const focusedItems = extractCatalogItems(focusedData.text);
  if (focusedItems.length !== primaryItems.length) {
    return focusedItems.length > primaryItems.length ? focusedData.text : primaryData.text;
  }
  if (primaryItems.length === 0) return primaryData.text;

  const primaryRows = getPriceRows(primaryData.tsv);
  const focusedRows = getPriceRows(focusedData.tsv);
  if (primaryRows.length !== primaryItems.length || focusedRows.length !== focusedItems.length) {
    return primaryData.text;
  }

  return primaryItems.map((item, index) => {
    const description = focusedRows[index].confidence >= primaryRows[index].confidence - 10
      ? focusedItems[index].concept
      : item.concept;
    return `${description}${item.price === null ? '' : ` $${item.price}`}`;
  }).join('\n');
}

async function recognizePage(worker, canvas) {
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const { data: primaryData } = await worker.recognize(canvas, {}, { text: true, tsv: true });
  const rectangle = getTableRectangle(primaryData.tsv, canvas.width, canvas.height);
  let recognizedText = primaryData.text;

  if (rectangle) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const { data: focusedData } = await worker.recognize(
      canvas,
      { rectangle },
      { text: true, tsv: true }
    );
    recognizedText = mergeFocusedDescriptions(primaryData, focusedData);
  }

  if (extractCatalogItems(recognizedText).length === 0) {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data: sparseData } = await worker.recognize(canvas, {}, { text: true, tsv: true });
    if (extractCatalogItems(sparseData.text).length > 0) return sparseData.text;
  }

  return recognizedText;
}

function validateFile(file) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(file.type)
    || /\.(jpe?g|png|webp|bmp)$/i.test(name);

  if (!isPdf && !isImage) {
    throw new Error('Elige un PDF o una imagen JPG, PNG, WEBP o BMP.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo supera el límite de 15 MB. Reduce su tamaño e inténtalo de nuevo.');
  }

  return isPdf;
}

async function readPdf(file, onProgress) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (document.numPages > MAX_PDF_PAGES) {
    await document.destroy();
    throw new Error(`El PDF tiene ${document.numPages} páginas. El límite para importar es de ${MAX_PDF_PAGES}.`);
  }

  let worker = null;
  const pageTexts = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress(`Revisando página ${pageNumber} de ${document.numPages}…`);
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = getPdfPageText(textContent);

      if (extractCatalogItems(pageText).length > 0) {
        pageTexts.push(pageText);
        continue;
      }

      worker ||= await getOcrWorker(onProgress);
      const originalViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, MAX_OCR_DIMENSION / Math.max(originalViewport.width, originalViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar una página del PDF para leerla.');

      try {
        await page.render({ canvasContext: context, viewport }).promise;
        pageTexts.push(await recognizePage(worker, canvas));
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  } finally {
    await document.destroy();
    if (worker) await worker.terminate();
  }

  return pageTexts.join('\n');
}

async function readImage(file, onProgress) {
  const image = await createImageBitmap(file);
  const scale = Math.min(2.5, MAX_OCR_DIMENSION / Math.max(image.width, image.height));
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(image.width * scale);
  canvas.height = Math.ceil(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    image.close();
    throw new Error('No se pudo preparar la imagen para leerla.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const worker = await getOcrWorker(onProgress);
  try {
    return await recognizePage(worker, canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    image.close();
    await worker.terminate();
  }
}

export async function extractCatalogFileText(file, onProgress = () => {}) {
  if (!file) throw new Error('Selecciona un archivo para importar.');
  const isPdf = validateFile(file);
  onProgress('Preparando la lectura del archivo…');
  return isPdf ? readPdf(file, onProgress) : readImage(file, onProgress);
}

export async function importCatalogFile(file, onProgress = () => {}) {
  const text = await extractCatalogFileText(file, onProgress);
  const items = extractCatalogItems(text);

  if (items.length === 0) {
    throw new Error('No encontré partidas legibles. Prueba con un PDF o una foto frontal, bien iluminada y enfocada, donde se distingan los conceptos y precios.');
  }

  return items;
}
