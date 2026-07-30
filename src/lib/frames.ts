import { z } from 'zod'

/**
 * Validated shapes for every MQTT topic testbench consumes. These are the system
 * boundary between untrusted device/bridge input and the rest of the app — see
 * scripts/mqtt-subscriber.ts, which parses raw JSON off the wire and rejects
 * anything that doesn't match before it reaches the database.
 */

export const metricsPayloadSchema = z.object({
  runId: z.string().uuid().nullish(),
  temperature: z.number().nullish(),
  voltage: z.number().nullish(),
  currentMa: z.number().nullish(),
  gpioStates: z.record(z.string(), z.boolean()).nullish(),
})
export type MetricsPayload = z.infer<typeof metricsPayloadSchema>

export const runStatusPayloadSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'error']),
  finishedAt: z.string().datetime({ offset: true }).optional(),
  firmwareVersion: z.string().optional(),
})
export type RunStatusPayload = z.infer<typeof runStatusPayloadSchema>

export const runStepPayloadSchema = z.object({
  runId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.enum(['passed', 'failed', 'skipped']),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).optional(),
  message: z.string().nullish(),
})
export type RunStepPayload = z.infer<typeof runStepPayloadSchema>

export const heartbeatPayloadSchema = z.object({
  hardwareId: z.string().optional(),
  firmwareVersion: z.string().optional(),
  timestamp: z.string().optional(),
})
export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>

const TOPIC_SCHEMAS = {
  'testbench/metrics': metricsPayloadSchema,
  'testbench/run/status': runStatusPayloadSchema,
  'testbench/run/step': runStepPayloadSchema,
  'testbench/heartbeat': heartbeatPayloadSchema,
} as const

export type KnownTopic = keyof typeof TOPIC_SCHEMAS

export function isKnownTopic(topic: string): topic is KnownTopic {
  return topic in TOPIC_SCHEMAS
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Validates a raw MQTT payload against the schema for its topic. */
export function parseFrame(topic: KnownTopic, raw: unknown): ParseResult<unknown> {
  const schema = TOPIC_SCHEMAS[topic]
  const result = schema.safeParse(raw)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
}
