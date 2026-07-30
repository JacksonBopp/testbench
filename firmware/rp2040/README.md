# RP2040 (Raspberry Pi Pico) reference firmware

Fourth reference implementation of testbench's device contract (MSP430:
[`firmware/main.c`](../main.c), ESP32: [`firmware/esp32/`](../esp32/), STM32:
[`firmware/stm32/`](../stm32/)). Two reasons this one's here specifically:

1. RP2040 is genuinely industry-adopted for cost-sensitive production hardware,
   not just a hobbyist board.
2. It closes the loop on testbench's own story — the recommended bridge host
   *is* a Raspberry Pi, so this reference firmware puts the same silicon vendor
   on both sides of the UART link.

Written against the official [Raspberry Pi Pico C SDK](https://github.com/raspberrypi/pico-sdk)
directly, no Arduino wrapper — the same toolchain used for production RP2040
firmware. Nothing on the bridge, backend, or dashboard changed to support this
chip; it emits byte-for-byte the same JSON frames as every other reference
firmware in this repo.

## Wiring

| Signal | GPIO | Purpose |
|---|---|---|
| UART TX | GPIO0 | to bridge host RX |
| UART RX | GPIO1 | to bridge host TX |
| ADC: VDD sense | GPIO26 (ADC0) | external divider to VDD |
| ADC: current sense | GPIO27 (ADC1) | current-sense shunt/amplifier output |
| ADC: temp sense | GPIO28 (ADC2) | NTC thermistor divider |
| GPIO loopback out | GPIO15 | jumper to GPIO14 |
| GPIO loopback in | GPIO14 | jumper to GPIO15 |

## Build

```bash
export PICO_SDK_PATH=/path/to/pico-sdk
cd firmware/rp2040
mkdir build && cd build
cmake .. -DPICO_BOARD=pico
make -j4
```

Flash by holding BOOTSEL while plugging in the Pico, then copying
`build/testbench_rp2040.uf2` to the USB mass-storage drive that appears.
