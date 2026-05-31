'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

type Props = {
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function UserMenu({ name, email, image }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0 text-xs font-semibold text-white">
            {name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-white truncate">{name ?? 'User'}</p>
          <p className="text-[11px] text-zinc-500 truncate">{email ?? ''}</p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        title="Sign out"
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <LogOut size={14} />
      </button>
    </div>
  )
}
