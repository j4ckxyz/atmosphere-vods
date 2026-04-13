import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { VideosProvider } from './state/videos-context.tsx'

registerSW({
  immediate: true,
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
