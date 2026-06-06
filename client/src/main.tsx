import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SplashScreen from './components/SplashScreen.tsx'

// ── Sentry init (cliente, opcional) ─────────────────────────────────
// Se inicializa de forma lazy y tolerante: si @sentry/react no está
// instalado (aún no se corrió `npm install`), la app funciona normal.
async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  try {
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.2),
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      beforeSend(event) {
        if (event.exception?.values?.[0]?.type === 'TypeError' &&
            /fetch|network|offline/i.test(event.exception.values[0].value || '')) {
          return null
        }
        return event
      },
    })
    console.log('🛡️  Sentry (cliente) inicializado.')
  } catch (err) {
    console.warn('⚠️  VITE_SENTRY_DSN definido pero @sentry/react no instalado. Ejecute: cd client && npm install @sentry/react @sentry/tracing')
  }
}

initSentry()

function Root() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <StrictMode>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
