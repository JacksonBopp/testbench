'use client'

import { useEffect, useState } from 'react'

export default function HardwareStatus() {
  const [hardwareId, setHardwareId] = useState<string | null>(null)
  const [lastSeen, setLastSeen]     = useState<Date | null>(null)
  const [connected, setConnected]   = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/metrics/stream')

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.topic === 'testbench/heartbeat') {
          setHardwareId(msg.hardwareId ?? null)
          setLastSeen(new Date())
          setConnected(true)
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => setConnected(false)

    // mark disconnected if no heartbeat in 90s
    const watchdog = setInterval(() => {
      if (lastSeen && Date.now() - lastSeen.getTime() > 90_000) {
        setConnected(false)
      }
    }, 10_000)

    return () => { es.close(); clearInterval(watchdog) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-zinc-600'}`} />
      <span className="text-xs text-zinc-500 truncate">
        {connected
          ? `${hardwareId ?? 'Hardware'}: connected`
          : 'Hardware: disconnected'}
      </span>
    </div>
  )
}
