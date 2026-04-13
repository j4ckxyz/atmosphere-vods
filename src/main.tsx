import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { initializeTheme } from './lib/theme.ts'
import { VideosProvider } from './state/videos-context.tsx'

initializeTheme()

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    updateServiceWorker(true)
  },
  onRegisterError: (error) => {
    if (import.meta.env.DEV) {
      console.error('Service worker registration failed', error)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <VideosProvider>
        <App />
      </VideosProvider>
    </BrowserRouter>
  </StrictMode>,
)
