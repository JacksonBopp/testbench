# testbench

Hardware-agnostic test automation platform. Streams live telemetry from any UART-capable device — through a lightweight bridge host over MQTT — to a Next.js dashboard with AI failure analysis.

Any microcontroller that speaks the simple [JSON-over-UART protocol](#hardware-support) drops in: STM32, ESP32, AVR, RP2040, MSP430, and more. The repo ships a reference MSP430FR2355 firmware and a pure-software simulator so you can run the whole pipeline end-to-end with no hardware at all.

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (TypeScript, App Router) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Realtime | MQTT (eclipse-mosquitto) |
| AI — Analysis | IBM watsonx.ai — `ibm/granite-3-8b-instruct` |
| AI — Chat | IBM watsonx.ai — `ibm/granite-3-8b-instruct` (Edward assistant) |
| Hardware | Any UART device + a bridge host (reference: Raspberry Pi Zero 2 W + MSP430FR2355) |

## Architecture

```
Device under test  (any MCU — emits JSON frames over UART)
  │  UART, newline-terminated JSON (default 9600 baud)
  ▼
Bridge host  ──  pi/bridge.py   (reference: Raspberry Pi Zero 2 W; runs anywhere with a serial port)
  │  network → MQTT publish
  ▼
Mosquitto broker (Docker, port 1883)
  │
  ├─ scripts/mqtt-subscriber.ts  →  PostgreSQL
  └─ /api/metrics/stream (SSE)  →  browser
```

## Quick start

### Prerequisites

- Docker Desktop
- Node.js 20+
- IBM watsonx.ai API key + project (Lite plan — free)

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

# OAuth (optional — leave blank to disable those providers)
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
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — MQTT → DB bridge
npm run subscriber
```

Open [http://localhost:3000](http://localhost:3000).

## Bridge setup

The bridge is any host with a serial port (a Raspberry Pi is the reference, but a laptop with a USB-UART adapter works too):

```bash
pip3 install paho-mqtt pyserial
```

Copy `pi/bridge.py` to the host, then point it at your device and broker:

```bash
MQTT_HOST=<broker-ip> SERIAL_PORT=/dev/ttyS0 BAUD_RATE=9600 HARDWARE_ID=device-01 python3 bridge.py
```

The bridge reads newline-terminated JSON frames from the device over UART and republishes them to the broker. It knows nothing about the chip — only the frame schema below.

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

## Reference firmware (MSP430FR2355)

`firmware/main.c` is a complete, working example for the MSP430FR2355 LaunchPad. Open it in Code Composer Studio (or build with `msp430-elf-gcc`) and flash it. It emits 1 Hz JSON telemetry over UART (eUSCI_A1 — P4.2 TX, P4.3 RX) and implements the frame contract above. Use it as a template when porting to a different MCU — only the chip-specific peripheral code (UART, ADC, GPIO) changes; the JSON frames stay identical.

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

## Edward — AI Chat Assistant

A floating chat panel (bottom-right corner of the dashboard) powered by **IBM watsonx.ai (Granite 3.8B)**. Edward is a dry-witted hardware QA assistant with context about the testbench platform. Ask him about failing steps, unusual metrics, UART wiring, firmware behavior, or anything embedded-systems related.

Edward was originally built as a desktop AI assistant for the IBM Bob hackathon and has been adapted here as a browser-based troubleshooting assistant.

Edward uses the same IBM watsonx.ai credentials as the analysis feature — no extra setup needed beyond the existing `WATSONX_*` env vars. Both Edward (live chat) and the post-run analysis reports run on `ibm/granite-3-8b-instruct`.
