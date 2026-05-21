import { NextRequest } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { testSteps } from '@/db/schema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const steps = await db
    .select()
    .from(testSteps)
    .where(eq(testSteps.runId, id))
    .orderBy(asc(testSteps.sequence))
  return Response.json(steps)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { sequence, name, status, startedAt, finishedAt, message } = body as {
    sequence: number
    name: string
    status: string
    startedAt: string
    finishedAt?: string
    message?: string
  }

  if (!sequence || !name || !status || !startedAt) {
    return Response.json({ error: 'sequence, name, status, startedAt are required' }, { status: 400 })
  }

  const validStatuses = ['passed', 'failed', 'skipped']
  if (!validStatuses.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const [step] = await db
    .insert(testSteps)
    .values({
      runId: id,
      sequence,
      name,
      status: status as 'passed' | 'failed' | 'skipped',
      startedAt: new Date(startedAt),
      finishedAt: finishedAt ? new Date(finishedAt) : null,
      message: message ?? null,
    })
    .returning()

  return Response.json(step, { status: 201 })
}
