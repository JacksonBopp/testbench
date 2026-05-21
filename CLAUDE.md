@AGENTS.md

# testbench

Hardware QA platform for validating embedded firmware. An MSP430FR2355 LaunchPad sends JSON telemetry over UART to a Raspberry Pi Zero 2 W, which bridges to a Next.js dashboard via MQTT.

## Stack

- **Next.js 16** (App Router) — dashboard UI + API routes
- **Drizzle ORM + postgres.js** — schema-first, migrations in `src/db/migrations/`
- **eclipse-mosquitto** — MQTT broker (Docker, port 1883)
- **PostgreSQL 16** — database (Docker, port 5432)
- **IBM watsonx.ai** — AI root cause analysis (`ibm/granite-3-8b-instruct`)
- **Tailwind CSS + lucide-react** — styling and icons

## Architecture

```
MSP430 firmware (C)
  → UART
    → Pi bridge (Python / pi/bridge.py)
      → MQTT topics (testbench/#)
        → mqtt-subscriber (scripts/mqtt-subscriber.ts) → Postgres
        → SSE stream (/api/metrics/stream) → browser
```

The Next.js app has two long-running processes:
1. `npm run dev` — the web server (Vercel in prod)
2. `npm run subscriber` — the MQTT→DB bridge (must run separately; cannot deploy to Vercel)

## Running locally

```bash
docker compose up -d          # Postgres + Mosquitto
npm run db:migrate            # apply migrations
npm run dev                   # Next.js on :3000
npm run subscriber            # MQTT subscriber (separate terminal)
node pi/bridge-sim.py --listen --scenario normal  # fake hardware
```

## Key files

| Path | Purpose |
|---|---|
| `src/db/schema.ts` | All tables and enums — source of truth for DB shape |
| `src/lib/mqtt.ts` | Singleton MQTT client (HMR-safe global var) |
| `src/lib/watsonx.ts` | IBM watsonx.ai client + `analyzeTestRun()` |
| `scripts/mqtt-subscriber.ts` | MQTT→DB bridge with threshold alerting |
| `pi/bridge.py` | Real Pi UART↔MQTT bridge |
| `pi/bridge-sim.py` | Hardware simulator for dev without physical hardware |
| `firmware/main.c` | MSP430FR2355 C firmware |

## Design system

All dashboard pages use a consistent visual language:
- Outer wrapper: `p-8 max-w-6xl mx-auto`
- Cards: `rounded-xl border border-zinc-200 bg-white shadow-sm`
- Headings: `text-2xl font-bold text-zinc-900 tracking-tight`
- Table headers: `text-xs font-semibold text-zinc-400 uppercase tracking-wider`
- Status indicators: always use `src/components/ui/status-badge.tsx`
- Icons: lucide-react throughout

## MQTT topics

| Topic | Direction | Payload |
|---|---|---|
| `testbench/metrics` | hardware → app | `{temperature, voltage, currentMa, gpioStates}` |
| `testbench/run/status` | hardware → app | `{runId, status, firmwareVersion, hardwareId}` |
| `testbench/run/step` | hardware → app | `{runId, sequence, name, status, message}` |
| `testbench/heartbeat` | hardware → app | `{hardwareId, firmwareVersion, ts}` |
| `testbench/command/run` | app → hardware | `{runId, firmwareVersion}` |

## Environment variables (.env.local — never commit)

```
DATABASE_URL=postgres://testbench:testbench@localhost:5432/testbench
MQTT_URL=mqtt://localhost:1883
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=7cdfd041-213b-4cb2-a8db-c197d271718c
WATSONX_SERVICE_URL=https://us-south.ml.cloud.ibm.com
```

## Hardware (not yet arrived)

When the real hardware arrives:
- Replace `pi/bridge-sim.py` with `pi/bridge.py` on the Pi
- Flash `firmware/main.c` to the MSP430FR2355 (eUSCI_A1 UART, P4.2 TX / P4.3 RX, 9600 baud)
- Set `TESTBENCH_URL` GitHub secret and uncomment push/PR triggers in `.github/workflows/hardware-validation.yml`
