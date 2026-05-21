'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FlaskConical,
  Cpu,
  Activity,
  Bell,
  Sparkles,
  Settings,
} from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard, badge: false },
  { href: '/test-runs', label: 'Test Runs',    icon: FlaskConical,    badge: false },
  { href: '/firmware',  label: 'Firmware',     icon: Cpu,             badge: false },
  { href: '/metrics',   label: 'Live Metrics', icon: Activity,        badge: false },
  { href: '/alerts',    label: 'Alerts',       icon: Bell,            badge: true  },
  { href: '/analysis',  label: 'AI Analysis',  icon: Sparkles,        badge: false },
  { href: '/settings',  label: 'Settings',     icon: Settings,        badge: false },
]

export default function NavLinks({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {links.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              active
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon
                size={16}
                className={active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'}
              />
              {label}
            </span>
            {badge && alertCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white leading-none min-w-[18px] text-center">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
