# STM32 reference firmware

Third reference implementation of testbench's device contract (see
[`firmware/main.c`](../main.c) for MSP430 and [`firmware/esp32/`](../esp32/) for
ESP32). STM32 is included specifically because it's the closest thing to an
*industry-standard* MCU family for real embedded product work — medical devices,
automotive, and industrial control systems lean on it constantly — so this port
is written against ST's own HAL (STM32Cube), the way a production firmware team
would actually build it, rather than a beginner-framework wrapper.

Nothing on the bridge, backend, or dashboard changed to support this chip. It
emits byte-for-byte the same JSON frames as every other reference firmware in
this repo — see [`src/lib/frames.ts`](../../src/lib/frames.ts) and its test
fixtures for proof the backend accepts them.

## Wiring (STM32F103C8 "Blue Pill")

| Signal | Pin | Purpose |
|---|---|---|
| UART TX | PA9 | to bridge host RX |
| UART RX | PA10 | to bridge host TX |
| ADC: VDD sense | PA0 | external divider to VDD |
| ADC: current sense | PA1 | current-sense shunt/amplifier output |
| ADC: temp sense | PA2 | NTC thermistor divider |
| GPIO loopback out | PB0 | jumper to PB1 |
| GPIO loopback in | PB1 | jumper to PB0 |

## Build

Requires [PlatformIO](https://platformio.org/):

```bash
cd firmware/stm32
pio run              # build
pio run -t upload    # flash (ST-Link)
pio device monitor -b 9600
```

## Why this board

The Blue Pill (STM32F103C8) is one of the cheapest, most widely available STM32
dev boards — the point isn't the specific board, it's the HAL and peripheral
patterns (`HAL_UART_Init`, `HAL_ADC_*`, `HAL_GPIO_*`), which are the same ones
used across the entire STM32 family from this $2 board up to production
automotive-grade parts. Porting to a different STM32 (F4, G0, etc.) is a
peripheral-config change, not a rewrite.
