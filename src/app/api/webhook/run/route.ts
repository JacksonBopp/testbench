import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { testRuns, testSteps } from '@/db/schema'
import { getMqttClient } from '@/lib/mqtt'

const POLL_INTERVAL_MS = 1500
const DEFAULT_TIMEOUT_MS = 120_000

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const {
    hardwareId,
    firmwareVersion,
    notes,
    timeout = DEFAULT_TIMEOUT_MS,
  } = body as {
    hardwareId?: string
    firmwareVersion?: string
    notes?: string
    timeout?: number
  }

  const timeoutMs = Math.min(Number(timeout), 300_000)

  // create the run
  const [run] = await db
    .insert(testRuns)
    .values({
      hardwareId:      hardwareId      ?? null,
      firmwareVersion: firmwareVersion ?? null,
      notes:           notes           ?? null,
      status:          'pending',
    })
    .returning()

  // dispatch to hardware
  try {
    const mqtt = getMqttClient()
    mqtt.publish(
      'testbench/command/run',
      JSON.stringify({ runId: run.id, hardwareId: hardwareId ?? null, firmwareVersion }),
      { qos: 1 },
    )
  } catch {
    // hardware offline — run stays pending, we still wait
  }

  // long-poll until terminal status or timeout
  const deadline = Date.now() + timeoutMs
  const TERMINAL = new Set(['passed', 'failed', 'error'])

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const [current] = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, run.id))

    if (!current) break

    if (TERMINAL.has(current.status)) {
      const steps = await db
        .select()
        .from(testSteps)
        .where(eq(testSteps.runId, run.id))

      const passed = steps.filter((s) => s.status === 'passed').length
      const failed = steps.filter((s) => s.status === 'failed').length

      return Response.json({
        runId:           current.id,
        status:          current.status,
        firmwareVersion: current.firmwareVersion,
        hardwareId:      current.hardwareId,
        startedAt:       current.startedAt,
        finishedAt:      current.finishedAt,
        stepCount:       steps.length,
        passed,
        failed,
        steps: steps.map((s) => ({
          sequence: s.sequence,
          name:     s.name,
          status:   s.status,
          message:  s.message,
        })),
      }, { status: current.status === 'passed' ? 200 : 422 })
    }
  }

  // timeout
  return Response.json({
    error:   'Timed out waiting for hardware',
    runId:   run.id,
    status:  'timeout',
    timeoutMs,
  }, { status: 408 })
}
