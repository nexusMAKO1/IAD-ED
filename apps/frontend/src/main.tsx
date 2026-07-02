import React from 'react'
import ReactDOM from 'react-dom/client'
import { mqttClient } from './mqtt/mqtt.client'

// Initialise global MQTT WebSocket connection on startup
mqttClient.connect()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>IAD & SmartQueue AI</h1>
      <p>Frontend en cours de développement.</p>
    </div>
  </React.StrictMode>
)
