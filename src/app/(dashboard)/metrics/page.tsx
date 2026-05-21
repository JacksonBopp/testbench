import LiveMetrics from '@/components/live-metrics'

export default function MetricsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Live Metrics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time hardware telemetry streamed via MQTT — temperature, voltage, GPIO states.
        </p>
      </div>
      <LiveMetrics />
    </div>
  )
}
