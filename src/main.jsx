import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return
    }

    window.__poulettesServiceWorkerRegistration = registration

    if (registration.waiting) {
      window.__poulettesUpdateServiceWorker = updateServiceWorker
      window.dispatchEvent(
        new CustomEvent('pwa-update-available', {
          detail: { updateServiceWorker },
        }),
      )
    }

    window.setInterval(() => {
      if (navigator.onLine) {
        void registration.update()
      }
    }, 10 * 60 * 1000)
  },
  onNeedRefresh() {
    window.__poulettesUpdateServiceWorker = updateServiceWorker
    window.dispatchEvent(
      new CustomEvent('pwa-update-available', {
        detail: { updateServiceWorker },
      }),
    )
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
