'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RunPoller({ status }: { status: string }) {
  const router = useRouter()

  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return

    const id = setInterval(() => router.refresh(), 2000)
    return () => clearInterval(id)
  }, [status, router])

  if (status !== 'pending' && status !== 'running') return null

  return (
    <div className="flex items-center gap-2 text-xs text-blue-600">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
      {status === 'running' ? 'Test in progress…' : 'Waiting for hardware…'}
    </div>
  )
}
