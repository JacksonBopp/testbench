import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { alerts } from '@/db/schema'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [row] = await db
    .update(alerts)
    .set({ acknowledged: true })
    .where(eq(alerts.id, id))
    .returning()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(row)
}
