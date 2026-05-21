import { NextRequest } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'

export async function GET() {
  const runs = await db.select().from(testRuns).orderBy(desc(testRuns.startedAt))
  return Response.json(runs)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { hardwareId, notes } = body as { hardwareId?: string; notes?: string }

  const [run] = await db
    .insert(testRuns)
    .values({ hardwareId: hardwareId ?? null, notes: notes ?? null, status: 'pending' })
    .returning()

  return Response.json(run, { status: 201 })
}
