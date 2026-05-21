'use client'

import { useEffect, useState } from 'react'

interface MetricsPayload {
  topic: string
  temperature?: number
  voltage?: number
  currentMa?: number
  gpioStates?: Record<string, boolean>
  hardwareId?: string
  timestamp?: string
}

interface Snapshot {
  temperature: number | null
  voltage: number | null
  currentMa: number | null
  gpioStates: Record<string, boolean>
  lastSeen: Date | null
  connected: boolean
}

const INITIAL: Snapshot = {
  temperature: null,
  voltage: null,
  currentMa: null,
  gpioStates: {},
  lastSeen: null,
  connected: false,
}

function fmt(val: number | null, decimals = 2) {
  return val === null ? '—' : val.toFixed(decimals)
}

export default function LiveMetrics() {
  const [snap, setSnap] = useState<Snapshot>(INITIAL)

  useEffect(() => {
    const es = new EventSource('/api/metrics/stream')

    es.onopen = () => setSnap((s) => ({ ...s, connected: true }))
    es.onerror = () => setSnap((s) => ({ ...s, connected: false }))

    es.onmessage = (e) => {
      try {
        const msg: MetricsPayload = JSON.parse(e.data)
        setSnap((s) => ({
          ...s,
          temperature: msg.temperature ?? s.temperature,
          voltage:     msg.voltage     ?? s.voltage,
          currentMa:   msg.currentMa   ?? s.currentMa,
          gpioStates:  msg.gpioStates  ?? s.gpioStates,
          lastSeen:    new Date(),
          connected:   true,
        }))
      } catch {
        // ignore
      }
    }

    return () => es.close()
  }, [])

  const gpio = Object.entries(snap.gpioStates)

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <span className={`inline-block w-2 h-2 rounded-full ${snap.connected ? 'bg-green-500' : 'bg-zinc-300'}`} />
        <span className="text-xs text-zinc-500">
          {snap.connected ? 'Streaming' : 'Waiting for signal'}
          {snap.lastSeen && (
            <span className="ml-2 text-zinc-400">· last update {snap.lastSeen.toLocaleTimeString()}</span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Temperature</p>
          <p className={`mt-2 text-3xl font-semibold ${snap.temperature === null ? 'text-zinc-300' : 'text-zinc-900'}`}>
            {fmt(snap.temperature, 1)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">°C</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Voltage</p>
          <p className={`mt-2 text-3xl font-semibold ${snap.voltage === null ? 'text-zinc-300' : snap.voltage < 3.0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {fmt(snap.voltage)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">V · nominal 3.3V</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Current</p>
          <p className={`mt-2 text-3xl font-semibold ${snap.currentMa === null ? 'text-zinc-300' : 'text-zinc-900'}`}>
            {fmt(snap.currentMa, 1)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">mA</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">GPIO States</h2>
        </div>
        {gpio.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            Connect hardware to begin streaming metrics.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-px bg-zinc-100 overflow-hidden rounded-b-lg">
            {gpio.map(([pin, high]) => (
              <div key={pin} className="bg-white px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-600">{pin}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${high ? 'bg-green-500' : 'bg-zinc-300'}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
