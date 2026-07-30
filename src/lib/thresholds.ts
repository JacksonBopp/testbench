export type ThresholdCondition = 'lt' | 'gt'

export type ThresholdRule = {
  name: string
  metric: string
  condition: ThresholdCondition
  value: number
  level: 'warning' | 'error'
}

export type Readings = {
  voltage?: number | null
  temperature?: number | null
  currentMa?: number | null
}

export type ThresholdBreach = {
  rule: ThresholdRule
  reading: number
  message: string
}

/**
 * Pure evaluation of a single threshold rule against a set of readings. Split out
 * from scripts/mqtt-subscriber.ts so the trigger logic can be unit tested without
 * a live database or MQTT broker.
 */
export function evaluateThreshold(rule: ThresholdRule, readings: Readings): ThresholdBreach | null {
  const val = readings[rule.metric as keyof Readings]
  if (val === null || val === undefined) return null

  const triggered =
    (rule.condition === 'lt' && val < rule.value) ||
    (rule.condition === 'gt' && val > rule.value)

  if (!triggered) return null

  const direction = rule.condition === 'lt' ? 'below' : 'above'
  return {
    rule,
    reading: val,
    message: `${rule.name}: ${rule.metric} ${val.toFixed(3)} ${direction} threshold ${rule.value}`,
  }
}

export function evaluateThresholds(rules: ThresholdRule[], readings: Readings): ThresholdBreach[] {
  return rules
    .map((rule) => evaluateThreshold(rule, readings))
    .filter((breach): breach is ThresholdBreach => breach !== null)
}
