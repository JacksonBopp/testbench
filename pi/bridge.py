#!/usr/bin/env python3
"""
Pi Zero 2 W — MSP430FR2355 UART → MQTT bridge.

Wiring:
  MSP430 P4.2 (TX, 3.3V) → Pi GPIO 15 (RX, pin 10)
  MSP430 P4.3 (RX, 3.3V) → Pi GPIO 14 (TX, pin 8)
  GND → GND

MSP430 sends newline-terminated JSON frames over UART at 9600 baud.

Frame types:
  {"type":"metrics","temperature":25.1,"voltage":3.28,"currentMa":12.4,"gpio":{"P1.0":true,"P1.1":false}}
  {"type":"run_start","runId":"<uuid>","hardwareId":"msp430-01"}
  {"type":"run_step","runId":"<uuid>","sequence":1,"name":"VDD check","status":"passed","startedAt":"...","finishedAt":"...","message":null}
  {"type":"run_end","runId":"<uuid>","status":"passed","finishedAt":"..."}
  {"type":"heartbeat","hardwareId":"msp430-01"}

Install deps on Pi:
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
HARDWARE_ID  = os.environ.get("HARDWARE_ID",  "msp430-01")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bridge] %(message)s")
log = logging.getLogger(__name__)

# ── MQTT ────────────────────────────────────────────────────────────────────────
mqttc = mqtt.Client(client_id=f"pi-bridge-{HARDWARE_ID}", clean_session=True)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        log.info("MQTT connected to %s:%d", BROKER_HOST, BROKER_PORT)
    else:
        log.error("MQTT connect failed rc=%d", rc)

def on_disconnect(client, userdata, rc):
    if rc != 0:
        log.warning("MQTT unexpected disconnect rc=%d — will reconnect", rc)

mqttc.on_connect    = on_connect
mqttc.on_disconnect = on_disconnect
mqttc.connect_async(BROKER_HOST, BROKER_PORT, keepalive=60)
mqttc.loop_start()

# ── helpers ─────────────────────────────────────────────────────────────────────
def publish(topic: str, payload: dict):
    mqttc.publish(f"testbench/{topic}", json.dumps(payload), qos=1)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ── frame handlers ──────────────────────────────────────────────────────────────
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
            "runId":      frame["runId"],
            "status":     frame.get("status", "passed"),
            "finishedAt": frame.get("finishedAt", now_iso()),
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
    log.info("opening %s at %d baud", SERIAL_PORT, BAUD_RATE)
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=5)

    # heartbeat thread
    import threading
    def heartbeat_loop():
        while True:
            publish("heartbeat", {"hardwareId": HARDWARE_ID, "timestamp": now_iso()})
            time.sleep(30)

    threading.Thread(target=heartbeat_loop, daemon=True).start()

    def shutdown(sig, frame):
        log.info("shutting down")
        ser.close()
        mqttc.loop_stop()
        mqttc.disconnect()
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info("bridge running — reading from %s", SERIAL_PORT)
    buf = b""

    while True:
        try:
            chunk = ser.read(ser.in_waiting or 1)
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
                ser.close()
                ser.open()
            except Exception:
                pass

if __name__ == "__main__":
    main()
