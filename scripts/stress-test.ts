/**
 * Concurrent-load stress test for the full testbench pipeline: N simulated devices
 * publishing MQTT telemetry at once, plus concurrent HTTP load against the
 * dashboard's API routes (including real test-run dispatch through the webhook).
 * This exercises the MQTT broker, the subscriber's DB writes, the threshold/alert
 * path, and the API layer together — not any one piece in isolation.
 *
 * Requires the full stack running (docker compose up -d, npm run db:migrate,
 * npm run dev, npm run subscriber) before use.
 *
 * Usage:
 *   npm run stress -- --devices 20 --duration 30 --base-url http://localhost:3000
 *
 * Flags:
 *   --devices     number of simulated concurrent devices (default 10)
 *   --duration    seconds to run (default 30)
 *   --base-url    dashboard base URL (default http://localhost:3000)
 *   --mqtt-url    broker URL (default mqtt://localhost:1883)
 *   --runs        number of concurrent /api/webhook/run dispatches (default 3)
 *   --reads-only  skip MQTT device simulation and webhook run dispatch — only
 *                 exercises GET endpoints. Safe to point at a live/production
 *                 deployment since it has no side effects (no fake telemetry,
 *                 no fake test runs written to the database).
 */

import mqtt from 'mqtt'

type Args = {
  devices: number
  duration: number
  baseUrl: string
  mqttUrl: string
  runs: number
  readsOnly: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string, fallback: string) => {
    const i = argv.indexOf(flag)
    return i === -1 ? fallback : argv[i + 1]
  }
  return {
    devices: Number(get('--devices', '10')),
    duration: Number(get('--duration', '30')),
    readsOnly: argv.includes('--reads-only'),
    baseUrl: get('--base-url', 'http://localhost:3000'),
    mqttUrl: get('--mqtt-url', 'mqtt://localhost:1883'),
    runs: Number(get('--runs', '3')),
  }
}

type Latencies = number[]

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function summarize(label: string, latencies: Latencies, errors: number) {
  const sorted = [...latencies].sort((a, b) => a - b)
  console.log(
    `\n[${label}] n=${latencies.length} errors=${errors} ` +
    `p50=${percentile(sorted, 50).toFixed(0)}ms p95=${percentile(sorted, 95).toFixed(0)}ms ` +
    `p99=${percentile(sorted, 99).toFixed(0)}ms max=${(sorted.at(-1) ?? 0).toFixed(0)}ms`,
  )
}

/** Simulates `devices` concurrent boards publishing heartbeat + metrics at ~1Hz. */
function runDeviceLoad(args: Args, stopAt: number): Promise<{ published: number; errors: number }> {
  return new Promise((resolve) => {
    const client = mqtt.connect(args.mqttUrl, { clientId: `stress-devices-${Date.now()}` })
    let published = 0
    let errors = 0

    client.on('connect', () => {
      const timers: NodeJS.Timeout[] = []
      for (let d = 0; d < args.devices; d++) {
        const jitter = Math.random() * 500
        const timer = setInterval(() => {
          if (Date.now() >= stopAt) return
          const payload = JSON.stringify({
            temperature: 20 + Math.random() * 10,
            voltage: 3.2 + Math.random() * 0.2,
            currentMa: 10 + Math.random() * 5,
            gpioStates: { sim: Math.random() > 0.5 },
          })
          client.publish('testbench/metrics', payload, { qos: 0 }, (err) => {
            if (err) errors++
            else published++
          })
        }, 1000 + jitter)
        timers.push(timer)
      }

      const check = setInterval(() => {
        if (Date.now() >= stopAt) {
          clearInterval(check)
          timers.forEach(clearInterval)
          client.end(true, {}, () => resolve({ published, errors }))
        }
      }, 250)
    })

    client.on('error', () => errors++)
  })
}

/** Hammers read endpoints with `args.devices` concurrent workers, as a stand-in for many dashboard viewers. */
async function runApiReadLoad(args: Args, stopAt: number): Promise<{ latencies: Latencies; errors: number }> {
  const endpoints = ['/api/test-runs', '/api/metrics', '/api/alerts']
  const latencies: Latencies = []
  let errors = 0

  const worker = async () => {
    while (Date.now() < stopAt) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
      const started = performance.now()
      try {
        const res = await fetch(`${args.baseUrl}${endpoint}`)
        await res.arrayBuffer()
        if (!res.ok) errors++
        latencies.push(performance.now() - started)
      } catch {
        errors++
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, args.devices) }, () => worker()))
  return { latencies, errors }
}

/** Dispatches concurrent real test runs through the same webhook CI uses. */
async function runWebhookLoad(args: Args): Promise<{ latencies: Latencies; errors: number }> {
  const latencies: Latencies = []
  let errors = 0

  await Promise.all(
    Array.from({ length: args.runs }, async (_, i) => {
      const started = performance.now()
      try {
        const res = await fetch(`${args.baseUrl}/api/webhook/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hardwareId: `stress-run-${i}`,
            firmwareVersion: 'stress-test',
            notes: 'stress-test dispatch',
            timeout: 20_000,
          }),
        })
        await res.json()
        if (!res.ok) errors++
      } catch {
        errors++
      }
      latencies.push(performance.now() - started)
    }),
  )

  return { latencies, errors }
}

async function main() {
  const args = parseArgs()

  if (args.readsOnly) {
    console.log(
      `[stress] reads-only: ${args.devices} concurrent workers for ${args.duration}s against ${args.baseUrl}`,
    )
    const stopAt = Date.now() + args.duration * 1000
    const reads = await runApiReadLoad(args, stopAt)
    summarize('api reads', reads.latencies, reads.errors)
    return
  }

  console.log(
    `[stress] ${args.devices} simulated devices, ${args.runs} concurrent runs, ` +
    `${args.duration}s against ${args.baseUrl} / ${args.mqttUrl}`,
  )

  const stopAt = Date.now() + args.duration * 1000

  const [deviceResult, reads, webhookResult] = await Promise.all([
    runDeviceLoad(args, stopAt),
    runApiReadLoad(args, stopAt),
    runWebhookLoad(args),
  ])

  console.log(`\n[mqtt] published=${deviceResult.published} errors=${deviceResult.errors}`)
  summarize('api reads', reads.latencies, reads.errors)
  summarize('webhook dispatch', webhookResult.latencies, webhookResult.errors)
}

main().catch((err) => {
  console.error('[stress] fatal:', err)
  process.exit(1)
})
