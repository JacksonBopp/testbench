import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'
import RunTestButton from '@/components/run-test-button'
import StatusBadge from '@/components/ui/status-badge'
import { FlaskConical, Clock, ArrowRight } from 'lucide-react'

function duration(start: Date, end: Date | null) {
  if (!end) return null
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export default async function TestRunsPage() {
  const runs = await db.select().from(testRuns).orderBy(desc(testRuns.startedAt))

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Test Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">Full history of automated hardware test sequences.</p>
        </div>
        <RunTestButton />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <FlaskConical size={15} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-800">All Runs</h2>
          <span className="ml-auto text-xs text-zinc-400">{runs.length} total</span>
        </div>

        {runs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Clock size={36} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">No test runs recorded yet.</p>
            <p className="text-xs text-zinc-300 mt-1">Click &quot;Run Test&quot; to trigger your first sequence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-6 px-5 py-2.5 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Run ID</span>
                <span className="col-span-2">Started</span>
                <span>Duration</span>
                <span>Status</span>
                <span>Firmware</span>
              </div>
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/test-runs/${run.id}`}
                  className="grid grid-cols-6 px-5 py-3.5 border-b border-zinc-50 last:border-0 text-sm items-center hover:bg-zinc-50/80 transition-colors group"
                >
                  <span className="font-mono text-xs text-zinc-400">{run.id.slice(0, 8)}</span>
                  <span className="col-span-2 text-zinc-600 text-xs">{run.startedAt.toLocaleString()}</span>
                  <span className="text-xs text-zinc-400">
                    {duration(run.startedAt, run.finishedAt) ?? (
                      <span className="text-zinc-300">—</span>
                    )}
                  </span>
                  <span>
                    <StatusBadge status={run.status} dot size="xs" />
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-400">
                      {run.firmwareVersion ? run.firmwareVersion.slice(0, 7) : <span className="text-zinc-300">—</span>}
                    </span>
                    <ArrowRight size={12} className="text-zinc-200 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
