#!/usr/bin/env python3
"""
Device UART ↔ MQTT bridge — hardware-agnostic.

Relays newline-terminated JSON frames between any UART-capable device under test
and the MQTT broker. The bridge knows nothing about the chip; it only forwards the
frame schema below, so the same script works for STM32, ESP32, AVR, RP2040, MSP430,
etc. Runs on any host with a serial port (a Raspberry Pi is the reference).

Reference wiring (MSP430FR2355 + Raspberry Pi):
  device TX (3.3V) → Pi GPIO 15 (RX, pin 10)
  device RX (3.3V) → Pi GPIO 14 (TX, pin 8)
  GND → GND
Adjust pins/levels for your board; use a level shifter if it is not 3.3V tolerant.

The device sends newline-terminated JSON frames over UART (default 9600 baud).

Outbound (device → MQTT):
  {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{...}}
  {"type":"run_start","runId":"<uuid>","hardwareId":"device-01"}
  {"type":"run_step","runId":"<uuid>","sequence":1,"name":"VDD check","status":"passed",...}
  {"type":"run_end","runId":"<uuid>","status":"passed","finishedAt":"..."}
  {"type":"heartbeat","hardwareId":"device-01"}

Inbound (MQTT → device):
  testbench/command/run  { runId, hardwareId? }  → triggers test sequence

Configurable via env: SERIAL_PORT, BAUD_RATE, MQTT_HOST, MQTT_PORT, HARDWARE_ID.

Install deps:
  pip3 install paho-mqtt pyserial
"""

import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
import serial

# ── config ─────────────────────────────────────────────────────────────────────
SERIAL_PORT  = os.environ.get("SERIAL_PORT",  "/dev/ttyS0")
BAUD_RATE    = int(os.environ.get("BAUD_RATE", "9600"))
BROKER_HOST  = os.environ.get("MQTT_HOST",    "192.168.1.100")  # dev machine IP
BROKER_PORT  = int(os.environ.get("MQTT_PORT", "1883"))
HARDWARE_ID  = os.environ.get("HARDWARE_ID",  "device-01")  # free-form label for this board

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bridge] %(message)s")
log = logging.getLogger(__name__)

# serial port ref shared between threads
_ser: serial.Serial | None = None

# ── UART send ───────────────────────────────────────────────────────────────────
def uart_send(frame: dict):
    if _ser and _ser.is_open:
        line = json.dumps(frame) + "\n"
        _ser.write(line.encode())
        log.info("→ device: %s", line.strip())
    else:
        log.warning("uart not ready — cannot send command")

# ── MQTT ────────────────────────────────────────────────────────────────────────
mqttc = mqtt.Client(client_id=f"pi-bridge-{HARDWARE_ID}", clean_session=True)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        log.info("MQTT connected to %s:%d", BROKER_HOST, BROKER_PORT)
        client.subscribe("testbench/command/#", qos=1)
    else:
        log.error("MQTT connect failed rc=%d", rc)

def on_disconnect(client, userdata, rc):
    if rc != 0:
        log.warning("MQTT unexpected disconnect rc=%d — will reconnect", rc)

def on_message(client, userdata, msg):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        log.warning("non-JSON on %s", topic)
        return

    if topic == "testbench/command/run":
        run_id     = payload.get("runId")
        hw_id      = payload.get("hardwareId", HARDWARE_ID)
        if not run_id:
            log.warning("command/run missing runId")
            return
        log.info("command: start run %s", run_id)
        uart_send({"type": "command_run", "runId": run_id, "hardwareId": hw_id})

mqttc.on_connect    = on_connect
mqttc.on_disconnect = on_disconnect
mqttc.on_message    = on_message
mqttc.connect_async(BROKER_HOST, BROKER_PORT, keepalive=60)
mqttc.loop_start()

# ── helpers ─────────────────────────────────────────────────────────────────────
def publish(topic: str, payload: dict):
    mqttc.publish(f"testbench/{topic}", json.dumps(payload), qos=1)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ── inbound frame handlers (device → MQTT) ─────────────────────────────────────
def handle(frame: dict):
    t = frame.get("type")

    if t == "metrics":
        publish("metrics", {
            "runId":       frame.get("runId"),
            "temperature": frame.get("temperature"),
            "voltage":     frame.get("voltage"),
            "currentMa":   frame.get("currentMa"),
            "gpioStates":  frame.get("gpio", {}),
        })

    elif t == "run_start":
        publish("run/status", {
            "runId":      frame["runId"],
            "status":     "running",
            "hardwareId": frame.get("hardwareId", HARDWARE_ID),
        })

    elif t == "run_step":
        publish("run/step", {
            "runId":      frame["runId"],
            "sequence":   frame["sequence"],
            "name":       frame["name"],
            "status":     frame["status"],
            "startedAt":  frame.get("startedAt", now_iso()),
            "finishedAt": frame.get("finishedAt"),
            "message":    frame.get("message"),
        })

    elif t == "run_end":
        publish("run/status", {
            "runId":           frame["runId"],
            "status":          frame.get("status", "passed"),
            "firmwareVersion": frame.get("firmwareVersion"),
            "finishedAt":      frame.get("finishedAt", now_iso()),
        })

    elif t == "heartbeat":
        publish("heartbeat", {
            "hardwareId": frame.get("hardwareId", HARDWARE_ID),
            "timestamp":  now_iso(),
        })

    else:
        log.warning("unknown frame type: %s", t)

# ── main loop ───────────────────────────────────────────────────────────────────
def main():
    global _ser
    log.info("opening %s at %d baud", SERIAL_PORT, BAUD_RATE)
    _ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=5)

    import threading
    def heartbeat_loop():
        while True:
            publish("heartbeat", {"hardwareId": HARDWARE_ID, "timestamp": now_iso()})
            time.sleep(30)

    threading.Thread(target=heartbeat_loop, daemon=True).start()

    def shutdown(sig, frame):
        log.info("shutting down")
        _ser.close()
        mqttc.loop_stop()
        mqttc.disconnect()
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info("bridge running — reading from %s", SERIAL_PORT)
    buf = b""

    while True:
        try:
            chunk = _ser.read(_ser.in_waiting or 1)
            if not chunk:
                continue
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    frame = json.loads(line)
                    handle(frame)
                except json.JSONDecodeError:
                    log.warning("bad JSON: %s", line[:80])
        except serial.SerialException as e:
            log.error("serial error: %s — retrying in 3s", e)
            time.sleep(3)
            try:
                _ser.close()
                _ser.open()
            except Exception:
                pass

if __name__ == "__main__":
    main()
