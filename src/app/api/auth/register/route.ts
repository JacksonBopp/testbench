import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function POST(req: Request) {
  const { name, email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email))
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await db.insert(users).values({ name: name ?? null, email, password: hashed })

  return NextResponse.json({ ok: true })
}
