interface SparklineProps {
  values: (number | null)[]
  width?: number
  height?: number
  min?: number
  max?: number
  dangerBelow?: number
  color?: string
}

export default function Sparkline({
  values,
  width = 300,
  height = 48,
  min,
  max,
  dangerBelow,
  color = '#3f3f46',
}: SparklineProps) {
  const clean = values.filter((v): v is number => v !== null)
  if (clean.length < 2) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-xs text-zinc-300">
        not enough data
      </div>
    )
  }

  const lo  = min  ?? Math.min(...clean)
  const hi  = max  ?? Math.max(...clean)
  const range = hi - lo || 1

  const pad = 4
  const w   = width  - pad * 2
  const h   = height - pad * 2

  const pts = values
    .map((v, i) => {
      if (v === null) return null
      const x = pad + (i / (values.length - 1)) * w
      const y = pad + (1 - (v - lo) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .filter(Boolean)

  const polyline = pts.join(' ')

  // danger threshold line
  let dangerY: number | null = null
  if (dangerBelow !== undefined) {
    dangerY = pad + (1 - (dangerBelow - lo) / range) * h
  }

  const lastVal = clean[clean.length - 1]
  const inDanger = dangerBelow !== undefined && lastVal < dangerBelow
  const lineColor = inDanger ? '#ef4444' : color

  return (
    <svg width={width} height={height} className="overflow-visible">
      {dangerY !== null && (
        <line
          x1={pad} y1={dangerY} x2={pad + w} y2={dangerY}
          stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.4}
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts[pts.length - 1] && (() => {
        const last = pts[pts.length - 1]!.split(',')
        return (
          <circle
            cx={last[0]} cy={last[1]} r={3}
            fill={lineColor}
          />
        )
      })()}
    </svg>
  )
}
