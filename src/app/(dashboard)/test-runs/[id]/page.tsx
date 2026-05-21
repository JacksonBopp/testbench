import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, testSteps } from '@/db/schema'
import AnalyzeButton from '@/components/analyze-button'
import RunPoller from '@/components/run-poller'

const RUN_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  running: 'bg-blue-50 text-blue-700',
  passed:  'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-700',
  error:   'bg-orange-50 text-orange-700',
}

const STEP_STATUS_STYLES: Record<string, string> = {
  passed:  'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-700',
  skipped: 'bg-zinc-100 text-zinc-500',
}

function duration(start: Date, end: Date | null) {
  if (!end) return '—'
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

export default async function TestRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [run, steps] = await Promise.all([
    db.select().from(testRuns).where(eq(testRuns.id, id)).then((r) => r[0] ?? null),
    db.select().from(testSteps).where(eq(testSteps.runId, id)).orderBy(asc(testSteps.sequence)),
  ])

  if (!run) notFound()

  const passed = steps.filter((s) => s.status === 'passed').length
  const failed = steps.filter((s) => s.status === 'failed').length

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/test-runs" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          ← Test Runs
        </Link>
      </div>

      <RunPoller status={run.status} />

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 font-mono">{run.id}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Started {run.startedAt.toLocaleString()}
            {run.hardwareId && <span className="ml-2 text-zinc-400">· {run.hardwareId}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${RUN_STATUS_STYLES[run.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {run.status}
          </span>
          {run.status !== 'pending' && run.status !== 'running' && (
            <AnalyzeButton runId={run.id} savedResult={run.analysisResult ?? null} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{duration(run.startedAt, run.finishedAt)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Steps</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{steps.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Passed</p>
          <p className="mt-2 text-2xl font-semibold text-green-600">{passed}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Failed</p>
          <p className={`mt-2 text-2xl font-semibold ${failed > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{failed}</p>
        </div>
      </div>

      {run.notes && (
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Notes</p>
          <p className="text-sm text-zinc-700">{run.notes}</p>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">Test Steps</h2>
        </div>

        {steps.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            No steps recorded for this run.
          </div>
        ) : (
          steps.map((step) => (
            <div
              key={step.id}
              className="grid grid-cols-5 px-5 py-4 border-b border-zinc-100 last:border-0 text-sm items-start gap-4"
            >
              <span className="text-zinc-400 font-mono text-xs pt-0.5">#{step.sequence}</span>
              <span className="col-span-2 font-medium text-zinc-800">{step.name}</span>
              <span>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STEP_STATUS_STYLES[step.status] ?? ''}`}>
                  {step.status}
                </span>
              </span>
              <span className="text-zinc-400 text-xs">
                {duration(step.startedAt, step.finishedAt)}
                {step.message && (
                  <p className="mt-1 text-zinc-500">{step.message}</p>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
