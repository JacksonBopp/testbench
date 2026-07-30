import { describe, expect, it } from 'vitest'
import { evaluateThreshold, evaluateThresholds, type ThresholdRule } from './thresholds'

const lowVoltage: ThresholdRule = {
  name: 'Low voltage',
  metric: 'voltage',
  condition: 'lt',
  value: 3.0,
  level: 'error',
}

const highTemp: ThresholdRule = {
  name: 'High temperature',
  metric: 'temperature',
  condition: 'gt',
  value: 60,
  level: 'warning',
}

describe('evaluateThreshold', () => {
  it('triggers when a "lt" reading falls below the threshold', () => {
    const breach = evaluateThreshold(lowVoltage, { voltage: 2.87 })
    expect(breach).not.toBeNull()
    expect(breach?.message).toContain('below threshold 3')
  })

  it('does not trigger when the reading is within range', () => {
    expect(evaluateThreshold(lowVoltage, { voltage: 3.28 })).toBeNull()
  })

  it('triggers when a "gt" reading exceeds the threshold', () => {
    const breach = evaluateThreshold(highTemp, { temperature: 72 })
    expect(breach).not.toBeNull()
    expect(breach?.message).toContain('above threshold 60')
  })

  it('does not trigger when the relevant reading is missing', () => {
    expect(evaluateThreshold(lowVoltage, {})).toBeNull()
    expect(evaluateThreshold(lowVoltage, { voltage: null })).toBeNull()
  })

  it('is exactly at the boundary is not a breach (strict comparison)', () => {
    expect(evaluateThreshold(lowVoltage, { voltage: 3.0 })).toBeNull()
    expect(evaluateThreshold(highTemp, { temperature: 60 })).toBeNull()
  })
})

describe('evaluateThresholds', () => {
  it('returns only the rules that actually breached', () => {
    const breaches = evaluateThresholds([lowVoltage, highTemp], { voltage: 2.87, temperature: 24 })
    expect(breaches).toHaveLength(1)
    expect(breaches[0].rule.name).toBe('Low voltage')
  })

  it('returns multiple breaches when more than one rule triggers', () => {
    const breaches = evaluateThresholds([lowVoltage, highTemp], { voltage: 2.5, temperature: 90 })
    expect(breaches).toHaveLength(2)
  })

  it('returns an empty array when nothing breaches', () => {
    const breaches = evaluateThresholds([lowVoltage, highTemp], { voltage: 3.3, temperature: 25 })
    expect(breaches).toHaveLength(0)
  })
})
