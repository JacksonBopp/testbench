#!/usr/bin/env python3
"""
Hardware simulator — publishes fake device telemetry to the MQTT broker.
Run this on your dev machine instead of a real device + bridge. Emits the same
JSON frame contract as pi/bridge.py, so it works without any physical hardware.

Usage:
  python3 pi/bridge-sim.py [--host localhost] [--port 1883] [--scenario normal|failing]

Scenarios:
  normal   — voltage holds 3.28V, temperature 24°C, test run passes
  failing  — voltage dips to 2.87V mid-run, triggers alert, test run fails
"""

import argparse
import json
import math
import random
import time
from datetime import datetime, timezone
from uuid import uuid4

import paho.mqtt.client as mqtt

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def publish(client, topic, payload):
    client.publish(f"testbench/{topic}", json.dumps(payload), qos=1)
    print(f"  -> testbench/{topic}: {json.dumps(payload)[:80]}")

def run_scenario(client, scenario: str, run_id: str | None = None):
    run_id = run_id or str(uuid4())
    hardware_id = "sim-device"
    print(f"\n[sim] starting {scenario!r} scenario — run {run_id[:8]}")

    # announce run start
    publish(client, "run/status", {
        "runId": run_id,
        "status": "running",
        "hardwareId": hardware_id,
    })
    time.sleep(0.5)

    steps = [
        ("VDD rail check",     2.0),
        ("Clock stability",    1.5),
        ("GPIO output test",   1.0),
        ("ADC accuracy",       2.5),
        ("UART loopback",      1.0),
        ("Timer precision",    1.5),
        ("Power draw nominal", 2.0),
    ]

    failing_step = 4 if scenario == "failing" else None  # 0-indexed

    for i, (name, duration) in enumerate(steps):
        seq = i + 1
        started = now_iso()

        # emit metrics during each step
        for tick in range(int(duration * 2)):
            t = i * 3.0 + tick * 0.5
            temp     = 24.0 + 0.5 * math.sin(t * 0.3) + random.uniform(-0.2, 0.2)
            if scenario == "failing" and i >= failing_step:
                voltage = 2.87 + 0.02 * math.sin(t) + random.uniform(-0.01, 0.01)
            else:
                voltage  = 3.28 + 0.01 * math.sin(t * 0.7) + random.uniform(-0.005, 0.005)
            current  = 12.0 + 2.0 * math.sin(t * 0.5) + random.uniform(-0.5, 0.5)

            publish(client, "metrics", {
                "runId":       run_id,
                "temperature": round(temp, 2),
                "voltage":     round(voltage, 3),
                "currentMa":   round(current, 1),
                "gpioStates": {
                    "P1.4": True,
                    "P1.5": i % 2 == 0,
                    "P1.6": tick % 3 != 0,
                    "P1.7": False,
                },
            })
            time.sleep(0.5)

        finished = now_iso()
        step_status = "failed" if i == failing_step else "passed"
        msg = "Voltage below 3.0V threshold" if i == failing_step else None

        publish(client, "run/step", {
            "runId":      run_id,
            "sequence":   seq,
            "name":       name,
            "status":     step_status,
            "startedAt":  started,
            "finishedAt": finished,
            "message":    msg,
        })
        print(f"  step {seq} {name!r}: {step_status}")

        if step_status == "failed":
            break  # abort on first failure

    run_status = "failed" if scenario == "failing" else "passed"
    publish(client, "run/status", {
        "runId":      run_id,
        "status":     run_status,
        "finishedAt": now_iso(),
    })
    print(f"[sim] run complete: {run_status}")
    return run_id

def heartbeat_loop(client):
    while True:
        publish(client, "heartbeat", {
            "hardwareId": "sim-device",
            "timestamp":  now_iso(),
        })
        time.sleep(30)

def main():
    parser = argparse.ArgumentParser(description="testbench hardware simulator")
    parser.add_argument("--host",     default="localhost")
    parser.add_argument("--port",     type=int, default=1883)
    parser.add_argument("--scenario", choices=["normal", "failing"], default="normal")
    parser.add_argument("--loop",     action="store_true", help="repeat indefinitely")
    parser.add_argument("--listen",   action="store_true",
                        help="wait for testbench/command/run instead of running immediately")
    args = parser.parse_args()

    pending_runs: list[dict] = []

    def on_message(c, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except Exception:
            return
        if msg.topic == "testbench/command/run":
            print(f"[sim] received command/run: {payload.get('runId', '?')[:8]}")
            pending_runs.append(payload)

    client = mqtt.Client(client_id="testbench-sim", clean_session=True)
    client.on_message = on_message
    client.connect(args.host, args.port, keepalive=60)
    client.subscribe("testbench/command/#", qos=1)
    client.loop_start()

    print(f"[sim] connected to {args.host}:{args.port}")
    time.sleep(0.5)

    import threading
    threading.Thread(target=heartbeat_loop, args=(client,), daemon=True).start()

    try:
        if args.listen:
            print("[sim] listening for testbench/command/run — press Ctrl-C to stop")
            while True:
                if pending_runs:
                    cmd = pending_runs.pop(0)
                    # override the run_id so it matches what the server created
                    run_id = cmd.get("runId")
                    if run_id:
                        run_scenario(client, args.scenario, run_id=run_id)
                time.sleep(0.2)
        else:
            while True:
                run_scenario(client, args.scenario)
                if not args.loop:
                    break
                print("[sim] waiting 10s before next run…")
                time.sleep(10)
    except KeyboardInterrupt:
        print("\n[sim] stopped")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
