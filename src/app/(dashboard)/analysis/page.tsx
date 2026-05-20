export default function AnalysisPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Analysis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          IBM watsonx.ai failure log analysis — root cause summaries from test run data.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-1 flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-700 mb-3">Analyze a Run</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Test Run ID</label>
                <input
                  disabled
                  placeholder="e.g. run_001"
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-400 bg-zinc-50 cursor-not-allowed"
                />
              </div>
              <button
                disabled
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white opacity-40 cursor-not-allowed"
              >
                Analyze with watsonx
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-2 rounded-lg border border-zinc-200 bg-white">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-medium text-zinc-700">Analysis Result</h2>
          </div>
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            Select a failed test run to generate a root cause summary.
          </div>
        </div>
      </div>
    </div>
  )
}
