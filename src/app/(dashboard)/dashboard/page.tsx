export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Hardware status, recent test results, and alerts at a glance.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Hardware', value: 'Disconnected', sub: 'No device found' },
          { label: 'Last Run', value: '—', sub: 'No runs yet' },
          { label: 'Pass Rate', value: '—', sub: 'No data' },
          { label: 'Active Alerts', value: '0', sub: 'All clear' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-5">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
            <p className="mt-1 text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">Recent Test Runs</h2>
        </div>
        <div className="px-5 py-12 text-center text-sm text-zinc-400">
          No test runs yet. Connect hardware and trigger a test sequence to begin.
        </div>
      </div>
    </div>
  )
}
