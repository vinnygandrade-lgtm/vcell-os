import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import App from './App'
import './index.css'

registerSW({
  immediate: true,
  onNeedRefresh() {
    try {
      if (sessionStorage.getItem('vcell-sw-reload') === '1') return
      sessionStorage.setItem('vcell-sw-reload', '1')
    } catch {
      return
    }
    window.location.reload()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
