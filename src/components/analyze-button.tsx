'use client'

import { useState } from 'react'

export default function AnalyzeButton({ runId }: { runId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<string | null>(null)

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

  return (
    <div>
      {state === 'idle' && (
        <button
          onClick={analyze}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Analyze with watsonx
        </button>
      )}

      {state === 'loading' && (
        <div className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-400">
          Analyzing…
        </div>
      )}

      {(state === 'done' || state === 'error') && (
        <div className={`mt-4 rounded-lg border p-5 text-sm ${
          state === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-blue-100 bg-blue-50 text-zinc-800'
        }`}>
          {state === 'done' && (
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">
              watsonx Analysis
            </p>
          )}
          <p className="whitespace-pre-wrap leading-relaxed">{result}</p>
          <button
            onClick={() => { setState('idle'); setResult(null) }}
            className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
