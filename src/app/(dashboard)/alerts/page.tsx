import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { alerts } from '@/db/schema'
import AcknowledgeButton from '@/components/acknowledge-button'

const LEVEL_STYLES: Record<string, string> = {
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error:   'bg-red-50 text-red-700 border-red-200',
}

const LEVEL_DOT: Record<string, string> = {
  warning: 'bg-yellow-400',
  error:   'bg-red-500',
}

export default async function AlertsPage() {
  const rows = await db.select().from(alerts).orderBy(desc(alerts.triggeredAt))
  const active = rows.filter((a) => !a.acknowledged)
  const archived = rows.filter((a) => a.acknowledged)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Alerts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Threshold breaches and anomalies detected during test runs.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Active{active.length > 0 && <span className="ml-2 text-red-600">{active.length}</span>}
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {active.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-400">All clear.</div>
          ) : (
            active.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 px-5 py-4 border-b border-zinc-100 last:border-0">
                <span className={`mt-1.5 size-2 rounded-full shrink-0 ${LEVEL_DOT[alert.level] ?? 'bg-zinc-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-800">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {alert.triggeredAt.toLocaleString()}
                    {alert.runId && <span className="ml-2 font-mono">{alert.runId.slice(0, 8)}</span>}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_STYLES[alert.level] ?? ''}`}>
                  {alert.level}
                </span>
                <AcknowledgeButton id={alert.id} />
              </div>
            ))
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Acknowledged</h2>
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden opacity-60">
            {archived.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 px-5 py-4 border-b border-zinc-100 last:border-0">
                <span className="mt-1.5 size-2 rounded-full shrink-0 bg-zinc-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-500 line-through">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{alert.triggeredAt.toLocaleString()}</p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-400">
                  {alert.level}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
