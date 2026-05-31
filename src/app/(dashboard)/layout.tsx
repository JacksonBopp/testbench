import { eq, count } from 'drizzle-orm'
import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { db } from '@/db'
import { alerts } from '@/db/schema'
import { auth } from '@/auth'
import NavLinks from '@/components/nav-links'
import HardwareStatus from '@/components/hardware-status'
import EdwardChat from '@/components/edward-chat'
import UserMenu from '@/components/user-menu'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ value: alertCount }, session] = await Promise.all([
    db.select({ value: count() }).from(alerts).where(eq(alerts.acknowledged, false)).then(r => r[0]),
    auth(),
  ])

  return (
    <div className="flex h-full bg-zinc-50">
      <aside className="w-64 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800">

        {/* brand */}
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white tracking-tight">testbench</p>
              <p className="text-xs text-zinc-500">Hardware QA Platform</p>
            </div>
          </div>
        </div>

        {/* nav */}
        <div className="flex-1 py-4 overflow-y-auto">
          <NavLinks alertCount={alertCount} />
        </div>

        {/* hardware status */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <HardwareStatus />
        </div>

        {/* user */}
        <div className="px-4 py-3 border-t border-zinc-800">
          {session?.user ? (
            <UserMenu
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <LogIn size={14} />
              Sign In
            </Link>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
      <EdwardChat />
    </div>
  )
}
