import mqtt, { MqttClient } from 'mqtt'

declare global {
  var mqttClient: MqttClient | undefined
}

export function getMqttClient(): MqttClient {
  if (global.mqttClient?.connected) return global.mqttClient

  const client = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
    clientId: `testbench-server-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 2000,
  })

  client.on('error', (err) => console.error('[mqtt]', err.message))
  client.on('connect', () => console.log('[mqtt] connected'))
  client.on('offline', () => console.warn('[mqtt] offline'))

  if (process.env.NODE_ENV !== 'production') global.mqttClient = client
  return client
}
