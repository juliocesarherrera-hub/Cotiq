# Cotiq

Cotiq es una aplicación React/Vite con una API Express y PostgreSQL para cuentas, créditos y pagos únicos mediante Mercado Pago Checkout Pro.

## Solución recomendada

Checkout Pro es la mejor opción para los dos productos actuales de Cotiq: un paquete de 50 créditos (MXN $149) y una licencia vitalicia PRO (MXN $699). El comprador paga en la página segura de Mercado Pago; el servidor crea la preferencia y solo el webhook firmado, contrastado con la API de pagos, entrega la compra. Los importes y productos se definen en el servidor, nunca en el navegador.

## Desarrollo local

Requisitos: Node.js 20.19 o posterior y PostgreSQL 13 o posterior.

1. Crea una base de datos PostgreSQL para Cotiq y configura `DATABASE_URL` para apuntar a ella.
2. Copia `.env.example` a `.env` y configura `DATABASE_URL`, un `SESSION_SECRET` aleatorio de al menos 32 bytes y tus credenciales de prueba de Mercado Pago. En desarrollo se aceptan credenciales de prueba `TEST-` y `APP_USR-` (Checkout Pro puede usar este último prefijo también en la pestaña **Prueba**); el checkout local siempre usa la URL sandbox. En producción exige `NODE_ENV=production`, `APP_ORIGIN` HTTPS y un token de producción `APP_USR-`.
3. En Mercado Pago Developers crea una aplicación de tipo pagos online, activa Checkout Pro y copia el **Access token de prueba** y el **secreto de firma de webhooks** a `.env`. Son credenciales distintas: `MERCADOPAGO_WEBHOOK_SECRET` no debe contener el Access Token. No pongas ninguna credencial `ACCESS_TOKEN` en `src/` ni en variables `VITE_*`.
4. Configura las notificaciones de pago para el evento **Payments**. En desarrollo, expón el puerto 3001 mediante un túnel HTTPS temporal y asigna la URL pública completa `/api/payments/webhook` a `WEBHOOK_URL`; registra esa misma URL en el panel. El navegador y la API de Cotiq se comunican localmente a través del proxy de Vite.
5. En dos terminales ejecuta:

   ```sh
   npm run dev:api
   npm run dev
   ```

   La API crea las tablas al iniciar. Vite envía `/api` al servidor Express en el puerto 3001 y el frontend consume la API bajo el mismo origen; no hace falta habilitar CORS. Para pagar, inicia sesión o crea una cuenta desde el modal de checkout. El servidor determina el producto y el precio; no confíes en importes enviados por el navegador.

La URL de retorno solo muestra el resultado que consulta la API. No concede licencias. El retorno automático al aprobarse se configura solo cuando `APP_ORIGIN` usa HTTPS; en desarrollo local con HTTP, Mercado Pago muestra el checkout sin activar `auto_return`. Los pagos pendientes se verifican de nuevo durante unos segundos; si la transferencia SPEI/OXXO tarda más, vuelve a Licencia para consultar el estado.

Las claves de licencia escritas en el navegador no conceden acceso. La licencia y el saldo se cargan desde la cuenta autenticada; cada cotización nueva descuenta un crédito en la API y las notificaciones de reembolso/contracargo recalculan los beneficios a partir de las compras confirmadas.

## Uso sin conexión

Abre Cotiq al menos una vez con conexión para que el navegador guarde la aplicación y sus recursos, y luego instálala desde el menú del navegador o agrégala a la pantalla de inicio. Después podrás abrir la app sin internet y seguir usando cotizaciones, clientes, catálogo y perfil de empresa; esos datos se guardan localmente en ese dispositivo y no se sincronizan entre dispositivos. Las cotizaciones nuevas guardadas sin conexión quedan como borradores locales: al recuperar la conexión se valida el crédito de la cuenta y el documento permanece en el dispositivo. El inicio de sesión, la compra de créditos, la verificación de pagos y las funciones que abren servicios externos sí requieren conexión. El modo sin conexión no sustituye una copia de seguridad; exporta o imprime los documentos importantes cuando puedas.

Si Mercado Pago rechaza el checkout con HTTP 401, comprueba que `MERCADOPAGO_ACCESS_TOKEN` sea vigente y pertenezca a la aplicación/cuenta vendedora correcta. Con HTTP 403, verifica que Checkout Pro esté habilitado para esa aplicación y que la cuenta vendedora pueda recibir pagos. Usa credenciales de prueba con cuentas de prueba y credenciales de producción para cobros reales. El backend registra y devuelve al modal el estado, el mensaje, los códigos y las descripciones de política devueltos por Mercado Pago, sin registrar el Access Token. No pongas credenciales en el frontend ni las compartas en mensajes.

## Crear y configurar la aplicación de Mercado Pago

1. Inicia sesión en [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/panel) y entra a **Tus integraciones**.
2. Crea una aplicación para pagos online y selecciona **Checkout Pro**.
3. En credenciales de prueba, copia el Access token al backend (`MERCADOPAGO_ACCESS_TOKEN`).
4. En webhooks/notificaciones, registra `https://TU-DOMINIO/api/payments/webhook`, activa el evento **Payments** y guarda el secreto de firma en `MERCADOPAGO_WEBHOOK_SECRET`.
5. Prueba con credenciales y usuarios de prueba de Mercado Pago. Cuando termines las pruebas, completa la activación requerida por Mercado Pago, cambia a credenciales de producción y vuelve a comprobar el webhook.

La creación de la aplicación dentro de tu cuenta de Mercado Pago y la emisión de credenciales requieren que tú inicies sesión en el panel. No compartas aquí tus tokens ni secretos.

Documentación oficial: [Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/overview), [crear preferencias](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro/create-payment-preference), [webhooks](https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks).

## Despliegue

- Publica la SPA y Express bajo el mismo origen HTTPS. Configura el proxy/reverse proxy para servir `/api/*` desde Express y el resto desde Vite/los archivos estáticos.
- Configura el hosting de la SPA para devolver `index.html` en `/legal` y sus recargas; esa ruta muestra los documentos legales.
- Usa PostgreSQL administrado con copias de seguridad. Configura `DATABASE_URL`, `APP_ORIGIN` HTTPS, `SESSION_SECRET`, `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` como secretos del proveedor; activa TLS de PostgreSQL si el proveedor lo requiere (`DATABASE_SSL=true`).
- En producción usa el Access token de producción y el secreto del webhook del entorno de producción. No subas `.env`.
- El webhook debe poder volver a consultar la API de Mercado Pago. Solo pagos aprobados otorgan acceso; los reembolsos y contracargos revocan la compra correspondiente. Las notificaciones repetidas recalculan beneficios de forma idempotente.

## Estado y límites actuales

- Cuentas, sesiones, pagos, licencia vitalicia, saldo de créditos y consumos viven en PostgreSQL. Las sesiones usan cookie `HttpOnly`, contraseña con hash bcrypt y límites de intentos en autenticación y checkout. El cliente no puede otorgarse licencias cambiando claves o almacenamiento local.
- Las cotizaciones, clientes, catálogo y perfil de empresa se guardan en el almacenamiento local del navegador; no se sincronizan ni se aíslan por cuenta dentro del mismo perfil del navegador. Quien tenga acceso a ese perfil podría verlos.
- El registro no incluye verificación de correo ni recuperación de contraseña. Antes de abrir cuentas al público, configura esos flujos y revisa con asesoría profesional la información legal, fiscal y de consumo aplicable.
- La interfaz del cliente sigue siendo una SPA. Los datos de cuenta y los consumos de créditos se validan en el servidor; no uses estado local como prueba de pago.

## Información legal publicada

La ruta `/legal` incluye términos, aviso de privacidad, cookies y almacenamiento local, y condiciones de compras digitales, entrega y solicitudes de reembolso. El registro y el checkout guardan en PostgreSQL la versión de términos aceptada y la confirmación de mayoría de edad. Si cambian los términos, actualiza `LEGAL_TERMS_VERSION` en `legal-config.js` para solicitar aceptación de la versión nueva.

El proveedor de alojamiento y base de datos de producción aún no está confirmado. Actualiza el aviso de privacidad cuando elijas esos proveedores y antes de procesar datos reales.

## Validaciones

```sh
npm test
npm run lint
npm run build
```
