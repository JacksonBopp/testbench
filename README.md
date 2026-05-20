# Hardware Test Automation Platform

## Project Goal
A portfolio project targeting IBM Austin hardware testing roles. The project demonstrates hardware interfacing, test automation, real-time data collection, and AI-powered failure analysis — skills directly relevant to IBM's hardware validation and verification teams.

## Concept
A web-based test automation platform that:
1. Runs automated test sequences on connected hardware
2. Collects real-time metrics (temperature, voltage, GPIO states)
3. Logs pass/fail results with timestamps to a database
4. Displays a live dashboard with test history, trends, and analytics
5. Uses IBM watsonx AI to analyze failures and surface likely root causes in plain English

## Why This Impresses IBM Hardware Testing
- Mirrors what hardware test engineers do daily (automate tests, collect data, analyze failures)
- Uses IBM's own AI platform (watsonx) — signals familiarity with their stack before day one
- Combines real physical hardware with software tooling
- Shows understanding of the domain, not just generic web dev skills

## Target Role
IBM Austin — Hardware Testing / Hardware Validation & Verification

---

## Stack

### Web App
- **Framework:** Next.js (React frontend + API routes)
- **Language:** TypeScript
- **Database:** PostgreSQL or SQLite (test result logs)
- **Realtime:** MQTT or WebSockets for live hardware data

### Hardware (TBD — confirm device at home)
- **Controller:** Raspberry Pi or similar microcontroller
- **Language:** MicroPython or Python
- **Sensors:** Temperature, voltage/current (INA219), GPIO — TBD based on hardware available
- **Communication:** WiFi → MQTT broker or HTTP to backend

### AI
- **IBM watsonx.ai API** — analyzes test failure logs and generates root cause summaries

### Dev Tools (how the project is built)
- **Cursor** — primary code editor with AI assistance
- **Claude Code** — architecture, complex reasoning, code review
- **GitHub Copilot / Codex** — boilerplate and code generation

---

## Core Features

### MVP
- [ ] Hardware connects to WiFi and sends metrics to backend
- [ ] Backend logs test runs with pass/fail status to database
- [ ] Dashboard shows live metrics and test run history
- [ ] Trigger test sequences from the web UI

### V2
- [ ] watsonx integration: paste or auto-submit failure logs, receive AI analysis
- [ ] Trend graphs (pass rate over time, failure patterns)
- [ ] Email/notification alerts on test failures

### Stretch
- [ ] Multiple device support (test multiple hardware units simultaneously)
- [ ] Export test reports as PDF

---

## Hardware Setup (TBD)
Confirm which device you have:
- Raspberry Pi Pico 2 W (mentioned — uses MicroPython, WiFi built-in)
- Other Pi model (runs full Python, more capable)

Potential additions worth buying (~$10-20 total):
- **INA219** voltage/current sensor — very relevant to hardware testing
- **BME280** temp/humidity/pressure sensor
- **Second microcontroller** (ESP32 or Arduino) to act as the "device under test"

---

## Background / Context
- Developer background: Web / JS / TS, some Python library experience, limited hardware experience
- Hardware experience: Limited — MicroPython and GPIO will be new territory
- watsonx API token usage: scope AI calls to on-demand user actions only (not automatic) to keep costs low
