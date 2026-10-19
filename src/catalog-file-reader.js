const MAX_FILE_SIZE = 10 * 1024 * 1024; // Límite de 10 MB

/**
 * Valida el tipo y tamaño del archivo seleccionado por el usuario.
 */
function validateFile(file) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isImage =
    ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(file.type) ||
    /\.(jpe?g|png|webp|bmp)$/i.test(name);

  if (!isPdf && !isImage) {
    throw new Error('Selecciona un archivo PDF o una imagen (JPG, PNG, WEBP o BMP).');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo supera el límite de 10 MB. Elige una foto o PDF de menor tamaño.');
  }

  return isPdf;
}

/**
 * Envía el archivo al backend para ser procesado con la IA de Gemini.
 * @param {File} file - El archivo cargado por el usuario.
 * @param {Function} onProgress - Función para actualizar el estado en pantalla.
 * @returns {Promise<Array>} Lista de conceptos normalizados.
 */
export async function importCatalogFile(file, onProgress = () => {}) {
  if (!file) throw new Error('Selecciona un archivo para importar.');

  validateFile(file);

  onProgress('Enviando documento a la Inteligencia Artificial de Gemini…');

  const formData = new FormData();
  formData.append('archivo', file);

  try {
    onProgress('Analizando texto y precios con Inteligencia Artificial…');

    const response = await fetch('/api/importar-catalogo', {
      method: 'POST',
      body: formData,
      credentials: 'include' // Mantiene la sesión activa del usuario
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo procesar el archivo con la Inteligencia Artificial.');
    }

    if (!data.success || !Array.isArray(data.conceptos)) {
      throw new Error('El servidor devolvió una respuesta con un formato inesperado.');
    }

    if (data.conceptos.length === 0) {
      throw new Error(
        'No se detectaron partidas legibles. Asegúrate de subir una foto clara y enfocada donde se distingan los conceptos y precios.'
      );
    }

    // Adaptación del resultado al formato que espera App.jsx
    return data.conceptos.map((item) => ({
      concept: String(item.concept || item.concepto || '').trim(),
      unit: String(item.unit || item.unidad || 'Servicio').trim(),
      category: String(item.category || item.categoria || 'Otros').trim(),
      price:
        item.price !== undefined && item.price !== null
          ? Number(item.price)
          : item.precio !== undefined && item.precio !== null
          ? Number(item.precio)
          : null
    }));
  } catch (error) {
    console.error('Error durante la lectura del catálogo con IA:', error);
    throw new Error(error.message || 'Ocurrió un problema al analizar el archivo.');
  }
}

export async function extractCatalogFileText(file, onProgress = () => {}) {
  const items = await importCatalogFile(file, onProgress);
  return items.map((i) => `${i.concept}\t${i.unit}\t${i.price}`).join('\n');
}
