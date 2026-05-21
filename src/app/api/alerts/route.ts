import { NextRequest } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { alerts } from '@/db/schema'

export async function GET(request: NextRequest) {
  const ack = request.nextUrl.searchParams.get('acknowledged')

  const rows = ack === null
    ? await db.select().from(alerts).orderBy(desc(alerts.triggeredAt))
    : await db.select().from(alerts)
        .where(eq(alerts.acknowledged, ack === 'true'))
        .orderBy(desc(alerts.triggeredAt))

  return Response.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { runId, level, message } = body as {
    runId?: string; level?: string; message?: string
  }

  if (!level || !message) {
    return Response.json({ error: 'level and message are required' }, { status: 400 })
  }

  const validLevels = ['warning', 'error']
  if (!validLevels.includes(level)) {
    return Response.json({ error: 'level must be warning or error' }, { status: 400 })
  }

  const [row] = await db
    .insert(alerts)
    .values({
      runId:   runId ?? null,
      level:   level as 'warning' | 'error',
      message,
    })
    .returning()

  return Response.json(row, { status: 201 })
}
