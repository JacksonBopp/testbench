# testbench

**Live:** currently down (Railway trial expired, redeploying soon) — [testbench.up.railway.app](https://testbench.up.railway.app)

Hardware-agnostic test automation platform. Streams live telemetry from any UART-capable device through a lightweight bridge host over MQTT to a Next.js dashboard with AI failure analysis.

Any microcontroller that speaks the simple [JSON-over-UART protocol](#hardware-support) drops in: STM32, ESP32, AVR, RP2040, MSP430, and more. The repo ships **four** reference firmwares (MSP430FR2355, ESP32, STM32F103C8, RP2040) proving that portability across both hobbyist and production-grade chip families, plus a pure-software simulator so you can run the whole pipeline end-to-end with no hardware at all.

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (TypeScript, App Router) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Realtime | MQTT (eclipse-mosquitto) |
| AI Analysis | IBM watsonx.ai (`ibm/granite-3-8b-instruct`) |
| AI Chat | IBM watsonx.ai (`ibm/granite-3-8b-instruct`, Edward assistant) |
| Hardware | Any UART device + a bridge host (references: Raspberry Pi Zero 2 W as bridge; MSP430FR2355, ESP32, STM32F103C8, RP2040 as devices) |
| Validation | Zod (MQTT frame schemas), Vitest (unit + cross-platform fixture tests) |

## Architecture

```
Device under test  (any MCU that emits JSON frames over UART)
  │  UART, newline-terminated JSON (default 9600 baud)
  ▼
Bridge host  ──  pi/bridge.py   (reference: Raspberry Pi Zero 2 W, but runs anywhere with a serial port)
  │  network → MQTT publish
  ▼
Mosquitto broker (Docker, port 1883)
  │
  ├─ scripts/mqtt-subscriber.ts  →  validated with src/lib/frames.ts (Zod)  →  PostgreSQL
  └─ /api/metrics/stream (SSE)  →  browser
```

`pi/replay.py` can sit in place of a live device on either side of the broker: `record` captures real `testbench/#` traffic to a file, `play` republishes it later with the original timing intact, for demos or regression checks without hardware.

## Quick start

### Prerequisites

- Docker Desktop
- Node.js 20+
- IBM watsonx.ai API key + project (Lite plan, free)

### 1. Environment

Create `.env.local`:

```
DATABASE_URL=postgres://testbench:testbench@localhost:5432/testbench
MQTT_URL=mqtt://localhost:1883
WATSONX_API_KEY=<your key>
WATSONX_PROJECT_ID=<your project id>
WATSONX_SERVICE_URL=https://us-south.ml.cloud.ibm.com

# Auth (required)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# OAuth (optional, leave blank to disable those providers)
GOOGLE_CLIENT_ID=<your google client id>
GOOGLE_CLIENT_SECRET=<your google client secret>
GITHUB_CLIENT_ID=<your github client id>
GITHUB_CLIENT_SECRET=<your github client secret>
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL on `5432` and Mosquitto on `1883`.

### 3. Migrate database

```bash
npm run db:migrate
```

### 4. Run the app

In two separate terminals:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: MQTT to DB bridge
npm run subscriber
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Lint, typecheck, unit tests

```bash
npm run lint
npm run typecheck
npm test
```

### 6. Stress test (optional, needs the full stack running)

```bash
npm run stress -- --devices 20 --duration 30
```

Runs `scripts/stress-test.ts`: N simulated devices publishing MQTT telemetry concurrently, plus concurrent HTTP load against the read APIs and real `/api/webhook/run` dispatches, reporting p50/p95/p99 latency and error counts across all three at once.

## Bridge setup

The bridge is any host with a serial port (a Raspberry Pi is the reference, but a laptop with a USB-UART adapter works too):

```bash
pip3 install paho-mqtt pyserial
```

Copy `pi/bridge.py` to the host, then point it at your device and broker:

```bash
MQTT_HOST=<broker-ip> SERIAL_PORT=/dev/ttyS0 BAUD_RATE=9600 HARDWARE_ID=device-01 python3 bridge.py
```

The bridge reads newline-terminated JSON frames from the device over UART and republishes them to the broker. It knows nothing about the chip, only the frame schema below.

## Hardware support

testbench is device-agnostic. The only contract between your hardware and the platform is a set of **newline-terminated JSON frames over UART**. Implement these and any microcontroller works:

| Frame (device → bridge) | Purpose |
|---|---|
| `{"type":"heartbeat","hardwareId":"...","firmwareVersion":"..."}` | Liveness + version |
| `{"type":"metrics","temperature":..,"voltage":..,"currentMa":..,"gpio":{...}}` | Live telemetry (all fields optional; `gpio` is free-form) |
| `{"type":"run_start","runId":"...","hardwareId":"...","firmwareVersion":"..."}` | Begin a test run |
| `{"type":"run_step","runId":"...","sequence":N,"name":"...","status":"passed\|failed","startedAt":"...","finishedAt":"...","message":...}` | One test step result |
| `{"type":"run_end","runId":"...","status":"passed\|failed","finishedAt":"..."}` | End a run |

| Frame (bridge → device) | Purpose |
|---|---|
| `{"type":"command_run","runId":"...","hardwareId":"..."}` | Trigger the on-device test sequence |

Notes:
- `hardwareId` is a free-form label you choose per board (e.g. `stm32-bench-01`, `esp32-lab`). It is not validated against any enum.
- Metrics lean toward `temperature` / `voltage` / `currentMa`, but each is optional and `gpio` is arbitrary JSON, so other signals can be mapped in or carried there.
- Don't have hardware yet? Use the simulator: `python3 pi/bridge-sim.py --scenario normal` (see below).

## Reference firmware

Four independent implementations of the same frame contract, deliberately spanning both hobbyist and industry-standard MCU families to prove the protocol-first design actually holds across chip vendors and toolchains — nothing in the bridge, backend, or dashboard changed between any of them:

- **[`firmware/main.c`](firmware/main.c) — MSP430FR2355 LaunchPad.** Bare-metal, direct register access. Open it in Code Composer Studio (or build with `msp430-elf-gcc`) and flash it. Emits 1 Hz JSON telemetry over UART (eUSCI_A1, P4.2 TX / P4.3 RX).
- **[`firmware/esp32/`](firmware/esp32/) — ESP32 (Arduino core, PlatformIO).** Emits the identical frames over its own hardware UART (Serial2, GPIO16/17). See [`firmware/esp32/README.md`](firmware/esp32/README.md) for wiring and build steps.
- **[`firmware/stm32/`](firmware/stm32/) — STM32F103C8 "Blue Pill" (STM32Cube HAL, PlatformIO).** STM32 is the closest thing to an industry-standard MCU family for real production embedded work (medical, automotive, industrial control), so this port is written against ST's own HAL the way a production firmware team actually would. See [`firmware/stm32/README.md`](firmware/stm32/README.md).
- **[`firmware/rp2040/`](firmware/rp2040/) — Raspberry Pi Pico (official pico-sdk, CMake).** Genuinely industry-adopted for cost-sensitive production hardware, and puts the same silicon vendor on both sides of the UART link, since the recommended bridge host is also a Raspberry Pi. See [`firmware/rp2040/README.md`](firmware/rp2040/README.md).

Each targets a different real toolchain on purpose (bare registers, Arduino, vendor HAL, vendor SDK) rather than reusing one framework everywhere — that's what actually tests the "protocol-first" claim instead of just restating it. Use any of them as a template when porting to a different MCU: only the chip-specific peripheral code (UART, ADC, GPIO) changes; the JSON frames stay identical. [`src/lib/frames.crossplatform.test.ts`](src/lib/frames.crossplatform.test.ts) asserts the backend's Zod schemas accept each platform's exact frame shapes, gpio key naming included.

## MQTT topics

| Topic | Direction | Payload |
|---|---|---|
| `testbench/metrics` | bridge → broker | `{ runId?, temperature, voltage, currentMa, gpioStates }` |
| `testbench/run/status` | bridge → broker | `{ runId, status, finishedAt? }` |
| `testbench/run/step` | bridge → broker | `{ runId, sequence, name, status, startedAt, ... }` |
| `testbench/heartbeat` | bridge → broker | `{ hardwareId, timestamp }` |

## API routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/test-runs` | List all runs |
| POST | `/api/test-runs` | Create a run |
| GET | `/api/test-runs/[id]` | Get a run |
| PATCH | `/api/test-runs/[id]` | Update run status |
| GET | `/api/test-runs/[id]/steps` | List steps |
| POST | `/api/test-runs/[id]/steps` | Add a step |
| GET | `/api/metrics` | Historical metrics |
| POST | `/api/metrics` | Insert a metric reading |
| GET | `/api/metrics/stream` | SSE stream (live MQTT feed) |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create an alert |
| PATCH | `/api/alerts/[id]` | Acknowledge an alert |
| POST | `/api/analysis` | Run watsonx analysis on a failed run |
| POST | `/api/chat` | Streaming chat with Edward (Gemini backend) |

## What I built

Everything in this repo — the Next.js dashboard, the API routes, the Drizzle schema, the MQTT bridge and simulator, the four reference firmwares (MSP430, ESP32, STM32, RP2040), the replay/stress-test tooling, and the CI workflow — is my own code, written and debugged by me. Nothing here is a scaffolded template or a generated app shell.

Dependencies I lean on rather than reinvent: Next.js/React for the app framework, Drizzle ORM for typed SQL, `mqtt.js` and `paho-mqtt` for the wire protocol, NextAuth for session/OAuth handling, and Eclipse Mosquitto as the broker. The two AI integrations — IBM watsonx.ai (Granite 3.8B) for post-run failure analysis, and Gemini for Edward's chat — are third-party model APIs I call with system context I built (test run history, telemetry, thresholds); I didn't write the models, but I designed what context they see and how their output is used.

Edward himself started as a desktop assistant I built for an IBM hackathon and was reworked here into a browser-based chat panel, reusing the assistant persona but not the original UI code.

## Engineering tradeoffs

- **Protocol-first hardware abstraction.** Instead of writing a driver per microcontroller, the entire hardware contract is a small set of newline-terminated JSON frames over UART (see [Hardware support](#hardware-support)). This means adding a new chip is a firmware-only change — nothing in the bridge, backend, or dashboard needs to know what MCU it's talking to. The cost is that malformed or partial frames are only detectable at the JSON-parse boundary, so the bridge has to treat every line as untrusted input.
- **Long-polling over WebSockets for run dispatch.** `/api/webhook/run` publishes a command over MQTT and then long-polls the database for a terminal run status, rather than pushing over a socket. It's simpler to trigger from CI with a single `curl`, at the cost of holding an HTTP connection open for up to 5 minutes per run.
- **Simulator as a first-class citizen, not an afterthought.** `pi/bridge-sim.py` speaks the exact same MQTT contract as the real Raspberry Pi bridge, so the dashboard, database, and CI can't tell the difference between simulated and real hardware. That's what makes the platform demoable without a MSP430 on hand. The simulator's payload shapes and the subscriber's Zod schemas (`src/lib/frames.ts`) are still two hand-maintained sources of truth rather than one generated one — see roadmap.
- **Global MQTT client reuse in dev, fresh per boot in prod.** `src/lib/mqtt.ts` caches the client on `globalThis` outside production to survive Next.js dev-mode hot reloads without leaking connections, but skips that cache in production where the process lifecycle is stable.
- **AI as a bolt-on analysis layer, not the core loop.** Failure analysis and chat both read from the same run/metrics/threshold tables the rest of the app already populates. If the watsonx or Gemini calls fail or are unconfigured, test runs, telemetry, and alerting keep working — the AI layer is additive, not load-bearing.
- **Validate at the boundary, trust everywhere after.** `scripts/mqtt-subscriber.ts` runs every inbound MQTT payload through a Zod schema before it touches the database; a malformed frame from a misbehaving device gets logged and dropped instead of corrupting a row or crashing the process. Nothing downstream of that boundary re-validates the same data.
- **Capture-and-replay over hand-written fixtures.** `pi/replay.py` records real MQTT sessions instead of me writing synthetic ones by hand, so a demo or regression case is exactly what a device actually said, timing included — at the cost of needing a live run to capture from at least once.
- **The bridge owns wall-clock time; devices don't.** Every reference firmware reports `startedAt`/`finishedAt` as its own uptime (`"t+15000ms"`), since an MCU has no real-time clock worth trusting. `pi/bridge.py` stamps these fields with its own `now_iso()` on the way into MQTT rather than forwarding the device's value — a real bug I found and fixed while adding the STM32/RP2040 ports and testing against actual firmware output instead of only the simulator, which had always emitted proper timestamps and so never exposed it.

## Testing and reliability

Three layers, each catching a different class of bug:

1. **Unit tests (Vitest)** — `src/lib/frames.test.ts` and `src/lib/thresholds.test.ts` cover MQTT frame validation and alert-threshold evaluation in isolation: malformed payloads, boundary values, missing fields. `src/lib/frames.crossplatform.test.ts` additionally proves all four reference firmwares' exact frame shapes (including each platform's own gpio key naming) pass the same validation the backend runs in production. Pure functions, no database or broker required. Run with `npm test`.
2. **Lint + typecheck** — `npm run lint` (ESLint, including React's render-purity rules) and `npm run typecheck` (`tsc --noEmit`) run on every push via the `lint-and-test` CI job, before anything spends time on containers.
3. **End-to-end integration test** — an actual simulated hardware run on every push/PR touching `firmware/`, `pi/`, `scripts/`, or `src/` ([`.github/workflows/hardware-validation.yml`](.github/workflows/hardware-validation.yml)):
   1. Spins up real Postgres and Mosquitto containers.
   2. Boots the actual Next.js app and MQTT subscriber against them.
   3. Starts `pi/bridge-sim.py` in listen mode as a stand-in device.
   4. Hits `/api/webhook/run` exactly the way a real CI trigger would, and asserts every step reports `passed` before the timeout.
   5. On failure, dumps subscriber/simulator/Next.js logs as build artifacts so a failure is debuggable from the Actions tab alone.

A second job in the same workflow runs the identical flow against real hardware when a `TESTBENCH_URL` secret is configured, and no-ops otherwise. That's the main reliability property I care about here: the same test asserts identical behavior whether the device under test is a Pi + MSP430 on my desk or a Python process in a GitHub-hosted runner.

For load rather than correctness, `scripts/stress-test.ts` (`npm run stress`) runs N simulated devices publishing concurrently alongside concurrent API traffic and real webhook-triggered runs, and reports latency percentiles — useful for catching regressions in the subscriber or API layer under concurrent load before they show up as a slow dashboard in production.

## Future roadmap

- A shared, versioned schema generator so `pi/bridge-sim.py`, `pi/bridge.py`, the four firmwares' frame comments, and `src/lib/frames.ts` derive from one source of truth instead of several hand-kept ones — the cross-platform fixture tests catch drift today, but don't prevent it.
- API route test coverage (currently only the frame-validation and threshold layers are unit tested).
- A WiFi-direct ESP32 variant that publishes straight to MQTT, as a second topology alongside the UART-bridge one.
- Recorded demo video walking through a live run end to end.
- Baseline numbers from `npm run stress` captured in this README once I have a deployed environment to run it against safely.

## Edward: AI Chat Assistant

A floating chat panel (bottom-right corner of the dashboard) powered by **IBM watsonx.ai (Granite 3.8B)**. Edward is a dry-witted hardware QA assistant with context about the testbench platform. Ask him about failing steps, unusual metrics, UART wiring, firmware behavior, or anything embedded-systems related.

Edward was originally built as a desktop AI assistant for the IBM Bob hackathon and has been adapted here as a browser-based troubleshooting assistant.

Edward uses the same IBM watsonx.ai credentials as the analysis feature. No extra setup needed beyond the existing `WATSONX_*` env vars. Both Edward (live chat) and the post-run analysis reports run on `ibm/granite-3-8b-instruct`.
