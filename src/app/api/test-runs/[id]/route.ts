import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, id))
  if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(run)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { status, finishedAt, hardwareId, notes } = body as {
    status?: string
    finishedAt?: string
    hardwareId?: string
    notes?: string
  }

  const validStatuses = ['pending', 'running', 'passed', 'failed', 'error']
  if (status && !validStatuses.includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (finishedAt !== undefined) updates.finishedAt = finishedAt ? new Date(finishedAt) : null
  if (hardwareId !== undefined) updates.hardwareId = hardwareId
  if (notes !== undefined) updates.notes = notes

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [run] = await db
    .update(testRuns)
    .set(updates)
    .where(eq(testRuns.id, id))
    .returning()

  if (!run) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(run)
}
