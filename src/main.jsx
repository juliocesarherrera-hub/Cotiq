import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LegalPage from './LegalPage.jsx'
import './index.css' // <-- ¡Esta línea es indispensable!

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch((error) => console.error('No se pudo preparar el modo sin conexión:', error))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/legal') ? <LegalPage /> : <App />}
  </React.StrictMode>,
)