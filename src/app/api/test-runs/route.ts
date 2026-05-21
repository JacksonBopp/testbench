import { NextRequest } from 'next/server'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns } from '@/db/schema'
import { getMqttClient } from '@/lib/mqtt'

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

  // tell hardware to start
  try {
    const mqtt = getMqttClient()
    mqtt.publish('testbench/command/run', JSON.stringify({ runId: run.id, hardwareId: hardwareId ?? null }), { qos: 1 })
  } catch {
    // non-fatal — hardware may not be connected yet
  }

  return Response.json(run, { status: 201 })
}
