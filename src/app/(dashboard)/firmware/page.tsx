import Link from 'next/link'
import { desc, isNotNull, and } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, testSteps } from '@/db/schema'
import { Cpu, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface VersionSummary {
  version: string
  total: number
  passed: number
  failed: number
  lastRun: Date
  runIds: string[]
}

interface StepMatrix {
  stepName: string
  byVersion: Record<string, 'passed' | 'failed' | 'mixed' | 'skipped'>
}

export default async function FirmwarePage() {
  const runs = await db
    .select()
    .from(testRuns)
    .where(and(isNotNull(testRuns.firmwareVersion), isNotNull(testRuns.finishedAt)))
    .orderBy(desc(testRuns.startedAt))

  if (runs.length === 0) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Firmware Versions</h1>
          <p className="mt-1 text-sm text-zinc-500">Track pass rates and regressions across firmware builds.</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm px-5 py-16 text-center">
          <Cpu size={36} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-400">No runs with firmware version data yet.</p>
          <p className="text-xs text-zinc-300 mt-1">Make sure your firmware reports its version in run frames.</p>
        </div>
      </div>
    )
  }

  const byVersion = new Map<string, VersionSummary>()
  for (const run of runs) {
    const v = run.firmwareVersion!
    if (!byVersion.has(v)) {
      byVersion.set(v, { version: v, total: 0, passed: 0, failed: 0, lastRun: run.startedAt, runIds: [] })
    }
    const s = byVersion.get(v)!
    s.total++
    if (run.status === 'passed') s.passed++
    if (run.status === 'failed' || run.status === 'error') s.failed++
    if (run.startedAt > s.lastRun) s.lastRun = run.startedAt
    s.runIds.push(run.id)
  }

  const versions = [...byVersion.values()].sort((a, b) => b.lastRun.getTime() - a.lastRun.getTime())

  const allRunIds = runs.map((r) => r.id)
  const steps = allRunIds.length > 0 ? await db.select().from(testSteps) : []

  const runVersionMap = new Map(runs.map((r) => [r.id, r.firmwareVersion!]))

  const stepData = new Map<string, Map<string, ('passed' | 'failed' | 'skipped')[]>>()
  for (const step of steps) {
    const ver = runVersionMap.get(step.runId)
    if (!ver) continue
    if (!stepData.has(step.name)) stepData.set(step.name, new Map())
    const vmap = stepData.get(step.name)!
    if (!vmap.has(ver)) vmap.set(ver, [])
    vmap.get(ver)!.push(step.status)
  }

  const versionList = versions.map((v) => v.version)

  const matrix: StepMatrix[] = [...stepData.entries()].map(([name, vmap]) => ({
    stepName: name,
    byVersion: Object.fromEntries(
      versionList.map((ver) => {
        const outcomes = vmap.get(ver)
        if (!outcomes?.length) return [ver, 'skipped' as const]
        const hasFail = outcomes.includes('failed')
        const hasPass = outcomes.includes('passed')
        if (hasFail && hasPass) return [ver, 'mixed' as const]
        if (hasFail) return [ver, 'failed' as const]
        return [ver, 'passed' as const]
      })
    ),
  }))

  function isRegression(row: StepMatrix): boolean {
    let seenPass = false
    for (let i = versionList.length - 1; i >= 0; i--) {
      const s = row.byVersion[versionList[i]]
      if (s === 'passed') seenPass = true
      if (seenPass && s === 'failed') return true
    }
    return false
  }

  const regressionCount = matrix.filter(isRegression).length

  const CELL: Record<string, string> = {
    passed:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
    failed:  'bg-red-100 text-red-700 border border-red-200',
    mixed:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
    skipped: 'bg-zinc-50 text-zinc-400 border border-zinc-100',
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Firmware Versions</h1>
        <p className="mt-1 text-sm text-zinc-500">Pass rates and step-level regression detection across firmware builds.</p>
      </div>

      {/* version cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {versions.map((v) => {
          const rate = v.total > 0 ? Math.round((v.passed / v.total) * 100) : null
          const rateColor =
            rate === null   ? 'text-zinc-300'
            : rate === 100  ? 'text-emerald-600'
            : rate >= 80    ? 'text-zinc-900'
            : 'text-red-600'

          return (
            <div key={v.version} className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <Cpu size={13} className="text-zinc-500" />
                  </div>
                  <span className="font-mono text-sm font-bold text-zinc-900">{v.version}</span>
                </div>
                <span className={`text-2xl font-bold tracking-tight ${rateColor}`}>
                  {rate !== null ? `${rate}%` : '—'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-1">
                {v.total} run{v.total !== 1 ? 's' : ''} · <span className="text-emerald-600">{v.passed} passed</span> · <span className="text-red-500">{v.failed} failed</span>
              </p>
              <p className="text-xs text-zinc-400 mb-3">Last run {v.lastRun.toLocaleDateString()}</p>
              <Link
                href={`/test-runs?firmware=${encodeURIComponent(v.version)}`}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                View runs <ArrowRight size={11} />
              </Link>
            </div>
          )
        })}
      </div>

      {/* regression matrix */}
      {matrix.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Step Regression Matrix</h2>
            <div className="flex items-center gap-2">
              {regressionCount > 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle size={13} />
                  {regressionCount} regression{regressionCount !== 1 ? 's' : ''} detected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} />
                  No regressions
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Test Step
                  </th>
                  {versionList.map((ver) => (
                    <th key={ver} className="px-4 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                      {ver}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => {
                  const regression = isRegression(row)
                  return (
                    <tr key={row.stepName} className={`border-b border-zinc-50 last:border-0 ${regression ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3 font-medium text-zinc-800 text-sm">
                        {row.stepName}
                      </td>
                      {versionList.map((ver) => {
                        const s = row.byVersion[ver] ?? 'skipped'
                        return (
                          <td key={ver} className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${CELL[s]}`}>
                              {s}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center">
                        {regression ? (
                          <span className="flex items-center justify-center gap-1 text-xs font-semibold text-red-600">
                            <AlertTriangle size={11} /> Regressed
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
