'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'

export default function AnalyzeButton({
  runId,
  savedResult = null,
}: {
  runId: string
  savedResult?: string | null
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    savedResult ? 'done' : 'idle'
  )
  const [result, setResult] = useState<string | null>(savedResult)

  async function analyze() {
    setState('loading')
    try {
      const res  = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult(data.analysis)
      setState('done')
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }

  if (state === 'done' || state === 'error') {
    return (
      <div className={`rounded-xl border p-5 mb-8 ${
        state === 'error'
          ? 'border-red-200 bg-red-50'
          : 'border-blue-100 bg-blue-50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className={state === 'error' ? 'text-red-400' : 'text-blue-500'} />
            <p className={`text-xs font-semibold uppercase tracking-wide ${
              state === 'error' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {state === 'error' ? 'Analysis Error' : 'watsonx Analysis'}
            </p>
          </div>
          <button
            onClick={() => { setState('idle'); setResult(null) }}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {state === 'done' ? 'Re-analyze' : 'Dismiss'}
          </button>
        </div>
        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
          state === 'error' ? 'text-red-700' : 'text-zinc-800'
        }`}>
          {result}
        </p>
      </div>
    )
  }

  return (
    <div className="flex justify-end mb-4">
      {state === 'loading' ? (
        <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-400 shadow-sm">
          <Sparkles size={13} className="animate-pulse text-violet-400" />
          Analyzing…
        </div>
      ) : (
        <button
          onClick={analyze}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors shadow-sm"
        >
          <Sparkles size={13} />
          Analyze with watsonx
        </button>
      )}
    </div>
  )
}
