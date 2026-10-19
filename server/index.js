import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { GoogleGenAI, Type } from '@google/genai';
import multer from 'multer';
import { pool, initializeDatabase, inTransaction } from './database.js';
import { LEGAL_TERMS_VERSION } from '../legal-config.js';
import {
  deriveAccountEntitlements,
  isValidWebhookSignature,
  PRODUCTS,
  toCents,
  validateMercadoPagoTokenEnvironment
} from './payment-security.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
let appOrigin = process.env.APP_ORIGIN;
const webhookUrl = process.env.WEBHOOK_URL;
const sessionSecret = process.env.SESSION_SECRET;
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const sessionCookie = 'pf.sid';
const PgSessionStore = connectPgSimple(session);
let initialization;

// Maintains the owner's testing account even when a deployment has not yet configured ADMIN_EMAILS.
const DEFAULT_ADMIN_EMAILS = Object.freeze(['herrera.jchm08@gmail.com']);

const OPENROUTER_MODELS = Object.freeze({
  'openrouter-free': 'openrouter/free'
});

export { app };

function validateEnvironment() {
  appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) throw new Error('Falta APP_ORIGIN.');
  const parsedOrigin = new URL(appOrigin);
  if (parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error('APP_ORIGIN debe contener solo el origen, sin ruta ni parámetros.');
  }
  appOrigin = parsedOrigin.origin;
  if (isProduction && parsedOrigin.protocol !== 'https:') throw new Error('APP_ORIGIN debe usar HTTPS en producción.');
  if (webhookUrl) {
    const parsedWebhookUrl = new URL(webhookUrl);
    if (isProduction && parsedWebhookUrl.protocol !== 'https:') throw new Error('WEBHOOK_URL debe usar HTTPS en producción.');
  }
  if (!sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 bytes aleatorios.');
  }
  if (!accessToken) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN.');
  validateMercadoPagoTokenEnvironment(accessToken, isProduction);
  if (!webhookSecret) throw new Error('Falta MERCADOPAGO_WEBHOOK_SECRET.');
  if (webhookSecret === accessToken) {
    throw new Error('MERCADOPAGO_WEBHOOK_SECRET debe ser el secreto de firma de webhooks, no el Access Token.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');
}

export function initializeServer() {
  if (!initialization) {
    initialization = (async () => {
      validateEnvironment();
      await initializeDatabase();
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}

function accountSnapshot(user) {
  const isAdmin = isAdministrator(user);
  return {
    id: user.id,
    email: user.email,
    plan: isAdmin || user.has_lifetime ? 'vitalicia' : Number(user.credits) > 0 ? 'creditos' : 'gratis',
    credits: isAdmin ? 9999 : Number(user.credits),
    isAdmin
  };
}

function isAdministrator(user) {
  if (!user?.email) return false;
  const configuredAdminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',');
  const adminEmails = [...DEFAULT_ADMIN_EMAILS, ...configuredAdminEmails]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(String(user.email).trim().toLowerCase());
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function authenticate(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  pool
    .query('SELECT id, email, has_lifetime, credits FROM users WHERE id = \$1', [req.session.userId])
    .then(({ rows }) => {
      if (!rows[0]) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'La sesión ya no es válida. Inicia sesión de nuevo.' });
      }
      req.user = rows[0];
      next();
    })
    .catch(next);
}

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const requestOrigin = req.get('origin');
  let isAllowedOrigin = requestOrigin === appOrigin;

  if (!isAllowedOrigin && !isProduction && requestOrigin) {
    try {
      const configuredUrl = new URL(appOrigin);
      const requestUrl = new URL(requestOrigin);
      const loopbackHosts = new Set(['localhost', '127.0.0.1']);
      const isLoopbackAlias = loopbackHosts.has(configuredUrl.hostname) && loopbackHosts.has(requestUrl.hostname);

      isAllowedOrigin =
        isLoopbackAlias && configuredUrl.protocol === requestUrl.protocol && configuredUrl.port === requestUrl.port;
    } catch {
      isAllowedOrigin = false;
    }
  }

  if (!isAllowedOrigin) {
    return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
  }
  next();
}

let preferenceApi;
let paymentApi;

function getMercadoPagoServices() {
  if (!preferenceApi || !paymentApi) {
    const mpClient = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
    preferenceApi = new Preference(mpClient);
    paymentApi = new Payment(mpClient);
  }
  return { preferenceApi, paymentApi };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.post('/api/payments/webhook', async (req, res, next) => {
  const dataId = req.body?.data?.id ?? req.query['data.id'] ?? req.query.id;
  if (req.body?.type && req.body.type !== 'payment') return res.sendStatus(200);

  if (
    !isValidWebhookSignature({
      signature: req.get('x-signature'),
      requestId: req.get('x-request-id'),
      dataId: dataId == null ? '' : String(dataId),
      secret: webhookSecret
    })
  ) {
    return res.status(401).json({ error: 'Firma de notificación inválida.' });
  }

  try {
    const { paymentApi: mpPayment } = getMercadoPagoServices();
    const payment = await mpPayment.get({ id: String(dataId) });
    const purchaseId = payment.external_reference;
    if (!purchaseId) return res.sendStatus(200);

    await inTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT id, user_id, product_id, amount_cents, status FROM purchases WHERE id = \$1 FOR UPDATE',
        [purchaseId]
      );
      const purchase = rows[0];
      if (!purchase) return;

      const product = PRODUCTS[purchase.product_id];
      const matchesPurchase =
        product &&
        payment.currency_id === 'MXN' &&
        toCents(payment.transaction_amount) === Number(purchase.amount_cents) &&
        purchase.amount_cents === product.amountCents;

      if (!matchesPurchase) {
        await client.query('UPDATE purchases SET status = \$2, updated_at = NOW() WHERE id = \$1', [
          purchase.id,
          'review_required'
        ]);
        console.error(`Mercado Pago payment ${dataId} does not match purchase ${purchase.id}.`);
        return;
      }

      const status = String(payment.status || 'unknown');
      const isReversed = ['refunded', 'charged_back'].includes(status);
      await client.query(
        `UPDATE purchases SET status = $2, mp_payment_id = $3,
         fulfilled = CASE WHEN $4 THEN FALSE WHEN $5 THEN TRUE ELSE fulfilled END,
         updated_at = NOW()
         WHERE id = $1`,
        [purchase.id, status, String(dataId), isReversed, status === 'approved']
      );

      if (status === 'approved' || isReversed) {
        await client.query('SELECT id FROM users WHERE id = \$1 FOR UPDATE', [purchase.user_id]);
        const { rows: userPurchases } = await client.query(
          'SELECT product_id, status, fulfilled FROM purchases WHERE user_id = \$1',
          [purchase.user_id]
        );
        const { rows: consumptionRows } = await client.query(
          'SELECT COUNT(*) AS count FROM credit_consumptions WHERE user_id = \$1',
          [purchase.user_id]
        );
        const entitlements = deriveAccountEntitlements(userPurchases, Number(consumptionRows[0].count));
        await client.query('UPDATE users SET has_lifetime = \$2, credits = \$3 WHERE id = \$1', [
          purchase.user_id,
          entitlements.hasLifetime,
          entitlements.credits
        ]);
      }
    });

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

app.use('/api', requireSameOrigin);
app.use(
  session({
    name: sessionCookie,
    store: new PgSessionStore({ pool, tableName: 'sessions', createTableIfMissing: false }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const checkoutLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    if (req.body?.acceptedTermsVersion !== LEGAL_TERMS_VERSION || req.body?.confirmedAdult !== true) {
      return res
        .status(400)
        .json({ error: 'Confirma que tienes 18 años o más y acepta los términos vigentes para crear una cuenta.' });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Escribe un correo electrónico válido.' });
    }
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 12 y 72 bytes.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, terms_version, terms_accepted_at, adult_confirmed_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING RETURNING id, email, has_lifetime, credits`,
      [email, passwordHash, LEGAL_TERMS_VERSION]
    );
    if (!rows[0]) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión.' });

    await regenerateSession(req);
    req.session.userId = rows[0].id;
    await saveSession(req);
    res.status(201).json({ user: accountSnapshot(rows[0]) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows } = await pool.query('SELECT id, email, password_hash, has_lifetime, credits FROM users WHERE email = \$1', [
      email
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    res.json({ user: accountSnapshot(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: accountSnapshot(req.user) });
});

app.post('/api/auth/logout', authenticate, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(sessionCookie, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/'
    });
    res.sendStatus(204);
  });
});

app.get('/api/account', authenticate, (req, res) => {
  res.json({ user: accountSnapshot(req.user) });
});

app.post('/api/generate', authenticate, aiLimiter, async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const modelId = typeof req.body?.modelId === 'string' ? req.body.modelId : '';
    const model = OPENROUTER_MODELS[modelId] || OPENROUTER_MODELS['openrouter-free'];
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();

    if (!prompt || prompt.length > 12000) {
      return res.status(400).json({ error: 'El texto para procesar debe tener entre 1 y 12,000 caracteres.' });
    }
    if (!apiKey) return res.status(503).json({ error: 'La función de IA no está configurada en el servidor.' });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || 'La IA no pudo procesar la solicitud.');
      error.status = response.status >= 400 && response.status < 500 ? 502 : 503;
      throw error;
    }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      const error = new Error('La IA devolvió una respuesta inesperada.');
      error.status = 502;
      throw error;
    }
    res.json({ text });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/checkout', authenticate, checkoutLimiter, async (req, res, next) => {
  try {
    if (req.body?.acceptedTermsVersion !== LEGAL_TERMS_VERSION) {
      return res
        .status(400)
        .json({ error: 'Los términos se actualizaron. Recarga la página y vuelve a aceptar los términos vigentes.' });
    }
    if (req.body?.confirmedAdult !== true) {
      return res
        .status(400)
        .json({ error: 'Confirma que tienes 18 años o más y acepta los términos vigentes para continuar con la compra.' });
    }
    const productId = req.body?.productId;
    const product = PRODUCTS[productId];
    if (!product) return res.status(400).json({ error: 'El producto seleccionado no es válido.' });

    const purchaseId = randomUUID();
    await pool.query(
      `INSERT INTO purchases (
         id, user_id, product_id, amount_cents, status,
         terms_version, terms_accepted_at, adult_confirmed_at
       )
       VALUES ($1, $2, $3, $4, 'created', $5, NOW(), NOW())`,
      [purchaseId, req.user.id, productId, product.amountCents, LEGAL_TERMS_VERSION]
    );

    try {
      const { preferenceApi: mpPref } = getMercadoPagoServices();
      const preference = await mpPref.create({
        body: {
          items: [
            {
              id: productId,
              title: product.title,
              quantity: 1,
              currency_id: 'MXN',
              unit_price: product.amountCents / 100
            }
          ],
          payer: { email: req.user.email },
          external_reference: purchaseId,
          notification_url: webhookUrl || `${appOrigin}/api/payments/webhook`,
          back_urls: {
            success: `${appOrigin}/?mp_payment=return&purchase_id=${purchaseId}`,
            failure: `${appOrigin}/?mp_payment=return&purchase_id=${purchaseId}`,
            pending: `${appOrigin}/?mp_payment=return&purchase_id=${purchaseId}`
          },
          ...(new URL(appOrigin).protocol === 'https:' ? { auto_return: 'approved' } : {}),
          statement_descriptor: 'PRESUFAST',
          metadata: { purchase_id: purchaseId, user_id: req.user.id }
        },
        requestOptions: { idempotencyKey: purchaseId }
      });

      const checkoutUrl = isProduction ? preference.init_point : preference.sandbox_init_point;
      if (!checkoutUrl) throw new Error('Mercado Pago no devolvió una URL de checkout para esta preferencia.');

      await pool.query('UPDATE purchases SET preference_id = \$2, status = \$3, updated_at = NOW() WHERE id = \$1', [
        purchaseId,
        preference.id,
        'pending'
      ]);
      res.status(201).json({ purchaseId, checkoutUrl });
    } catch (error) {
      await pool.query('UPDATE purchases SET status = \$2, updated_at = NOW() WHERE id = \$1', [purchaseId, 'checkout_error']);
      if (error.status === 401 || error.status === 403) {
        const policyCauses = Array.isArray(error.causes)
          ? error.causes.map((cause) => ({
              code: cause?.code,
              description: typeof cause?.description === 'string' ? cause.description.slice(0, 300) : undefined
            }))
          : [];
        const providerMessage = typeof error.message === 'string' ? error.message.slice(0, 300) : '';
        const diagnostic = {
          status: error.status,
          errorCode: error.error,
          providerMessage,
          causes: policyCauses
        };
        console.error('Mercado Pago rechazó la creación del checkout:', diagnostic);

        const authorizationError = new Error(
          error.status === 401
            ? 'Mercado Pago rechazó el Access Token (HTTP 401). Comprueba que sea el token de acceso vigente.'
            : 'Mercado Pago denegó la operación por permisos o políticas de la cuenta (HTTP 403).'
        );
        authorizationError.status = 502;
        authorizationError.cause = error;
        authorizationError.diagnostic = diagnostic;
        return next(authorizationError);
      }
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/purchases/:purchaseId', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, product_id, status, fulfilled, created_at
       FROM purchases WHERE id = $1 AND user_id = $2`,
      [req.params.purchaseId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró esa compra en tu cuenta.' });
    const { rows: accountRows } = await pool.query('SELECT id, email, has_lifetime, credits FROM users WHERE id = \$1', [
      req.user.id
    ]);
    res.json({ purchase: rows[0], user: accountSnapshot(accountRows[0]) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/credits/consume', authenticate, async (req, res, next) => {
  try {
    const quoteId = typeof req.body?.quoteId === 'string' ? req.body.quoteId.trim() : '';
    if (!quoteId || quoteId.length > 100) return res.status(400).json({ error: 'La cotización no es válida.' });

    const result = await inTransaction(async (client) => {
      const { rows: users } = await client.query('SELECT id, has_lifetime, credits FROM users WHERE id = \$1 FOR UPDATE', [
        req.user.id
      ]);
      const user = users[0];
      if (isAdministrator(user)) return { plan: 'vitalicia', credits: 9999, isAdmin: true };
      if (user.has_lifetime) return { plan: 'vitalicia', credits: Number(user.credits) };

      const { rows: inserted } = await client.query(
        `INSERT INTO credit_consumptions (user_id, quote_id)
         VALUES ($1, $2) ON CONFLICT (user_id, quote_id) DO NOTHING RETURNING id`,
        [req.user.id, quoteId]
      );
      if (inserted.length === 0) return { plan: 'creditos', credits: Number(user.credits) };
      if (Number(user.credits) < 1) {
        const error = new Error('No quedan créditos. Compra un paquete para guardar nuevas cotizaciones.');
        error.status = 402;
        throw error;
      }

      const { rows: updated } = await client.query('UPDATE users SET credits = credits - 1 WHERE id = \$1 RETURNING credits', [
        req.user.id
      ]);
      return { plan: 'creditos', credits: Number(updated[0].credits) };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Importación de catálogo mediante IA (Gemini API)
app.post('/api/importar-catalogo', authenticate, upload.single('archivo'), async (req, res, next) => {
  try {
    const rawKey = process.env.GEMINI_API_KEY;
    if (!rawKey) {
      return res.status(500).json({
        error: 'Falta configurar GEMINI_API_KEY en las variables de entorno del servidor.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo.' });
    }

    const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const prompt = `Analiza este documento o imagen y extrae la lista de conceptos, productos o servicios con sus PRECIOS UNITARIOS.

    REGLAS ESTRICATAS DE LECTURA DE PRECIOS:
    1. EXTRACCIÓN DE PRECIO UNITARIO:
       - En tablas con columnas de "Cantidad", "Descripción", "Valor unitario" y "Precio/Total", toma SIEMPRE la columna del "Valor unitario".
    2. CONVENCIÓN DE SEPARADORES (MILES VS DECIMALES):
       - En cotizaciones en español de Latinoamérica, el punto (.) actúa como separador de miles ($35.000 = 35000).
       - Comprueba la matemática (Cantidad × Valor Unitario = Precio Total) para verificar que la cifra corresponda a miles.
       - Devuelve el precio como un NÚMERO PURO de JavaScript (sin $, sin puntos de miles).
       - Ejemplo: "$35.000" debe ser 35000. "$1.350.000" debe ser 1350000.
    3. EXCLUSIONES:
       - Ignora encabezados, fechas, números de teléfono, direcciones, SUBTOTAL, IVA y TOTAL final.
       - Asigna la unidad adecuada (Pieza, Servicio, etc.) y una categoría sugerida.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'Lista de productos o servicios extraídos',
          items: {
            type: Type.OBJECT,
            properties: {
              concepto: { type: Type.STRING, description: 'Nombre o descripción del producto o servicio' },
              unidad: { type: Type.STRING, description: 'Servicio, Pieza, Hora, etc.' },
              categoria: { type: Type.STRING, description: 'Categoría sugerida' },
              precio: { type: Type.NUMBER, description: 'Precio unitario como número entero puro' }
            },
            required: ['concepto', 'unidad', 'categoria', 'precio']
          }
        }
      }
    });

    const conceptos = JSON.parse(response.text);
    res.json({ success: true, conceptos });
  } catch (error) {
    console.error('Error detallado de Gemini API:', error);
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error);
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const responseBody = {
    error: status === 500 ? 'Ocurrió un error del servidor. Inténtalo de nuevo.' : error.message
  };
  if (error.diagnostic) responseBody.diagnostic = error.diagnostic;
  res.status(status).json(responseBody);
});

export default app;
