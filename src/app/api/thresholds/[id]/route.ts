import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { thresholds } from '@/db/schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { name, metric, condition, value, level, enabled } = body as {
    name?: string; metric?: string; condition?: string
    value?: number; level?: string; enabled?: boolean
  }

  const updates: Record<string, unknown> = {}
  if (name      !== undefined) updates.name      = name
  if (metric    !== undefined) updates.metric    = metric
  if (condition !== undefined) updates.condition = condition
  if (value     !== undefined) updates.value     = value
  if (level     !== undefined) updates.level     = level
  if (enabled   !== undefined) updates.enabled   = enabled

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [row] = await db
    .update(thresholds)
    .set(updates)
    .where(eq(thresholds.id, id))
    .returning()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(row)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.delete(thresholds).where(eq(thresholds.id, id))
  return new Response(null, { status: 204 })
}
