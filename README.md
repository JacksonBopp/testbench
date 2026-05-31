# testbench

Hardware test automation platform for the MSP430FR2355 LaunchPad. Streams live telemetry via a Raspberry Pi Zero 2 W over MQTT to a Next.js dashboard with AI failure analysis.

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (TypeScript, App Router) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Realtime | MQTT (eclipse-mosquitto) |
| AI — Analysis | IBM watsonx.ai — `ibm/granite-3-8b-instruct` |
| AI — Chat | IBM watsonx.ai — `ibm/granite-3-8b-instruct` (Edward assistant) |
| Hardware | Raspberry Pi Zero 2 W (Python 3) + MSP430FR2355 (C) |

## Architecture

```
MSP430FR2355
  │  UART 9600 baud (P4.2 TX / P4.3 RX)
  ▼
Raspberry Pi Zero 2 W  ──  pi/bridge.py
  │  WiFi → MQTT publish
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

## Pi setup

On the Raspberry Pi Zero 2 W:

```bash
pip3 install paho-mqtt pyserial
```

Copy `pi/bridge.py` to the Pi, then:

```bash
MQTT_HOST=<dev-machine-ip> python3 bridge.py
```

The bridge reads JSON frames from the MSP430 over UART (`/dev/ttyS0`) and publishes them to the broker.

## Firmware

Open `firmware/main.c` in Code Composer Studio (or build with `msp430-elf-gcc`). Flash to the MSP430FR2355 LaunchPad. The firmware emits 1 Hz JSON telemetry frames over UART (eUSCI_A1 — P4.2 TX, P4.3 RX).

## MQTT topics

| Topic | Direction | Payload |
|---|---|---|
| `testbench/metrics` | Pi → broker | `{ runId?, temperature, voltage, currentMa, gpioStates }` |
| `testbench/run/status` | Pi → broker | `{ runId, status, finishedAt? }` |
| `testbench/run/step` | Pi → broker | `{ runId, sequence, name, status, startedAt, ... }` |
| `testbench/heartbeat` | Pi → broker | `{ hardwareId, timestamp }` |

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
