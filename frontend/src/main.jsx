import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './install.js'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { LanguageProvider } from './i18n/language.jsx'
import { ConfirmProvider } from './components/ConfirmDialog.jsx'

// Only in production builds: in dev, a service worker would cache files while you're still editing them.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ConfirmProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfirmProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
