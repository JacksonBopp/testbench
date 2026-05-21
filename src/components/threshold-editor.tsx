'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Threshold {
  id: string
  name: string
  metric: string
  condition: string
  value: number
  level: string
  enabled: boolean
}

const METRIC_LABELS: Record<string, string> = {
  voltage:     'Voltage (V)',
  temperature: 'Temperature (°C)',
  currentMa:   'Current (mA)',
}

export function ThresholdRow({ t }: { t: Threshold }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function toggle() {
    await fetch(`/api/thresholds/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !t.enabled }),
    })
    router.refresh()
  }

  async function remove() {
    setDeleting(true)
    await fetch(`/api/thresholds/${t.id}`, { method: 'DELETE' })
    router.refresh()
  }

  const levelColor = t.level === 'error' ? 'text-red-600' : 'text-yellow-600'

  return (
    <div className={`flex items-center gap-4 px-5 py-4 border-b border-zinc-100 last:border-0 ${!t.enabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800">{t.name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {METRIC_LABELS[t.metric] ?? t.metric}
          {' '}
          {t.condition === 'lt' ? '<' : '>'}
          {' '}
          <span className="font-mono">{t.value}</span>
          {' → '}
          <span className={`font-medium ${levelColor}`}>{t.level}</span>
        </p>
      </div>
      <button
        onClick={toggle}
        className={`text-xs px-2 py-1 rounded border transition-colors ${
          t.enabled
            ? 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
            : 'border-zinc-200 text-zinc-400 hover:border-zinc-400'
        }`}
      >
        {t.enabled ? 'Enabled' : 'Disabled'}
      </button>
      <button
        onClick={remove}
        disabled={deleting}
        className="text-xs text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-40"
      >
        {deleting ? '…' : 'Delete'}
      </button>
    </div>
  )
}

export function AddThresholdForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', metric: 'voltage', condition: 'lt', value: '', level: 'error',
  })

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name || !form.value) { setError('All fields required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, value: Number(form.value) }),
      })
      if (!res.ok) { setError((await res.json()).error); return }
      setForm({ name: '', metric: 'voltage', condition: 'lt', value: '', level: 'error' })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="px-5 py-4 border-t border-zinc-100 bg-zinc-50 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Voltage low"
          className="rounded border border-zinc-200 px-2 py-1.5 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Metric</label>
        <select value={form.metric} onChange={(e) => set('metric', e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400">
          <option value="voltage">Voltage</option>
          <option value="temperature">Temperature</option>
          <option value="currentMa">Current</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Condition</label>
        <select value={form.condition} onChange={(e) => set('condition', e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400">
          <option value="lt">Below (&lt;)</option>
          <option value="gt">Above (&gt;)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Value</label>
        <input
          type="number" step="any"
          value={form.value}
          onChange={(e) => set('value', e.target.value)}
          placeholder="3.0"
          className="rounded border border-zinc-200 px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Level</label>
        <select value={form.level} onChange={(e) => set('level', e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400">
          <option value="error">Error</option>
          <option value="warning">Warning</option>
        </select>
      </div>
      <button
        type="submit" disabled={saving}
        className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
      >
        {saving ? 'Adding…' : 'Add'}
      </button>
      {error && <p className="text-xs text-red-600 self-center">{error}</p>}
    </form>
  )
}
