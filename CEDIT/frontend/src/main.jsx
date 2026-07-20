import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import './jewels.css'
import './icon-motion.css'
import App from './App.jsx'
import { configureApiClient } from './config/apiBase.js'
import { loadSettings, applySettingsToDocument } from './utils/userSettings.js'

applySettingsToDocument(loadSettings())
configureApiClient(axios)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
