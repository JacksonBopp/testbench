import NavLinks from '@/components/nav-links'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 flex flex-col bg-zinc-950">
        <div className="px-6 py-5 border-b border-zinc-800">
          <span className="text-white font-semibold tracking-tight">testbench</span>
        </div>
        <div className="flex-1 py-4">
          <NavLinks />
        </div>
        <div className="px-6 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-zinc-600" />
            <span className="text-xs text-zinc-500">Hardware: disconnected</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-white">{children}</main>
    </div>
  )
}
