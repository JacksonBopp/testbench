import { db } from '@/db'
import { thresholds } from '@/db/schema'
import { ThresholdRow, AddThresholdForm } from '@/components/threshold-editor'

export default async function SettingsPage() {
  const rows = await db.select().from(thresholds)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure alert thresholds. The subscriber process checks every incoming metric reading against these rules.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Alert Thresholds</h2>
        <p className="text-sm text-zinc-500 mb-4">
          When a metric reading crosses a threshold, an alert is created automatically.
          Changes take effect within 60 seconds (subscriber re-reads on that interval).
        </p>
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              No thresholds configured. Add one below — the defaults (voltage &lt; 3.0V, temp &gt; 70°C) will no longer apply once you set your own.
            </div>
          ) : (
            rows.map((t) => <ThresholdRow key={t.id} t={t} />)
          )}
          <AddThresholdForm />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">CI / CD Integration</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-700 mb-4">
            Trigger a hardware test from any CI pipeline and block until the result comes back.
            Returns HTTP 200 on pass, 422 on fail, 408 on timeout.
          </p>
          <pre className="rounded-md bg-zinc-950 text-zinc-100 text-xs p-4 overflow-x-auto leading-relaxed">{`# GitHub Actions step
- name: Run hardware validation
  run: |
    result=$(curl -sf -X POST $TESTBENCH_URL/api/webhook/run \\
      -H "Content-Type: application/json" \\
      -d '{"firmwareVersion":"'\''${{ github.sha }}'\''","timeout":120000}')
    echo "$result" | jq .
    echo "$result" | jq -e '.status == "passed"'`}</pre>
          <p className="mt-3 text-xs text-zinc-400">
            Set <code className="font-mono">TESTBENCH_URL</code> as a repository secret pointing to your testbench instance.
            The webhook accepts <code className="font-mono">firmwareVersion</code>, <code className="font-mono">hardwareId</code>, <code className="font-mono">notes</code>, and <code className="font-mono">timeout</code> (ms, max 300000).
          </p>
        </div>
      </section>
    </div>
  )
}
