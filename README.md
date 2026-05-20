# testbench

A hardware test automation platform that runs automated test sequences on connected devices, collects real-time metrics, and uses IBM watsonx AI to analyze failures and surface root causes.

## Overview

testbench connects a physical device (Raspberry Pi or similar microcontroller) to a web dashboard. From the dashboard you can trigger test sequences, monitor live hardware metrics, view pass/fail history, and get AI-powered failure analysis via IBM watsonx.

## Stack

- **Frontend/Backend** — Next.js (TypeScript)
- **Database** — PostgreSQL
- **Realtime** — MQTT
- **AI** — IBM watsonx.ai
- **Hardware** — Raspberry Pi / MicroPython

## Features

- Trigger automated test sequences from the web UI
- Real-time hardware metric collection (temperature, voltage, GPIO states)
- Pass/fail logging with history and trend graphs
- IBM watsonx integration for failure log analysis and root cause summaries
- Alert notifications on test failures

## Getting Started

> Setup instructions coming soon.

## Hardware

Tested with a Raspberry Pi running MicroPython. Additional sensor support (INA219, BME280) planned.
