import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, testSteps } from '@/db/schema'
import AnalyzeButton from '@/components/analyze-button'
import RunPoller from '@/components/run-poller'
import StatusBadge from '@/components/ui/status-badge'
import { ChevronLeft, Clock, CheckCircle2, XCircle, Layers, Cpu, FileText } from 'lucide-react'

function duration(start: Date, end: Date | null) {
  if (!end) return '—'
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

const STEP_ICON: Record<string, React.ReactNode> = {
  passed:  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
  failed:  <XCircle     size={14} className="text-red-500 shrink-0" />,
  skipped: <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-200 shrink-0" />,
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
  const dur    = duration(run.startedAt, run.finishedAt)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-6">
        <Link
          href="/test-runs"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ChevronLeft size={13} /> Test Runs
        </Link>
      </div>

      <RunPoller status={run.status} />

      {/* header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight font-mono">{run.id.slice(0, 8)}</h1>
            <StatusBadge status={run.status} dot />
          </div>
          <p className="text-sm text-zinc-400">
            {run.startedAt.toLocaleString()}
            {run.hardwareId && (
              <span className="ml-3 inline-flex items-center gap-1">
                <Cpu size={11} className="text-zinc-300" /> {run.hardwareId}
              </span>
            )}
            {run.firmwareVersion && (
              <span className="ml-3 font-mono text-zinc-300">fw:{run.firmwareVersion.slice(0, 7)}</span>
            )}
          </p>
        </div>
        <Link
          href={`/report/${run.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-sm"
        >
          <FileText size={13} />
          Report
        </Link>
      </div>

      {/* analysis — full width, above stat cards */}
      {run.status !== 'pending' && run.status !== 'running' && (
        <AnalyzeButton runId={run.id} savedResult={run.analysisResult ?? null} />
      )}

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Duration</p>
            <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
              <Clock size={14} className="text-zinc-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-900 tracking-tight">{dur}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Steps</p>
            <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
              <Layers size={14} className="text-zinc-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-900 tracking-tight">{steps.length}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Passed</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 tracking-tight">{passed}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Failed</p>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${failed > 0 ? 'bg-red-50' : 'bg-zinc-50'}`}>
              <XCircle size={14} className={failed > 0 ? 'text-red-500' : 'text-zinc-400'} />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${failed > 0 ? 'text-red-600' : 'text-zinc-900'}`}>{failed}</p>
        </div>
      </div>

      {run.notes && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Notes</p>
          <p className="text-sm text-zinc-700 leading-relaxed">{run.notes}</p>
        </div>
      )}

      {/* steps */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-800">Test Steps</h2>
        </div>

        {steps.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Layers size={32} className="mx-auto text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400">No steps recorded for this run yet.</p>
          </div>
        ) : (
          steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 px-5 py-4 border-b border-zinc-50 last:border-0 ${
                step.status === 'failed' ? 'bg-red-50/40' : ''
              }`}
            >
              <span className="w-5 text-center text-xs text-zinc-300 font-mono mt-0.5">{i + 1}</span>
              {STEP_ICON[step.status] ?? <div className="w-3.5 h-3.5 rounded-full bg-zinc-200 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800">{step.name}</p>
                {step.message && (
                  <p className="mt-1 text-xs text-zinc-500 font-mono leading-relaxed">{step.message}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={step.status} size="xs" />
                <p className="mt-1 text-xs text-zinc-300">{duration(step.startedAt, step.finishedAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
