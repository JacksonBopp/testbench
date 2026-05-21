import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'
import RunTestButton from '@/components/run-test-button'

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-zinc-100 text-zinc-600',
  running:  'bg-blue-50 text-blue-700',
  passed:   'bg-green-50 text-green-700',
  failed:   'bg-red-50 text-red-700',
  error:    'bg-orange-50 text-orange-700',
}

function duration(start: Date, end: Date | null) {
  if (!end) return '—'
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export default async function TestRunsPage() {
  const runs = await db.select().from(testRuns).orderBy(desc(testRuns.startedAt))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Test Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Full history of automated test sequences with pass/fail results.
          </p>
        </div>
        <RunTestButton />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="grid grid-cols-6 px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wide">
          <span>Run ID</span>
          <span>Started</span>
          <span>Duration</span>
          <span>Result</span>
          <span>Firmware</span>
          <span>Hardware</span>
        </div>

        {runs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            No test runs recorded yet.
          </div>
        ) : (
          runs.map((run) => (
            <Link
              key={run.id}
              href={`/test-runs/${run.id}`}
              className="grid grid-cols-6 px-5 py-4 border-b border-zinc-100 last:border-0 text-sm text-zinc-700 items-center hover:bg-zinc-50 transition-colors"
            >
              <span className="font-mono text-xs text-zinc-500">{run.id.slice(0, 8)}</span>
              <span>{run.startedAt.toLocaleString()}</span>
              <span>{duration(run.startedAt, run.finishedAt)}</span>
              <span>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                  {run.status}
                </span>
              </span>
              <span className="font-mono text-xs text-zinc-400">{run.firmwareVersion ?? '—'}</span>
              <span className="text-zinc-400">{run.hardwareId ?? '—'}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
