import { NextRequest } from 'next/server'
import { db } from '@/db'
import { thresholds } from '@/db/schema'

export async function GET() {
  const rows = await db.select().from(thresholds)
  return Response.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { name, metric, condition, value, level } = body as {
    name?: string; metric?: string; condition?: string; value?: number; level?: string
  }

  if (!name || !metric || !condition || value === undefined || !level) {
    return Response.json({ error: 'name, metric, condition, value, level required' }, { status: 400 })
  }
  if (!['voltage', 'temperature', 'currentMa'].includes(metric)) {
    return Response.json({ error: 'metric must be voltage, temperature, or currentMa' }, { status: 400 })
  }
  if (!['lt', 'gt'].includes(condition)) {
    return Response.json({ error: 'condition must be lt or gt' }, { status: 400 })
  }
  if (!['warning', 'error'].includes(level)) {
    return Response.json({ error: 'level must be warning or error' }, { status: 400 })
  }

  const [row] = await db
    .insert(thresholds)
    .values({ name, metric, condition: condition as 'lt' | 'gt', value, level: level as 'warning' | 'error' })
    .returning()

  return Response.json(row, { status: 201 })
}
