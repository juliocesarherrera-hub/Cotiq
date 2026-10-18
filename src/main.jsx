import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LegalPage from './LegalPage.jsx'
import './index.css' // <-- ¡Esta línea es indispensable!

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch((error) => console.error('No se pudo preparar el modo sin conexión:', error))
  })
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(async (registrations) => {
      const serviceWorkerUrl = new URL('/service-worker.js', window.location.href).href
      const appRegistrations = registrations.filter((registration) => (
        [registration.active, registration.waiting, registration.installing]
          .some((worker) => worker?.scriptURL === serviceWorkerUrl)
      ))
      const wasControlled = Boolean(navigator.serviceWorker.controller)
      const unregistered = await Promise.all(appRegistrations.map((registration) => registration.unregister()))

      if (wasControlled && unregistered.some(Boolean)) window.location.reload()
    })
    .catch((error) => console.error('No se pudo desactivar el modo sin conexión en desarrollo:', error))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/legal') ? <LegalPage /> : <App />}
  </React.StrictMode>,
)