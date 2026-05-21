import { eq, count } from 'drizzle-orm'
import { db } from '@/db'
import { alerts } from '@/db/schema'
import NavLinks from '@/components/nav-links'
import HardwareStatus from '@/components/hardware-status'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ value: alertCount }] = await db
    .select({ value: count() })
    .from(alerts)
    .where(eq(alerts.acknowledged, false))

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 flex flex-col bg-zinc-950">
        <div className="px-6 py-5 border-b border-zinc-800">
          <span className="text-white font-semibold tracking-tight">testbench</span>
        </div>
        <div className="flex-1 py-4">
          <NavLinks alertCount={alertCount} />
        </div>
        <div className="px-6 py-4 border-t border-zinc-800">
          <HardwareStatus />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  )
}
