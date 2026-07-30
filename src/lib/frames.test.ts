import { describe, expect, it } from 'vitest'
import { isKnownTopic, parseFrame } from './frames'

describe('isKnownTopic', () => {
  it('accepts the four subscriber topics', () => {
    expect(isKnownTopic('testbench/metrics')).toBe(true)
    expect(isKnownTopic('testbench/run/status')).toBe(true)
    expect(isKnownTopic('testbench/run/step')).toBe(true)
    expect(isKnownTopic('testbench/heartbeat')).toBe(true)
  })

  it('rejects unknown topics', () => {
    expect(isKnownTopic('testbench/command/run')).toBe(false)
    expect(isKnownTopic('')).toBe(false)
  })
})

describe('parseFrame — testbench/metrics', () => {
  it('accepts a full valid payload', () => {
    const result = parseFrame('testbench/metrics', {
      runId: '123e4567-e89b-12d3-a456-426614174000',
      temperature: 24.1,
      voltage: 3.28,
      currentMa: 12.4,
      gpioStates: { 'P1.4': true },
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a minimal payload with all fields omitted', () => {
    const result = parseFrame('testbench/metrics', {})
    expect(result.ok).toBe(true)
  })

  it('rejects a non-numeric voltage', () => {
    const result = parseFrame('testbench/metrics', { voltage: 'high' })
    expect(result.ok).toBe(false)
  })

  it('rejects a malformed runId', () => {
    const result = parseFrame('testbench/metrics', { runId: 'not-a-uuid' })
    expect(result.ok).toBe(false)
  })
})

describe('parseFrame — testbench/run/status', () => {
  const runId = '123e4567-e89b-12d3-a456-426614174000'

  it('accepts a passed status update', () => {
    const result = parseFrame('testbench/run/status', { runId, status: 'passed' })
    expect(result.ok).toBe(true)
  })

  it('rejects a missing runId', () => {
    const result = parseFrame('testbench/run/status', { status: 'passed' })
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid status enum value', () => {
    const result = parseFrame('testbench/run/status', { runId, status: 'ok' })
    expect(result.ok).toBe(false)
  })
})

describe('parseFrame — testbench/run/step', () => {
  const runId = '123e4567-e89b-12d3-a456-426614174000'
  const startedAt = '2026-07-30T12:00:00Z'

  it('accepts a complete step', () => {
    const result = parseFrame('testbench/run/step', {
      runId, sequence: 1, name: 'VDD check', status: 'passed', startedAt,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a negative sequence number', () => {
    const result = parseFrame('testbench/run/step', {
      runId, sequence: -1, name: 'VDD check', status: 'passed', startedAt,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a missing name', () => {
    const result = parseFrame('testbench/run/step', {
      runId, sequence: 1, status: 'passed', startedAt,
    })
    expect(result.ok).toBe(false)
  })
})

describe('parseFrame — testbench/heartbeat', () => {
  it('accepts an empty heartbeat', () => {
    const result = parseFrame('testbench/heartbeat', {})
    expect(result.ok).toBe(true)
  })

  it('accepts a full heartbeat', () => {
    const result = parseFrame('testbench/heartbeat', {
      hardwareId: 'esp32-01', firmwareVersion: '1.0.0', timestamp: '2026-07-30T12:00:00Z',
    })
    expect(result.ok).toBe(true)
  })
})
