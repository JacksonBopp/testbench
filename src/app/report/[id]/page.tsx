import { notFound } from 'next/navigation'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, testSteps, metrics } from '@/db/schema'
import PrintButton from './print-button'

export const dynamic = 'force-dynamic'

function dur(start: Date, end: Date | null) {
  if (!end) return '—'
  const ms = end.getTime() - start.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null }
function minOf(arr: number[]) { return arr.length ? Math.min(...arr) : null }
function maxOf(arr: number[]) { return arr.length ? Math.max(...arr) : null }

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [run, steps, runMetrics] = await Promise.all([
    db.select().from(testRuns).where(eq(testRuns.id, id)).then((r) => r[0] ?? null),
    db.select().from(testSteps).where(eq(testSteps.runId, id)).orderBy(asc(testSteps.sequence)),
    db.select().from(metrics).where(eq(metrics.runId, id)).orderBy(asc(metrics.recordedAt)).limit(200),
  ])

  if (!run) notFound()

  const passed  = steps.filter((s) => s.status === 'passed').length
  const failed  = steps.filter((s) => s.status === 'failed').length
  const skipped = steps.filter((s) => s.status === 'skipped').length

  const voltages = runMetrics.map((m) => m.voltage).filter((v): v is number => v !== null)
  const temps    = runMetrics.map((m) => m.temperature).filter((t): t is number => t !== null)
  const currents = runMetrics.map((m) => m.currentMa).filter((c): c is number => c !== null)

  const statusLabel = run.status.toUpperCase()
  const statusColor =
    run.status === 'passed' ? '#059669' :
    run.status === 'failed' ? '#dc2626' :
    '#6b7280'

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 2cm; size: A4; }
          body { background: white !important; }
        }
        body { background: #f4f4f5; }
      `}</style>

      <div className="min-h-screen py-10 px-6">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* ── report header ─────────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-zinc-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
                    <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                    <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                    <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-zinc-900">testbench</span>
                <span className="text-xs text-zinc-400">Hardware QA Platform</span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Test Report</h1>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs bg-zinc-100 border border-zinc-200 rounded px-2 py-0.5 text-zinc-600">
                  {run.id}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: statusColor, borderColor: statusColor + '40', backgroundColor: statusColor + '10' }}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <PrintButton />
          </div>

          {/* ── run metadata ──────────────────────────────────────────────── */}
          <div className="px-8 py-5 border-b border-zinc-100">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Started</span>
                <span className="font-medium text-zinc-800">{run.startedAt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Duration</span>
                <span className="font-medium text-zinc-800">{dur(run.startedAt, run.finishedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Hardware</span>
                <span className="font-mono text-xs text-zinc-700">{run.hardwareId ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Firmware</span>
                <span className="font-mono text-xs text-zinc-700">{run.firmwareVersion ?? '—'}</span>
              </div>
              {run.notes && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-zinc-400">Notes</span>
                  <span className="text-zinc-700">{run.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── step summary pills ────────────────────────────────────────── */}
          <div className="px-8 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-4">
            <span className="text-xs text-zinc-500">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
            {passed > 0 && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                {passed} passed
              </span>
            )}
            {failed > 0 && (
              <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                {failed} failed
              </span>
            )}
            {skipped > 0 && (
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-full px-2.5 py-0.5">
                {skipped} skipped
              </span>
            )}
          </div>

          {/* ── test steps ────────────────────────────────────────────────── */}
          {steps.length > 0 && (
            <div className="px-8 py-5 border-b border-zinc-100">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Test Steps</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-2 text-left text-xs text-zinc-400 font-medium w-8">#</th>
                    <th className="pb-2 text-left text-xs text-zinc-400 font-medium">Step</th>
                    <th className="pb-2 text-right text-xs text-zinc-400 font-medium">Status</th>
                    <th className="pb-2 text-right text-xs text-zinc-400 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr
                      key={step.id}
                      className={`border-b border-zinc-50 last:border-0 ${step.status === 'failed' ? 'bg-red-50/60' : ''}`}
                    >
                      <td className="py-2.5 text-xs text-zinc-300 font-mono">{step.sequence}</td>
                      <td className="py-2.5">
                        <span className="font-medium text-zinc-800">{step.name}</span>
                        {step.message && (
                          <p className="text-xs text-red-600 font-mono mt-0.5">{step.message}</p>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`text-xs font-semibold ${
                          step.status === 'passed'  ? 'text-emerald-600' :
                          step.status === 'failed'  ? 'text-red-600'     :
                          'text-zinc-400'
                        }`}>
                          {step.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-xs text-zinc-400 font-mono">
                        {dur(step.startedAt, step.finishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── metrics summary ───────────────────────────────────────────── */}
          {runMetrics.length > 0 && (
            <div className="px-8 py-5 border-b border-zinc-100">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Metrics Summary <span className="normal-case font-normal">({runMetrics.length} readings)</span>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-2 text-left text-xs text-zinc-400 font-medium">Metric</th>
                    <th className="pb-2 text-right text-xs text-zinc-400 font-medium">Min</th>
                    <th className="pb-2 text-right text-xs text-zinc-400 font-medium">Avg</th>
                    <th className="pb-2 text-right text-xs text-zinc-400 font-medium">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {voltages.length > 0 && (
                    <tr className="border-b border-zinc-50">
                      <td className="py-2 text-zinc-700">Voltage (V)</td>
                      <td className={`py-2 text-right font-mono text-xs ${(minOf(voltages) ?? 99) < 3.0 ? 'text-red-600 font-semibold' : 'text-zinc-600'}`}>
                        {minOf(voltages)?.toFixed(3)}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{avg(voltages)?.toFixed(3)}</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{maxOf(voltages)?.toFixed(3)}</td>
                    </tr>
                  )}
                  {temps.length > 0 && (
                    <tr className="border-b border-zinc-50">
                      <td className="py-2 text-zinc-700">Temperature (°C)</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{minOf(temps)?.toFixed(1)}</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{avg(temps)?.toFixed(1)}</td>
                      <td className={`py-2 text-right font-mono text-xs ${(maxOf(temps) ?? 0) > 70 ? 'text-red-600 font-semibold' : 'text-zinc-600'}`}>
                        {maxOf(temps)?.toFixed(1)}
                      </td>
                    </tr>
                  )}
                  {currents.length > 0 && (
                    <tr>
                      <td className="py-2 text-zinc-700">Current (mA)</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{minOf(currents)?.toFixed(1)}</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{avg(currents)?.toFixed(1)}</td>
                      <td className="py-2 text-right font-mono text-xs text-zinc-600">{maxOf(currents)?.toFixed(1)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── AI analysis ───────────────────────────────────────────────── */}
          {run.analysisResult && (
            <div className="px-8 py-5 border-b border-zinc-100">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">AI Analysis</h2>
              <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3">
                <p className="text-xs text-zinc-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {run.analysisResult}
                </p>
              </div>
              <p className="mt-2 text-xs text-zinc-300">IBM watsonx.ai · ibm/granite-3-8b-instruct</p>
            </div>
          )}

          {/* ── footer ────────────────────────────────────────────────────── */}
          <div className="px-8 py-4 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Generated {new Date().toLocaleString()}
            </p>
            <p className="text-xs text-zinc-300">testbench Hardware QA Platform</p>
          </div>

        </div>
      </div>
    </>
  )
}
