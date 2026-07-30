import { describe, expect, it } from 'vitest'
import { parseFrame } from './frames'

/**
 * Proves the "protocol-first, hardware-agnostic" claim in the README isn't just
 * asserted — it's checked. Each fixture below is what pi/bridge.py actually
 * publishes to MQTT after receiving that reference firmware's real UART frames
 * (see firmware/main.c, firmware/esp32, firmware/stm32, firmware/rp2040),
 * including each platform's own gpio key naming (P1.4 vs GPIO27 vs PB1 vs
 * GPIO14). None of this requires the physical board — it's a fixed-point check
 * that the backend's validation layer actually accepts what every reference
 * firmware in the repo emits, not just what the simulator emits.
 */

const runId = '123e4567-e89b-12d3-a456-426614174000'
const startedAt = '2026-07-30T12:00:00.000Z'

const platforms = [
  {
    name: 'MSP430FR2355',
    metrics: {
      runId, temperature: 25.1, voltage: 3.28, currentMa: 12.4,
      gpioStates: { 'P1.4': true, 'P1.5': false, 'P1.6': true, 'P1.7': false },
    },
    step: {
      runId, sequence: 1, name: 'VDD rail check', status: 'passed' as const, startedAt,
    },
  },
  {
    name: 'ESP32',
    metrics: {
      runId, temperature: 24.6, voltage: 3.31, currentMa: 11.8,
      gpioStates: { GPIO27: true },
    },
    step: {
      runId, sequence: 3, name: 'GPIO loopback', status: 'failed' as const, startedAt,
      message: 'GPIO loopback mismatch - check GPIO25->GPIO27 jumper',
    },
  },
  {
    name: 'STM32F103C8',
    metrics: {
      runId, temperature: 23.9, voltage: 3.29, currentMa: 10.2,
      gpioStates: { PB1: false },
    },
    step: {
      runId, sequence: 5, name: 'Current draw', status: 'passed' as const, startedAt,
    },
  },
  {
    name: 'RP2040 (Pico)',
    metrics: {
      runId, temperature: 26.0, voltage: 3.30, currentMa: 13.5,
      gpioStates: { GPIO14: true },
    },
    step: {
      runId, sequence: 4, name: 'ADC accuracy', status: 'passed' as const, startedAt,
    },
  },
]

describe.each(platforms)('$name frames', ({ metrics, step }) => {
  it('metrics frame passes validation', () => {
    const result = parseFrame('testbench/metrics', metrics)
    expect(result.ok).toBe(true)
  })

  it('run_step frame passes validation', () => {
    const result = parseFrame('testbench/run/step', step)
    expect(result.ok).toBe(true)
  })
})
