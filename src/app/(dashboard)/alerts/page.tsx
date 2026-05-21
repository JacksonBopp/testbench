import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { alerts } from '@/db/schema'
import AcknowledgeButton from '@/components/acknowledge-button'
import { Bell, BellOff, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

export default async function AlertsPage() {
  const rows = await db.select().from(alerts).orderBy(desc(alerts.triggeredAt))
  const active   = rows.filter((a) => !a.acknowledged)
  const archived = rows.filter((a) =>  a.acknowledged)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Alerts</h1>
        <p className="mt-1 text-sm text-zinc-500">Threshold breaches and anomalies detected during test runs.</p>
      </div>

      {/* active */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={13} className="text-zinc-400" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active</h2>
          {active.length > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white leading-none min-w-[18px] text-center">
              {active.length}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {active.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-3" />
              <p className="text-sm text-zinc-400">All clear — no active alerts.</p>
            </div>
          ) : (
            active.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 px-5 py-4 border-b border-zinc-50 last:border-0">
                <div className="mt-0.5 shrink-0">
                  {alert.level === 'error'
                    ? <AlertCircle size={16} className="text-red-500" />
                    : <AlertTriangle size={16} className="text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 leading-snug">{alert.message}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {alert.triggeredAt.toLocaleString()}
                    {alert.runId && (
                      <span className="ml-2 font-mono text-zinc-300">{alert.runId.slice(0, 8)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    alert.level === 'error'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {alert.level}
                  </span>
                  <AcknowledgeButton id={alert.id} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* archived */}
      {archived.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BellOff size={13} className="text-zinc-300" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Acknowledged</h2>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden opacity-60">
            {archived.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 px-5 py-3.5 border-b border-zinc-50 last:border-0">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-400 line-through leading-snug">{alert.message}</p>
                  <p className="mt-0.5 text-xs text-zinc-300">{alert.triggeredAt.toLocaleString()}</p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-400">
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
