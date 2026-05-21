import Link from 'next/link'
import { desc, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'

const STATUS_STYLES: Record<string, string> = {
  passed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  error:  'bg-orange-50 text-orange-700',
}

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

  const unanalyzedFiltered = unanalyzed.filter(
    (r) => !analyzed.some((a) => a.id === r.id)
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Analysis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          IBM watsonx.ai root cause summaries. Analyze any completed run from its detail page.
        </p>
      </div>

      {analyzed.length === 0 && unanalyzedFiltered.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white px-5 py-16 text-center text-sm text-zinc-400">
          No analyses yet. Run a test and click "Analyze with watsonx" on the run detail page.
        </div>
      )}

      {analyzed.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Analyzed Runs</h2>
          <div className="flex flex-col gap-4">
            {analyzed.map((run) => (
              <div key={run.id} className="rounded-lg border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400">{run.id.slice(0, 8)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {run.status}
                    </span>
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
                      className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      View run →
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                  {run.analysisResult}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {unanalyzedFiltered.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Ready to Analyze</h2>
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            {unanalyzedFiltered.map((run) => (
              <div key={run.id} className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-400">{run.id.slice(0, 8)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-zinc-400">{run.startedAt.toLocaleString()}</span>
                </div>
                <Link
                  href={`/test-runs/${run.id}`}
                  className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Analyze →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
