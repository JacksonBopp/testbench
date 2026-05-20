export default function MetricsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Live Metrics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Real-time hardware telemetry streamed via MQTT — temperature, voltage, GPIO states.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Temperature', unit: '°C' },
          { label: 'Voltage', unit: 'V' },
          { label: 'Current', unit: 'mA' },
        ].map(({ label, unit }) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-300">—</p>
            <p className="mt-1 text-xs text-zinc-400">{unit} · no signal</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">GPIO States</h2>
        </div>
        <div className="px-5 py-12 text-center text-sm text-zinc-400">
          Connect hardware to begin streaming metrics.
        </div>
      </div>
    </div>
  )
}
