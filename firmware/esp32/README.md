# ESP32 reference firmware

Second reference implementation of testbench's device contract (the first is the
MSP430FR2355 firmware in [`firmware/main.c`](../main.c)). It proves the platform's
central design claim: the backend, MQTT bridge, and dashboard are completely
unaware of which chip they're talking to. This firmware emits the exact same
newline-terminated JSON frames as the MSP430 port, over its own hardware UART —
nothing on the Pi bridge or backend changed to support it.

## Wiring

| Signal | ESP32 pin | Purpose |
|---|---|---|
| UART TX | GPIO17 | to bridge host RX |
| UART RX | GPIO16 | to bridge host TX |
| ADC: VDD sense | GPIO34 | external divider to VDD |
| ADC: current sense | GPIO35 | current-sense shunt/amplifier output |
| ADC: temp sense | GPIO32 | NTC thermistor divider |
| GPIO loopback out | GPIO25 | jumper to GPIO27 |
| GPIO loopback in | GPIO27 | jumper to GPIO25 |

## Build

Requires [PlatformIO](https://platformio.org/):

```bash
cd firmware/esp32
pio run              # build
pio run -t upload    # flash
pio device monitor -b 9600
```

## Why UART instead of WiFi-direct-to-MQTT

The ESP32 has a WiFi radio and could publish straight to the Mosquitto broker,
skipping the Pi bridge entirely. This reference firmware deliberately doesn't do
that: it stays on the same UART contract as every other board so `pi/bridge.py`
and `pi/bridge-sim.py` don't need a device-specific code path. A WiFi-direct
variant is a reasonable follow-up (see the top-level README roadmap) and would
live alongside this one, not replace it.
