'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function SidebarLayout({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-full bg-zinc-50">
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 md:hidden text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>
        {sidebar}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-white tracking-tight">testbench</p>
          </div>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
