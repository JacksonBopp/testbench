import Link from 'next/link'
import { desc, eq, count, and, gte } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, alerts } from '@/db/schema'
import StatusBadge from '@/components/ui/status-badge'
import { CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, Zap } from 'lucide-react'

function duration(start: Date, end: Date | null) {
  if (!end) return null
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export default async function DashboardPage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [recentRuns, activeAlerts, weeklyRuns] = await Promise.all([
    db.select().from(testRuns).orderBy(desc(testRuns.startedAt)).limit(8),
    db.select().from(alerts).where(eq(alerts.acknowledged, false)).orderBy(desc(alerts.triggeredAt)).limit(3),
    db.select().from(testRuns).where(gte(testRuns.startedAt, since)),
  ])

  const lastRun   = recentRuns[0] ?? null
  const completed = weeklyRuns.filter((r) => r.status === 'passed' || r.status === 'failed' || r.status === 'error')
  const passed    = completed.filter((r) => r.status === 'passed').length
  const failed    = completed.filter((r) => r.status !== 'passed').length
  const passRate  = completed.length > 0 ? Math.round((passed / completed.length) * 100) : null
  const alertCount = activeAlerts.length

  // last 10 completed for the run history bar
  const barRuns = recentRuns.filter((r) => r.status !== 'pending' && r.status !== 'running').slice(0, 10).reverse()

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Hardware status, test results, and alerts at a glance.</p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Last Run</p>
            <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
              <Zap size={15} className="text-zinc-400" />
            </div>
          </div>
          {lastRun ? (
            <>
              <StatusBadge status={lastRun.status} dot />
              <p className="mt-2 text-xs text-zinc-400">{lastRun.startedAt.toLocaleDateString()}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-zinc-300">—</p>
              <p className="mt-1 text-xs text-zinc-400">No runs yet</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pass Rate</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${
            passRate === null ? 'text-zinc-300'
            : passRate === 100 ? 'text-emerald-600'
            : passRate >= 80  ? 'text-zinc-900'
            : 'text-red-600'
          }`}>
            {passRate !== null ? `${passRate}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{completed.length} runs this week</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Failures</p>
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle size={15} className="text-red-400" />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${failed > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {completed.length > 0 ? failed : '—'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{passed} passed this week</p>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm ${alertCount > 0 ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-semibold uppercase tracking-wider ${alertCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              Active Alerts
            </p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${alertCount > 0 ? 'bg-red-100' : 'bg-zinc-50'}`}>
              <AlertTriangle size={15} className={alertCount > 0 ? 'text-red-500' : 'text-zinc-400'} />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${alertCount > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {alertCount}
          </p>
          <p className={`mt-1 text-xs ${alertCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
            {alertCount === 0 ? 'All clear' : 'Needs attention'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* recent runs */}
        <div className="col-span-2 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Recent Test Runs</h2>
            <Link href="/test-runs" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {/* run history bar */}
          {barRuns.length > 0 && (
            <div className="px-5 pt-4 pb-2 flex items-end gap-1.5">
              {barRuns.map((r) => (
                <Link
                  key={r.id}
                  href={`/test-runs/${r.id}`}
                  title={`${r.status} — ${r.startedAt.toLocaleString()}`}
                  className={`flex-1 rounded-sm transition-opacity hover:opacity-70 ${
                    r.status === 'passed'  ? 'bg-emerald-400' :
                    r.status === 'failed'  ? 'bg-red-400'     :
                    r.status === 'error'   ? 'bg-orange-400'  :
                    'bg-zinc-300'
                  }`}
                  style={{ height: '24px' }}
                />
              ))}
              {Array.from({ length: Math.max(0, 10 - barRuns.length) }).map((_, i) => (
                <div key={i} className="flex-1 rounded-sm bg-zinc-100" style={{ height: '24px' }} />
              ))}
            </div>
          )}

          {recentRuns.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Clock size={32} className="mx-auto text-zinc-200 mb-3" />
              <p className="text-sm text-zinc-400">No test runs yet.</p>
              <p className="text-xs text-zinc-300 mt-1">Connect hardware and trigger a test to begin.</p>
            </div>
          ) : (
            <div>
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/test-runs/${run.id}`}
                  className="flex items-center justify-between px-5 py-3 border-b border-zinc-50 last:border-0 hover:bg-zinc-50/80 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} dot />
                    <div>
                      <p className="text-xs font-mono text-zinc-400">{run.id.slice(0, 8)}</p>
                      {run.firmwareVersion && (
                        <p className="text-xs text-zinc-300 font-mono">fw:{run.firmwareVersion.slice(0, 7)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-400">{run.startedAt.toLocaleString()}</span>
                    {duration(run.startedAt, run.finishedAt) && (
                      <span className="text-xs text-zinc-300">{duration(run.startedAt, run.finishedAt)}</span>
                    )}
                    <ArrowRight size={13} className="text-zinc-200 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* alerts sidebar */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Active Alerts</h2>
            <Link href="/alerts" className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={28} className="mx-auto text-emerald-300 mb-2" />
              <p className="text-sm text-zinc-400">All clear</p>
              <p className="text-xs text-zinc-300 mt-1">No unacknowledged alerts</p>
            </div>
          ) : (
            <div>
              {activeAlerts.map((a) => (
                <div key={a.id} className="px-5 py-3 border-b border-zinc-50 last:border-0">
                  <div className="flex items-start gap-2">
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${a.level === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-700 leading-snug">{a.message}</p>
                      <p className="text-xs text-zinc-400 mt-1">{a.triggeredAt.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              {alertCount > 3 && (
                <div className="px-5 py-3 text-center">
                  <Link href="/alerts" className="text-xs text-zinc-400 hover:text-zinc-600">
                    +{alertCount - 3} more alerts →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
