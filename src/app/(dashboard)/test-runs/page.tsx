export default function TestRunsPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Test Runs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Full history of automated test sequences with pass/fail results.
          </p>
        </div>
        <button
          disabled
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white opacity-40 cursor-not-allowed"
        >
          Run Test
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="grid grid-cols-5 px-5 py-3 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wide">
          <span>Run ID</span>
          <span>Started</span>
          <span>Duration</span>
          <span>Result</span>
          <span>Actions</span>
        </div>
        <div className="px-5 py-12 text-center text-sm text-zinc-400">
          No test runs recorded yet.
        </div>
      </div>
    </div>
  )
}
