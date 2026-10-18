import app, { initializeServer } from '../server/index.js';

export default async function handler(req, res) {
  try {
    await initializeServer();
    return app(req, res);
  } catch (error) {
    console.error('No se pudo inicializar la API:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: `Error de servidor: ${error.message || 'No se pudo iniciar la API.'}`
      })
    );
  }
}