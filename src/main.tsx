import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { applyTheme, browserStorage, loadTheme } from './ui/theme'

applyTheme(loadTheme(browserStorage()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
