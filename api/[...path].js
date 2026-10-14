import app, { initializeServer } from '../server/index.js';

export default async function handler(req, res) {
  try {
    await initializeServer();
    return app(req, res);
  } catch (error) {
    console.error('No se pudo inicializar Cotiq API:', error);
    return res.status(500).json({ error: 'No se pudo iniciar la API. Revisa la configuración del servidor.' });
  }
}
