import { NextRequest } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { metrics } from '@/db/schema'

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('runId')
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '100'), 500)

  const query = db
    .select()
    .from(metrics)
    .orderBy(desc(metrics.recordedAt))
    .limit(limit)

  const rows = runId
    ? await db.select().from(metrics).where(eq(metrics.runId, runId)).orderBy(desc(metrics.recordedAt)).limit(limit)
    : await query

  return Response.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { runId, temperature, voltage, currentMa, gpioStates } = body as {
    runId?: string
    temperature?: number
    voltage?: number
    currentMa?: number
    gpioStates?: Record<string, boolean>
  }

  const [row] = await db
    .insert(metrics)
    .values({
      runId: runId ?? null,
      temperature: temperature ?? null,
      voltage: voltage ?? null,
      currentMa: currentMa ?? null,
      gpioStates: gpioStates ?? null,
    })
    .returning()

  return Response.json(row, { status: 201 })
}
