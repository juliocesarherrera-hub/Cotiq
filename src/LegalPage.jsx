import React from 'react';
import { LEGAL_EFFECTIVE_DATE } from '../legal-config.js';

const sections = [
  { id: 'terminos', label: 'Términos' },
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'cookies', label: 'Cookies y almacenamiento' },
  { id: 'compras', label: 'Compras digitales' }
];

function LegalSection({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-slate-800 py-8 sm:py-10">
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-slate-100">{title}</h2>
      <div className="max-w-[72ch] space-y-4 text-sm leading-7 text-slate-300">{children}</div>
    </section>
  );
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <a href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-black text-slate-950">C</span>
            <span className="font-extrabold tracking-tight">COTIQ</span>
          </a>
          <a href="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
            Volver a Cotiq
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-[72ch]">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Información legal de Cotiq</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Vigente desde {LEGAL_EFFECTIVE_DATE}. Consulta cómo funciona el servicio, cómo se trata la información y cómo se entregan las compras digitales.
          </p>
        </div>

        <nav aria-label="Secciones legales" className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <LegalSection id="terminos" title="Términos y condiciones">
          <p>
            Cotiq es un servicio digital de elaboración y administración de cotizaciones. El proveedor es Julio César Herrera Macossay, quien opera bajo el nombre Cotiq. Domicilio: Camino Real de Carretas 109, Santiago de Querétaro, C.P. 76060, Querétaro, México. Contacto: <a className="text-emerald-300 underline underline-offset-4" href="mailto:cotiq.soporte@gmail.com">cotiq.soporte@gmail.com</a>.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Cuenta y edad mínima</h3>
          <p>
            Para crear una cuenta o comprar debes tener 18 años o más y proporcionar un correo electrónico válido. Eres responsable de mantener segura tu contraseña y de la actividad realizada desde tu cuenta. No compartas tus credenciales.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Planes y uso</h3>
          <p>
            El paquete de 50 créditos tiene un precio de $149 MXN, se paga una sola vez y los créditos no tienen fecha de vencimiento. Cada nueva cotización guardada en línea consume un crédito; un borrador creado sin conexión se valida al recuperar la conexión. La licencia Cotiq PRO cuesta $699 MXN en pago único y habilita las funciones PRO indicadas en la pantalla de Licencia, mientras Cotiq mantenga disponible el servicio y la cuenta permanezca en regla. Ningún plan es una suscripción recurrente.
          </p>
          <p>
            Los importes se muestran en pesos mexicanos. Antes de autorizar el pago revisa el total que presenta Mercado Pago. El acceso se asigna a la cuenta que inició la compra cuando el pago queda confirmado; un pago pendiente no activa todavía créditos o licencia.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Cotizaciones y contenido</h3>
          <p>
            Tú conservas la responsabilidad por la exactitud, legalidad y condiciones de tus cotizaciones, precios, impuestos, garantías, datos de clientes e información que compartas. Cotiq es una herramienta de apoyo y no sustituye asesoría contable, fiscal, jurídica o profesional. Solo incorpora información de terceros cuando tengas derecho a usarla.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Disponibilidad y uso responsable</h3>
          <p>
            No uses Cotiq para actividades ilícitas, fraude, suplantación, vulnerar el servicio o tratar datos personales sin autorización. Podemos limitar temporalmente el acceso cuando sea necesario para proteger cuentas, investigar uso indebido o atender una obligación legal; te informaremos cuando sea posible. El servicio puede cambiar o interrumpirse por mantenimiento o causas técnicas. Estas condiciones no eliminan derechos que te reconozca la legislación aplicable.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Contacto y cambios</h3>
          <p>
            Para soporte, quejas o dudas sobre estos términos escribe a cotiq.soporte@gmail.com. Publicaremos aquí los cambios y su fecha de vigencia. Si un cambio requiere una nueva aceptación para registrarte o comprar, Cotiq solicitará esa aceptación.
          </p>
        </LegalSection>

        <LegalSection id="privacidad" title="Aviso de privacidad integral">
          <p>
            <strong className="text-slate-100">Responsable:</strong> Julio César Herrera Macossay, operador de Cotiq. Domicilio: Camino Real de Carretas 109, Santiago de Querétaro, C.P. 76060, Querétaro, México. Correo para privacidad y derechos ARCO: <a className="text-emerald-300 underline underline-offset-4" href="mailto:cotiq.soporte@gmail.com?subject=Privacidad%20y%20derechos%20ARCO">cotiq.soporte@gmail.com</a>.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Datos que tratamos y finalidades</h3>
          <p>
            Para crear y proteger tu cuenta tratamos correo electrónico, contraseña almacenada mediante hash y datos técnicos de sesión. Para procesar compras y habilitar créditos/licencias tratamos identificadores de compra o pago, producto, importe, estado de la operación y datos de cuenta relacionados. Usamos estos datos para prestar el servicio, autenticarte, prevenir fraude, atender soporte y cumplir obligaciones legales.
          </p>
          <p>
            Las cotizaciones, clientes, catálogo y perfil de empresa —que pueden incluir nombres, teléfonos, correos, RFC, domicilios, fotografías, firmas, datos bancarios o CLABE— se guardan localmente en el almacenamiento del navegador de tu dispositivo y no se sincronizan con la cuenta ni se guardan en los servidores de Cotiq como parte del funcionamiento ordinario. Actualmente no se aíslan por cuenta dentro del mismo perfil del navegador: cualquier persona con acceso a ese perfil podría verlos. No uses un dispositivo o perfil de navegador compartido para información confidencial. Si borras los datos del navegador o dispositivo podrías perderlos; expórtalos o imprime los documentos importantes.
          </p>
          <p>
            Si importas una lista en PDF o foto al catálogo, Cotiq procesa el archivo en el navegador de tu dispositivo; el archivo no se transmite ni se guarda. Solo los conceptos y categorías que confirmes se agregan al catálogo local.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Proveedores y comunicaciones</h3>
          <p>
            Mercado Pago procesa el checkout y los datos de pago conforme a sus propios avisos y condiciones; Cotiq no solicita ni almacena el número completo de tarjeta o el código de seguridad. Si generas el QR SPEI, el valor de la CLABE se envía como parámetro a api.qrserver.com para producir la imagen. Si compartes una cotización por WhatsApp o usas dictado por voz, la información necesaria se entrega al servicio o proveedor que selecciones, sujeto a sus propias políticas. Revisa sus avisos antes de usar esas funciones.
          </p>
          <p>
            La aplicación y la base de datos requieren proveedores de alojamiento e infraestructura. El operador aún no ha confirmado el proveedor de producción; esta información y, en su caso, las transferencias aplicables deben actualizarse aquí antes de procesar datos reales. Los proveedores que se habiliten deberán tratar la información solo para prestar y proteger el servicio.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Conservación y derechos</h3>
          <p>
            Conservamos los datos de cuenta y operación durante el tiempo necesario para prestar el servicio, atender controversias y cumplir obligaciones legales. Puedes solicitar acceso, rectificación, cancelación u oposición (derechos ARCO), así como revocar el consentimiento o limitar el uso cuando proceda, escribiendo desde el correo de tu cuenta a cotiq.soporte@gmail.com con el asunto “Privacidad y derechos ARCO”. Describe tu solicitud y la cuenta; podremos pedir información razonable para verificar tu identidad. La cancelación puede estar sujeta a obligaciones legales de conservación.
          </p>
          <p>
            También puedes solicitar información sobre este aviso en el mismo correo. Publicaremos aquí cualquier cambio material, con la fecha de actualización. No usamos la información local de tus cotizaciones para publicidad de Cotiq.
          </p>
        </LegalSection>

        <LegalSection id="cookies" title="Cookies, almacenamiento local y uso sin conexión">
          <p>
            Cotiq utiliza una cookie propia de sesión, necesaria para mantener tu inicio de sesión y proteger las solicitudes de cuenta. La cookie es HttpOnly, usa SameSite=Lax y en producción Secure; su duración configurada es de hasta siete días. No se utiliza para publicidad.
          </p>
          <p>
            Para que la app funcione, el navegador guarda localmente tus cotizaciones, clientes, catálogo, perfil de empresa y borradores pendientes de validar. El service worker guarda los recursos de la aplicación para permitir abrirla sin conexión. Estos datos permanecen en el dispositivo y no se sincronizan entre dispositivos. Puedes borrar los datos del sitio desde los controles del navegador; al hacerlo se cerrará la sesión y podrías perder documentos locales.
          </p>
          <p>
            Actualmente Cotiq no configura cookies de analítica ni de publicidad. Algunas funciones voluntarias, como generar un QR SPEI, compartir por WhatsApp o dictar texto, se conectan con servicios externos y se describen en el aviso de privacidad. Si incorporamos tecnologías no esenciales, actualizaremos este aviso y los controles correspondientes antes de usarlas.
          </p>
        </LegalSection>

        <LegalSection id="compras" title="Compras, entrega digital y solicitudes de reembolso">
          <h3 className="pt-2 font-bold text-slate-100">Productos y entrega</h3>
          <p>
            Cotiq vende productos digitales; no hay envío físico. El paquete de 50 créditos cuesta $149 MXN, es de pago único y no tiene vencimiento. Cotiq PRO cuesta $699 MXN, es de pago único y permanece disponible mientras el servicio Cotiq siga operando y la cuenta esté en regla. Las funciones incluidas se describen en la pantalla de Licencia.
          </p>
          <p>
            Para comprar debes iniciar sesión. Mercado Pago procesa el pago y Cotiq habilita los créditos o la licencia cuando recibe y verifica la confirmación. Una transferencia o pago pendiente puede tardar en reflejarse. Si el cargo fue confirmado y el producto no aparece, escríbenos a cotiq.soporte@gmail.com desde el correo de la cuenta e incluye fecha, producto e identificador de operación; no envíes números completos de tarjeta ni contraseñas.
          </p>
          <h3 className="pt-2 font-bold text-slate-100">Cancelaciones y reembolsos</h3>
          <p>
            Atenderemos cada solicitud conforme a la legislación mexicana aplicable, incluidas las protecciones de consumo que correspondan. Si hubo un cobro duplicado, un pago confirmado sin entrega o un error de operación, contáctanos en cotiq.soporte@gmail.com con el correo de la cuenta y los datos de la transacción para revisar el caso. No se limita por esta política ningún derecho irrenunciable que te otorgue la ley. Cuando una operación se reembolse o revierta, los créditos o beneficios asociados pueden retirarse de la cuenta.
          </p>
          <p>
            Las solicitudes relacionadas con pagos también pueden requerir seguimiento con Mercado Pago, que procesa el cobro bajo sus propias condiciones. Para información sobre facturación o comprobantes, escribe al correo de soporte con los datos de la compra.
          </p>
        </LegalSection>

        <footer className="border-t border-slate-800 pt-6 text-xs leading-6 text-slate-400">
          <p>Proveedor: Julio César Herrera Macossay · Santiago de Querétaro, México.</p>
          <a className="text-emerald-300 underline underline-offset-4" href="mailto:cotiq.soporte@gmail.com">cotiq.soporte@gmail.com</a>
          <p className="mt-3">Este contenido es información del servicio y no sustituye asesoría jurídica. El aviso debe actualizarse si cambian los tratamientos de datos o los proveedores.</p>
        </footer>
      </main>
    </div>
  );
}
