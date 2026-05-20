import AnalysisForm from '@/components/analysis-form'

export default function AnalysisPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Analysis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          IBM watsonx.ai failure log analysis — root cause summaries from test run data.
        </p>
      </div>
      <AnalysisForm />
    </div>
  )
}
