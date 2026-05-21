import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { metrics } from '@/db/schema'
import LiveMetrics from '@/components/live-metrics'
import Sparkline from '@/components/sparkline'

export default async function MetricsPage() {
  const history = await db
    .select()
    .from(metrics)
    .orderBy(desc(metrics.recordedAt))
    .limit(60)

  const chronological = [...history].reverse()
  const voltages     = chronological.map((r) => r.voltage)
  const temperatures = chronological.map((r) => r.temperature)
  const currents     = chronological.map((r) => r.currentMa)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Live Metrics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time hardware telemetry streamed via MQTT — temperature, voltage, GPIO states.
        </p>
      </div>

      <LiveMetrics />

      {history.length >= 2 && (
        <div className="mt-10 grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Voltage — last {history.length} readings
            </p>
            <Sparkline values={voltages} dangerBelow={3.0} min={2.5} max={3.6} />
            <p className="mt-2 text-xs text-zinc-400">nominal 3.3V · alert below 3.0V</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Temperature — last {history.length} readings
            </p>
            <Sparkline values={temperatures} dangerBelow={70} color="#f97316" />
            <p className="mt-2 text-xs text-zinc-400">alert above 70°C</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
              Current — last {history.length} readings
            </p>
            <Sparkline values={currents} color="#6366f1" />
            <p className="mt-2 text-xs text-zinc-400">mA</p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-medium text-zinc-700">Recent Readings</h2>
          </div>
          <div className="grid grid-cols-5 px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            <span>Time</span>
            <span>Temp (°C)</span>
            <span>Voltage (V)</span>
            <span>Current (mA)</span>
            <span>Run</span>
          </div>
          {history.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-5 px-5 py-3 border-b border-zinc-100 last:border-0 text-sm text-zinc-700"
            >
              <span className="text-zinc-400 text-xs">{row.recordedAt.toLocaleTimeString()}</span>
              <span className={row.temperature !== null && row.temperature > 70 ? 'text-orange-600 font-medium' : ''}>
                {row.temperature !== null ? row.temperature.toFixed(1) : '—'}
              </span>
              <span className={row.voltage !== null && row.voltage < 3.0 ? 'text-red-600 font-medium' : ''}>
                {row.voltage !== null ? row.voltage.toFixed(3) : '—'}
              </span>
              <span>{row.currentMa !== null ? row.currentMa.toFixed(1) : '—'}</span>
              <span className="font-mono text-xs text-zinc-400">
                {row.runId ? row.runId.slice(0, 8) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
