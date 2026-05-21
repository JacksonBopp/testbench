import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { metrics } from '@/db/schema'
import LiveMetrics from '@/components/live-metrics'
import Sparkline from '@/components/sparkline'
import { Activity, Thermometer, Zap, Gauge } from 'lucide-react'

export default async function MetricsPage() {
  const history = await db
    .select()
    .from(metrics)
    .orderBy(desc(metrics.recordedAt))
    .limit(60)

  const chronological = [...history].reverse()
  const voltages      = chronological.map((r) => r.voltage)
  const temperatures  = chronological.map((r) => r.temperature)
  const currents      = chronological.map((r) => r.currentMa)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Live Metrics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time hardware telemetry streamed via MQTT — temperature, voltage, GPIO states.
        </p>
      </div>

      <div className="mb-8">
        <LiveMetrics />
      </div>

      {history.length >= 2 && (
        <div className="grid grid-cols-3 gap-4 mb-8">

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Zap size={13} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-700">Voltage</p>
                <p className="text-xs text-zinc-400">last {history.length} readings</p>
              </div>
            </div>
            <Sparkline values={voltages} dangerBelow={3.0} min={2.5} max={3.6} />
            <p className="mt-2 text-xs text-zinc-400">nominal 3.3V · alert below 3.0V</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <Thermometer size={13} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-700">Temperature</p>
                <p className="text-xs text-zinc-400">last {history.length} readings</p>
              </div>
            </div>
            <Sparkline values={temperatures} dangerBelow={70} color="#f97316" />
            <p className="mt-2 text-xs text-zinc-400">alert above 70°C</p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Gauge size={13} className="text-violet-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-700">Current</p>
                <p className="text-xs text-zinc-400">last {history.length} readings</p>
              </div>
            </div>
            <Sparkline values={currents} color="#6366f1" />
            <p className="mt-2 text-xs text-zinc-400">mA draw</p>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Activity size={14} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-800">Recent Readings</h2>
          </div>
          <div className="grid grid-cols-5 px-5 py-2.5 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Time</span>
            <span>Temp (°C)</span>
            <span>Voltage (V)</span>
            <span>Current (mA)</span>
            <span>Run</span>
          </div>
          {history.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-5 px-5 py-3 border-b border-zinc-50 last:border-0 text-sm"
            >
              <span className="text-xs text-zinc-400">{row.recordedAt.toLocaleTimeString()}</span>
              <span className={`text-xs font-medium ${row.temperature !== null && row.temperature > 70 ? 'text-orange-600' : 'text-zinc-700'}`}>
                {row.temperature !== null ? row.temperature.toFixed(1) : <span className="text-zinc-300">—</span>}
              </span>
              <span className={`text-xs font-medium ${row.voltage !== null && row.voltage < 3.0 ? 'text-red-600' : 'text-zinc-700'}`}>
                {row.voltage !== null ? row.voltage.toFixed(3) : <span className="text-zinc-300">—</span>}
              </span>
              <span className="text-xs text-zinc-700">
                {row.currentMa !== null ? row.currentMa.toFixed(1) : <span className="text-zinc-300">—</span>}
              </span>
              <span className="font-mono text-xs text-zinc-400">
                {row.runId ? row.runId.slice(0, 8) : <span className="text-zinc-300">—</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm px-5 py-16 text-center">
          <Activity size={36} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-400">No metrics recorded yet.</p>
          <p className="text-xs text-zinc-300 mt-1">Connect hardware and run a test to start collecting telemetry.</p>
        </div>
      )}
    </div>
  )
}
