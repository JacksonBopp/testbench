'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard',   badge: false },
  { href: '/test-runs', label: 'Test Runs',   badge: false },
  { href: '/metrics',   label: 'Live Metrics', badge: false },
  { href: '/alerts',    label: 'Alerts',       badge: true  },
  { href: '/analysis',  label: 'AI Analysis',  badge: false },
]

export default function NavLinks({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 px-3">
      {links.map(({ href, label, badge }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
              active
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <span>{label}</span>
            {badge && alertCount > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-medium text-white leading-none">
                {alertCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
