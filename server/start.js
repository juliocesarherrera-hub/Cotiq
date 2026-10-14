import { app, initializeServer } from './index.js';

try {
  await initializeServer();
  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`Cotiq API escuchando en el puerto ${port}.`));
} catch (error) {
  console.error('No se pudo iniciar Cotiq API:', error);
  process.exitCode = 1;
}
