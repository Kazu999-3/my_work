import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Service Worker の登録 (PWAサポート)
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
      updateSW(true)
    }
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
