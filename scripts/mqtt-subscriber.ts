/**
 * Standalone MQTT → PostgreSQL bridge.
 * Run alongside `next dev` with: npm run subscriber
 *
 * Topics consumed:
 *   testbench/metrics        { runId?, temperature?, voltage?, currentMa?, gpioStates? }
 *   testbench/run/status     { runId, status, finishedAt?, firmwareVersion? }
 *   testbench/run/step       { runId, sequence, name, status, startedAt, finishedAt?, message? }
 *   testbench/heartbeat      { hardwareId, firmwareVersion?, timestamp }
 */

import mqtt from 'mqtt'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const pg = postgres(process.env.DATABASE_URL!)
const db = drizzle(pg, { schema })

// ── threshold cache — refreshed every 60s ──────────────────────────────────
type Threshold = typeof schema.thresholds.$inferSelect
let cachedThresholds: Threshold[] = []

async function refreshThresholds() {
  try {
    cachedThresholds = await db
      .select()
      .from(schema.thresholds)
      .where(eq(schema.thresholds.enabled, true))
    console.log(`[subscriber] loaded ${cachedThresholds.length} threshold(s)`)
  } catch (err) {
    console.error('[subscriber] failed to load thresholds:', err)
  }
}

async function checkThresholds(
  runId: string | null,
  readings: { voltage?: number | null; temperature?: number | null; currentMa?: number | null },
) {
  for (const t of cachedThresholds) {
    const val = readings[t.metric as keyof typeof readings]
    if (val === null || val === undefined) continue

    const triggered =
      (t.condition === 'lt' && val < t.value) ||
      (t.condition === 'gt' && val > t.value)

    if (!triggered) continue

    const direction = t.condition === 'lt' ? 'below' : 'above'
    await db.insert(schema.alerts).values({
      runId,
      level:   t.level,
      message: `${t.name}: ${t.metric} ${val.toFixed(3)} ${direction} threshold ${t.value}`,
    })
    console.warn(`[subscriber] ALERT (${t.level}): ${t.name}`)
  }
}

// ── MQTT ───────────────────────────────────────────────────────────────────
const client = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
  clientId: 'testbench-subscriber',
  clean: true,
  reconnectPeriod: 3000,
})

client.on('connect', () => {
  console.log('[subscriber] connected to MQTT broker')
  client.subscribe('testbench/#', (err) => {
    if (err) console.error('[subscriber] subscribe error', err)
    else      console.log('[subscriber] subscribed to testbench/#')
  })
})

client.on('error',   (err) => console.error('[subscriber] error', err.message))
client.on('offline', ()    => console.warn('[subscriber] offline — reconnecting…'))

client.on('message', async (topic, payload) => {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(payload.toString())
  } catch {
    console.warn('[subscriber] non-JSON on', topic)
    return
  }

  try {
    if (topic === 'testbench/metrics') {
      const voltage     = (msg.voltage     as number) ?? null
      const temperature = (msg.temperature as number) ?? null
      const currentMa   = (msg.currentMa   as number) ?? null
      const runId       = (msg.runId       as string) ?? null

      await db.insert(schema.metrics).values({
        runId, temperature, voltage, currentMa,
        gpioStates: (msg.gpioStates as Record<string, boolean>) ?? null,
      })
      await checkThresholds(runId, { voltage, temperature, currentMa })

    } else if (topic === 'testbench/run/status') {
      const { runId, status, finishedAt, firmwareVersion } = msg as {
        runId: string; status: string; finishedAt?: string; firmwareVersion?: string
      }
      const updates: Record<string, unknown> = { status }
      if (finishedAt)       updates.finishedAt       = new Date(finishedAt)
      if (firmwareVersion)  updates.firmwareVersion  = firmwareVersion
      await db.update(schema.testRuns).set(updates).where(eq(schema.testRuns.id, runId))
      console.log('[subscriber] run status →', status, runId)

    } else if (topic === 'testbench/run/step') {
      const { runId, sequence, name, status, startedAt, finishedAt, message } = msg as {
        runId: string; sequence: number; name: string; status: string
        startedAt: string; finishedAt?: string; message?: string
      }
      await db.insert(schema.testSteps).values({
        runId, sequence, name,
        status:     status as 'passed' | 'failed' | 'skipped',
        startedAt:  new Date(startedAt),
        finishedAt: finishedAt ? new Date(finishedAt) : null,
        message:    message ?? null,
      })
      console.log('[subscriber] step saved:', name, '→', status)

    } else if (topic === 'testbench/heartbeat') {
      const { hardwareId, firmwareVersion } = msg as { hardwareId?: string; firmwareVersion?: string }
      console.log('[subscriber] heartbeat from', hardwareId, firmwareVersion ? `fw:${firmwareVersion}` : '')
    }
  } catch (err) {
    console.error('[subscriber] DB error on', topic, err)
  }
})

// ── startup + refresh loop ─────────────────────────────────────────────────
await refreshThresholds()
setInterval(refreshThresholds, 60_000)

process.on('SIGINT', async () => {
  console.log('\n[subscriber] shutting down…')
  client.end()
  await pg.end()
  process.exit(0)
})
