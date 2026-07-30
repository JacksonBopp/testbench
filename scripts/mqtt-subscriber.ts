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
import { isKnownTopic, parseFrame, type MetricsPayload, type RunStatusPayload, type RunStepPayload } from '../src/lib/frames'
import { evaluateThresholds, type ThresholdRule } from '../src/lib/thresholds'

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
  const rules: ThresholdRule[] = cachedThresholds
  const breaches = evaluateThresholds(rules, readings)

  for (const breach of breaches) {
    await db.insert(schema.alerts).values({
      runId,
      level:   breach.rule.level,
      message: breach.message,
    })
    console.warn(`[subscriber] ALERT (${breach.rule.level}): ${breach.rule.name}`)
  }
}

// ── MQTT ───────────────────────────────────────────────────────────────────
const client = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
  clientId: 'testbench-subscriber',
  clean: true,
  reconnectPeriod: 3000,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
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
  let raw: unknown
  try {
    raw = JSON.parse(payload.toString())
  } catch {
    console.warn('[subscriber] non-JSON on', topic)
    return
  }

  if (!isKnownTopic(topic)) {
    console.warn('[subscriber] unrecognized topic', topic)
    return
  }

  const parsed = parseFrame(topic, raw)
  if (!parsed.ok) {
    console.warn(`[subscriber] rejected malformed frame on ${topic}: ${parsed.error}`)
    return
  }

  try {
    if (topic === 'testbench/metrics') {
      const { voltage = null, temperature = null, currentMa = null, runId = null, gpioStates = null } =
        parsed.data as MetricsPayload

      await db.insert(schema.metrics).values({
        runId, temperature, voltage, currentMa,
        gpioStates,
      })
      await checkThresholds(runId, { voltage, temperature, currentMa })

    } else if (topic === 'testbench/run/status') {
      const { runId, status, finishedAt, firmwareVersion } = parsed.data as RunStatusPayload
      const updates: Record<string, unknown> = { status }
      if (finishedAt)       updates.finishedAt       = new Date(finishedAt)
      if (firmwareVersion)  updates.firmwareVersion  = firmwareVersion
      await db.update(schema.testRuns).set(updates).where(eq(schema.testRuns.id, runId))
      console.log('[subscriber] run status →', status, runId)

    } else if (topic === 'testbench/run/step') {
      const { runId, sequence, name, status, startedAt, finishedAt, message } = parsed.data as RunStepPayload
      await db.insert(schema.testSteps).values({
        runId, sequence, name, status,
        startedAt:  new Date(startedAt),
        finishedAt: finishedAt ? new Date(finishedAt) : null,
        message:    message ?? null,
      })
      console.log('[subscriber] step saved:', name, '→', status)

    } else if (topic === 'testbench/heartbeat') {
      const { hardwareId, firmwareVersion } = parsed.data as { hardwareId?: string; firmwareVersion?: string }
      console.log('[subscriber] heartbeat from', hardwareId, firmwareVersion ? `fw:${firmwareVersion}` : '')
    }
  } catch (err) {
    console.error('[subscriber] DB error on', topic, err)
  }
})

// ── startup + refresh loop ─────────────────────────────────────────────────
void (async () => {
  await refreshThresholds()
  setInterval(refreshThresholds, 60_000)

  process.on('SIGINT', async () => {
    console.log('\n[subscriber] shutting down…')
    client.end()
    await pg.end()
    process.exit(0)
  })
})()
