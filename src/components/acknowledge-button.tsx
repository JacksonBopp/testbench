'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AcknowledgeButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function acknowledge() {
    setLoading(true)
    await fetch(`/api/alerts/${id}`, { method: 'PATCH' })
    router.refresh()
  }

  return (
    <button
      onClick={acknowledge}
      disabled={loading}
      className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-40 transition-colors"
    >
      {loading ? '…' : 'Acknowledge'}
    </button>
  )
}
