#!/usr/bin/env python3
"""
MQTT replay tool — records real testbench/* traffic to a file and replays it
later with the original timing preserved. Useful for turning one interesting
hardware run (a real failure, a flaky sensor, a slow boot) into a fixture you
can re-run on demand for demos or regression checks, without touching hardware.

Usage:
  # record everything published under testbench/# until Ctrl-C
  python3 pi/replay.py record --out captures/2026-07-30-vdd-fail.jsonl

  # replay a capture at original speed
  python3 pi/replay.py play captures/2026-07-30-vdd-fail.jsonl

  # replay 4x faster, looping
  python3 pi/replay.py play captures/2026-07-30-vdd-fail.jsonl --speed 4 --loop
"""

import argparse
import json
import time
from pathlib import Path

import paho.mqtt.client as mqtt


def record(host: str, port: int, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    count = 0

    def on_message(_client, _userdata, msg):
        nonlocal count
        entry = {
            "t": round(time.monotonic() - started, 3),
            "topic": msg.topic,
            "payload": json.loads(msg.payload.decode()),
        }
        with out_path.open("a") as f:
            f.write(json.dumps(entry) + "\n")
        count += 1
        print(f"  [{entry['t']:>7.3f}s] {msg.topic}: {msg.payload.decode()[:80]}")

    client = mqtt.Client(client_id="testbench-replay-record", clean_session=True)
    client.on_message = on_message
    client.connect(host, port, keepalive=60)
    client.subscribe("testbench/#", qos=1)
    client.loop_start()

    print(f"[replay] recording testbench/# to {out_path} — press Ctrl-C to stop")
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()
        print(f"\n[replay] wrote {count} messages to {out_path}")


def load_capture(path: Path) -> list[dict]:
    entries = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                entries.append(json.loads(line))
    if not entries:
        raise SystemExit(f"[replay] {path} has no recorded messages")
    return entries


def play(host: str, port: int, path: Path, speed: float, loop: bool) -> None:
    entries = load_capture(path)
    client = mqtt.Client(client_id="testbench-replay-play", clean_session=True)
    client.connect(host, port, keepalive=60)
    client.loop_start()

    print(f"[replay] loaded {len(entries)} messages from {path} (speed={speed}x)")

    try:
        while True:
            last_t = 0.0
            for entry in entries:
                delay = (entry["t"] - last_t) / speed
                if delay > 0:
                    time.sleep(delay)
                last_t = entry["t"]
                payload = json.dumps(entry["payload"])
                client.publish(entry["topic"], payload, qos=1)
                print(f"  [{entry['t']:>7.3f}s] -> {entry['topic']}: {payload[:80]}")
            print("[replay] capture finished")
            if not loop:
                break
            print("[replay] looping...\n")
    except KeyboardInterrupt:
        print("\n[replay] stopped")
    finally:
        client.loop_stop()
        client.disconnect()


def main():
    parser = argparse.ArgumentParser(description="testbench MQTT capture/replay tool")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=1883)
    sub = parser.add_subparsers(dest="mode", required=True)

    p_record = sub.add_parser("record", help="record live testbench/# traffic to a file")
    p_record.add_argument("--out", required=True, type=Path, help="output .jsonl capture path")

    p_play = sub.add_parser("play", help="replay a recorded capture")
    p_play.add_argument("capture", type=Path, help="path to a .jsonl capture file")
    p_play.add_argument("--speed", type=float, default=1.0, help="playback speed multiplier")
    p_play.add_argument("--loop", action="store_true", help="repeat indefinitely")

    args = parser.parse_args()

    if args.mode == "record":
        record(args.host, args.port, args.out)
    else:
        play(args.host, args.port, args.capture, args.speed, args.loop)


if __name__ == "__main__":
    main()
