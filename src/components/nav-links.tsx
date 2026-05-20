'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/test-runs', label: 'Test Runs' },
  { href: '/metrics', label: 'Live Metrics' },
  { href: '/analysis', label: 'AI Analysis' },
]

export default function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1 px-3">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-2 rounded-md text-sm transition-colors ${
            pathname === href
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
