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

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/test-runs', label: 'Test Runs',     icon: FlaskConical    },
  { href: '/firmware',  label: 'Firmware',      icon: Cpu             },
  { href: '/metrics',   label: 'Live Metrics',  icon: Activity        },
  { href: '/alerts',    label: 'Alerts',        icon: Bell, badge: true },
  { href: '/analysis',  label: 'AI Analysis',   icon: Sparkles        },
]

const bottomLinks = [
  { href: '/settings',  label: 'Settings',      icon: Settings        },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
  count?: number
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
        active
          ? 'bg-blue-500/15 text-white'
          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
      )}
      <span className="flex items-center gap-3">
        <Icon
          size={15}
          className={active ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'}
        />
        <span className={active ? 'font-medium' : ''}>{label}</span>
      </span>
      {count != null && count > 0 && (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none min-w-[18px] text-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export default function NavLinks({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <nav className="flex flex-col h-full px-3">
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Navigation
        </p>
        {mainLinks.map(({ href, label, icon, badge }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            count={badge ? alertCount : undefined}
          />
        ))}
      </div>

      <div className="flex flex-col gap-0.5 mt-4 pt-4 border-t border-zinc-800">
        {bottomLinks.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
          />
        ))}
      </div>
    </nav>
  )
}
