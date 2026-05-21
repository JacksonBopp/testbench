const STYLES: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  running: 'bg-blue-50 text-blue-600 border-blue-200',
  passed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed:  'bg-red-50 text-red-600 border-red-200',
  error:   'bg-orange-50 text-orange-600 border-orange-200',
  skipped: 'bg-zinc-50 text-zinc-400 border-zinc-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  mixed:   'bg-yellow-50 text-yellow-600 border-yellow-200',
}

const DOTS: Record<string, string> = {
  pending: 'bg-zinc-400',
  running: 'bg-blue-500 animate-pulse',
  passed:  'bg-emerald-500',
  failed:  'bg-red-500',
  error:   'bg-orange-500',
  skipped: 'bg-zinc-300',
  warning: 'bg-amber-500',
  mixed:   'bg-yellow-500',
}

export default function StatusBadge({
  status,
  dot = false,
  size = 'sm',
}: {
  status: string
  dot?: boolean
  size?: 'xs' | 'sm'
}) {
  const style = STYLES[status] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'
  const dotStyle = DOTS[status] ?? 'bg-zinc-400'
  const textSize = size === 'xs' ? 'text-xs' : 'text-xs'
  const padding  = size === 'xs' ? 'px-1.5 py-0.5' : 'px-2.5 py-1'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${textSize} ${padding} ${style}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyle}`} />}
      {status}
    </span>
  )
}
