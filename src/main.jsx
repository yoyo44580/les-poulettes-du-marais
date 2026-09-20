import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur affichage application', error, info)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fff8ec', color: '#173a26' }}>
        <section style={{ maxWidth: 560, border: '1px solid #ead9bb', borderRadius: 16, padding: 24, background: '#fffdf8', boxShadow: '0 18px 40px rgba(68, 48, 24, 0.12)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#b45309' }}>Petit souci d'affichage</p>
          <h1 style={{ margin: '0 0 12px', fontSize: 28 }}>L'application n'a pas pu afficher cette page.</h1>
          <p style={{ margin: '0 0 18px', lineHeight: 1.5 }}>
            Rechargez la page. Si le souci continue, l'erreur visible ici permettra de corriger plus vite.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', padding: 12, borderRadius: 10, background: '#f6ead4', fontSize: 13 }}>
            {this.state.error?.message || 'Erreur inconnue'}
          </pre>
          <button type="button" onClick={() => globalThis.location.reload()} style={{ marginTop: 16, padding: '12px 16px', borderRadius: 999, border: 0, background: '#166534', color: 'white', fontWeight: 700 }}>
            Recharger l'application
          </button>
        </section>
      </main>
    )
  }
}

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
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
