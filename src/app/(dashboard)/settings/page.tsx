import { db } from '@/db'
import { thresholds } from '@/db/schema'
import { ThresholdRow, AddThresholdForm } from '@/components/threshold-editor'
import { Settings, GitBranch, Bell } from 'lucide-react'

export default async function SettingsPage() {
  const rows = await db.select().from(thresholds)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure alert thresholds and CI/CD integration for the testbench platform.
        </p>
      </div>

      {/* thresholds */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={13} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Alert Thresholds</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          When a metric reading crosses a threshold, an alert is created automatically.
          Changes take effect within 60 seconds (subscriber re-reads on that interval).
        </p>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Bell size={28} className="mx-auto text-zinc-200 mb-2" />
              <p className="text-sm text-zinc-400">No thresholds configured.</p>
              <p className="text-xs text-zinc-300 mt-1">
                Add one below — defaults (voltage &lt; 3.0V, temp &gt; 70°C) apply until you configure your own.
              </p>
            </div>
          ) : (
            rows.map((t) => <ThresholdRow key={t.id} t={t} />)
          )}
          <AddThresholdForm />
        </div>
      </section>

      {/* CI/CD */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={13} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CI / CD Integration</h2>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6">
          <p className="text-sm text-zinc-700 mb-4 leading-relaxed">
            Trigger a hardware test from any CI pipeline and block until the result comes back.
            Returns <span className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded">200</span> on pass,{' '}
            <span className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded">422</span> on fail,{' '}
            <span className="font-mono text-xs bg-zinc-100 px-1.5 py-0.5 rounded">408</span> on timeout.
          </p>
          <pre className="rounded-lg bg-zinc-950 text-zinc-100 text-xs p-5 overflow-x-auto leading-relaxed">{`# GitHub Actions step
- name: Run hardware validation
  run: |
    result=$(curl -sf -X POST $TESTBENCH_URL/api/webhook/run \\
      -H "Content-Type: application/json" \\
      -d '{"firmwareVersion":"'\''\${{ github.sha }}'\''"  ,"timeout":120000}')
    echo "$result" | jq .
    echo "$result" | jq -e '.status == "passed"'`}</pre>
          <div className="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Set <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">TESTBENCH_URL</code> as a repository secret pointing to your testbench instance.
              The webhook accepts <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">firmwareVersion</code>,{' '}
              <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">hardwareId</code>,{' '}
              <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">notes</code>, and{' '}
              <code className="font-mono text-zinc-700 bg-zinc-100 px-1 rounded">timeout</code> (ms, max 300000).
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
