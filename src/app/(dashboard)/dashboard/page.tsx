import { desc, eq, count } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, alerts } from '@/db/schema'

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-zinc-100 text-zinc-600',
  running:  'bg-blue-50 text-blue-700',
  passed:   'bg-green-50 text-green-700',
  failed:   'bg-red-50 text-red-700',
  error:    'bg-orange-50 text-orange-700',
}

export default async function DashboardPage() {
  const [recentRuns, activeAlerts] = await Promise.all([
    db.select().from(testRuns).orderBy(desc(testRuns.startedAt)).limit(5),
    db.select({ value: count() }).from(alerts).where(eq(alerts.acknowledged, false)),
  ])

  const lastRun = recentRuns[0] ?? null
  const finished = recentRuns.filter((r) => r.status === 'passed' || r.status === 'failed')
  const passRate = finished.length === 0
    ? null
    : Math.round((finished.filter((r) => r.status === 'passed').length / finished.length) * 100)
  const alertCount = activeAlerts[0]?.value ?? 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Hardware status, recent test results, and alerts at a glance.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Hardware</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">Disconnected</p>
          <p className="mt-1 text-xs text-zinc-400">No device found</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Run</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {lastRun ? (
              <span className={`text-lg rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[lastRun.status] ?? ''}`}>
                {lastRun.status}
              </span>
            ) : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {lastRun ? lastRun.startedAt.toLocaleString() : 'No runs yet'}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Pass Rate</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {passRate !== null ? `${passRate}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {finished.length > 0 ? `${finished.length} completed runs` : 'No data'}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Active Alerts</p>
          <p className={`mt-2 text-2xl font-semibold ${alertCount > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {alertCount}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{alertCount === 0 ? 'All clear' : 'Needs attention'}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">Recent Test Runs</h2>
        </div>

        {recentRuns.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            No test runs yet. Connect hardware and trigger a test sequence to begin.
          </div>
        ) : (
          recentRuns.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 last:border-0 text-sm"
            >
              <span className="font-mono text-xs text-zinc-400">{run.id.slice(0, 8)}</span>
              <span className="text-zinc-500">{run.startedAt.toLocaleString()}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {run.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
