'use client'

import { useState } from 'react'

export default function AnalysisForm() {
  const [runId, setRunId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!runId.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: runId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setResult(data.analysis)
      }
    } catch {
      setError('Request failed — is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-8">
      <div className="col-span-1 flex flex-col gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-medium text-zinc-700 mb-3">Analyze a Run</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Test Run ID</label>
              <input
                value={runId}
                onChange={(e) => setRunId(e.target.value)}
                placeholder="e.g. run_001"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !runId.trim()}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
            >
              {loading ? 'Analyzing…' : 'Analyze with watsonx'}
            </button>
          </form>
        </div>
      </div>

      <div className="col-span-2 rounded-lg border border-zinc-200 bg-white">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-medium text-zinc-700">Analysis Result</h2>
        </div>
        <div className="px-5 py-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">{error}</p>
          )}
          {result && (
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{result}</p>
          )}
          {!error && !result && (
            <p className="text-sm text-zinc-400 py-8 text-center">
              Select a failed test run to generate a root cause summary.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
