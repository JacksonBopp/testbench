/**
 * Standalone MQTT → PostgreSQL bridge.
 * Run alongside `next dev` with: npx tsx --env-file=.env.local scripts/mqtt-subscriber.ts
 *
 * Topics consumed:
 *   testbench/metrics        { runId?, temperature?, voltage?, currentMa?, gpioStates? }
 *   testbench/run/status     { runId, status, finishedAt? }
 *   testbench/run/step       { runId, sequence, name, status, startedAt, finishedAt?, message? }
 *   testbench/heartbeat      { hardwareId, timestamp }  (logged only)
 */

import mqtt from 'mqtt'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const pg = postgres(process.env.DATABASE_URL!)
const db = drizzle(pg, { schema })

const client = mqtt.connect(process.env.MQTT_URL ?? 'mqtt://localhost:1883', {
  clientId: 'testbench-subscriber',
  clean: true,
  reconnectPeriod: 3000,
})

client.on('connect', () => {
  console.log('[subscriber] connected to MQTT broker')
  client.subscribe('testbench/#', (err) => {
    if (err) console.error('[subscriber] subscribe error', err)
    else console.log('[subscriber] subscribed to testbench/#')
  })
})

client.on('error', (err) => console.error('[subscriber] error', err.message))
client.on('offline', () => console.warn('[subscriber] offline — reconnecting…'))

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

      await db.insert(schema.metrics).values({
        runId: (msg.runId as string) ?? null,
        temperature,
        voltage,
        currentMa,
        gpioStates: (msg.gpioStates as Record<string, boolean>) ?? null,
      })
      console.log('[subscriber] metrics saved')

      /* threshold alerts */
      const runId = (msg.runId as string) ?? null
      if (voltage !== null && voltage < 3.0) {
        await db.insert(schema.alerts).values({
          runId,
          level: 'error',
          message: `Voltage low: ${voltage.toFixed(3)}V (threshold 3.0V)`,
        })
        console.warn('[subscriber] ALERT: voltage low', voltage)
      }
      if (temperature !== null && temperature > 70) {
        await db.insert(schema.alerts).values({
          runId,
          level: 'warning',
          message: `Temperature high: ${temperature.toFixed(1)}°C (threshold 70°C)`,
        })
        console.warn('[subscriber] ALERT: temperature high', temperature)
      }

    } else if (topic === 'testbench/run/status') {
      const { runId, status, finishedAt } = msg as {
        runId: string; status: string; finishedAt?: string
      }
      const updates: Record<string, unknown> = { status }
      if (finishedAt) updates.finishedAt = new Date(finishedAt)
      await db.update(schema.testRuns).set(updates).where(eq(schema.testRuns.id, runId))
      console.log('[subscriber] run status →', status, runId)

    } else if (topic === 'testbench/run/step') {
      const { runId, sequence, name, status, startedAt, finishedAt, message } = msg as {
        runId: string; sequence: number; name: string; status: string
        startedAt: string; finishedAt?: string; message?: string
      }
      await db.insert(schema.testSteps).values({
        runId,
        sequence,
        name,
        status: status as 'passed' | 'failed' | 'skipped',
        startedAt:  new Date(startedAt),
        finishedAt: finishedAt ? new Date(finishedAt) : null,
        message:    message ?? null,
      })
      console.log('[subscriber] step saved:', name, '→', status)

    } else if (topic === 'testbench/heartbeat') {
      console.log('[subscriber] heartbeat from', msg.hardwareId, 'at', msg.timestamp)
    }
  } catch (err) {
    console.error('[subscriber] DB error on', topic, err)
  }
})

process.on('SIGINT', async () => {
  console.log('\n[subscriber] shutting down…')
  client.end()
  await pg.end()
  process.exit(0)
})
