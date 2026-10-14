const API_BASE = '/api';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      const error = new Error(response.status >= 500
        ? 'No se pudo comunicar con la API. Enciende el servidor y revisa su configuración.'
        : `El servidor devolvió una respuesta no válida (${response.status}).`);
      error.status = response.status;
      throw error;
    }
  }
  if (!response.ok) {
    const error = new Error(payload?.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }

  return payload;
}
