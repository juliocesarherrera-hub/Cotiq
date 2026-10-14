import serverless from 'serverless-http';
import { app, initializeServer } from '../../server/index.js';

const expressHandler = serverless(app);
let initialization;

export async function handler(event, context) {
  if (!initialization) initialization = initializeServer();
  await initialization;

  const functionPrefix = '/.netlify/functions/api';
  const normalizedEvent = event.path?.startsWith(functionPrefix)
    ? { ...event, path: event.path.replace(functionPrefix, '/api') }
    : event;

  return expressHandler(normalizedEvent, context);
}
