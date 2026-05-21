import Link from 'next/link'
import { desc, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'
import StatusBadge from '@/components/ui/status-badge'
import { Sparkles, ArrowRight, FlaskConical } from 'lucide-react'

export default async function AnalysisPage() {
  const [analyzed, unanalyzed] = await Promise.all([
    db
      .select()
      .from(testRuns)
      .where(isNotNull(testRuns.analysisResult))
      .orderBy(desc(testRuns.analyzedAt))
      .limit(20),
    db
      .select({ id: testRuns.id, status: testRuns.status, startedAt: testRuns.startedAt, hardwareId: testRuns.hardwareId })
      .from(testRuns)
      .where(isNotNull(testRuns.finishedAt))
      .orderBy(desc(testRuns.startedAt))
      .limit(10),
  ])

  const unanalyzedFiltered = unanalyzed.filter((r) => !analyzed.some((a) => a.id === r.id))

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">AI Analysis</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500 ml-9.5">
          IBM watsonx.ai root cause summaries. Analyze any completed run from its detail page.
        </p>
      </div>

      {analyzed.length === 0 && unanalyzedFiltered.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm px-5 py-16 text-center">
          <Sparkles size={32} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-400">No analyses yet.</p>
          <p className="text-xs text-zinc-300 mt-1">Run a test and click &quot;Analyze with watsonx&quot; on the run detail page.</p>
        </div>
      )}

      {analyzed.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={13} className="text-violet-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Analyzed Runs</h2>
          </div>
          <div className="flex flex-col gap-4">
            {analyzed.map((run) => (
              <div key={run.id} className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5">
                      {run.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={run.status} dot size="xs" />
                    {run.hardwareId && (
                      <span className="text-xs text-zinc-400">{run.hardwareId}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {run.analyzedAt && (
                      <span className="text-xs text-zinc-400">
                        analyzed {run.analyzedAt.toLocaleString()}
                      </span>
                    )}
                    <Link
                      href={`/test-runs/${run.id}`}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      View run <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3">
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">
                    {run.analysisResult}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {unanalyzedFiltered.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={13} className="text-zinc-400" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ready to Analyze</h2>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {unanalyzedFiltered.map((run) => (
              <Link
                key={run.id}
                href={`/test-runs/${run.id}`}
                className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-50 last:border-0 hover:bg-zinc-50/80 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-400">{run.id.slice(0, 8)}</span>
                  <StatusBadge status={run.status} dot size="xs" />
                  <span className="text-xs text-zinc-400">{run.startedAt.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400 group-hover:text-violet-600 transition-colors">
                  <Sparkles size={12} />
                  Analyze
                  <ArrowRight size={11} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
