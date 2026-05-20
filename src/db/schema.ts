import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const runStatus = pgEnum('run_status', ['pending', 'running', 'passed', 'failed', 'error'])
export const stepStatus = pgEnum('step_status', ['passed', 'failed', 'skipped'])
export const alertLevel = pgEnum('alert_level', ['warning', 'error'])

export const testRuns = pgTable('test_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: runStatus('status').default('pending').notNull(),
  hardwareId: text('hardware_id'),
  notes: text('notes'),
})

export const testSteps = pgTable(
  'test_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => testRuns.id, { onDelete: 'cascade' })
      .notNull(),
    sequence: integer('sequence').notNull(),
    name: text('name').notNull(),
    status: stepStatus('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    message: text('message'),
  },
  (t) => [index('test_steps_run_id_idx').on(t.runId)],
)

export const metrics = pgTable(
  'metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => testRuns.id, { onDelete: 'set null' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    temperature: real('temperature'),
    voltage: real('voltage'),
    currentMa: real('current_ma'),
    gpioStates: jsonb('gpio_states'),
  },
  (t) => [
    index('metrics_run_id_idx').on(t.runId),
    index('metrics_recorded_at_idx').on(t.recordedAt),
  ],
)

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id').references(() => testRuns.id, { onDelete: 'set null' }),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow().notNull(),
    level: alertLevel('level').notNull(),
    message: text('message').notNull(),
    acknowledged: boolean('acknowledged').default(false).notNull(),
  },
  (t) => [index('alerts_run_id_idx').on(t.runId)],
)

export const testRunsRelations = relations(testRuns, ({ many }) => ({
  steps: many(testSteps),
  metrics: many(metrics),
  alerts: many(alerts),
}))

export const testStepsRelations = relations(testSteps, ({ one }) => ({
  run: one(testRuns, { fields: [testSteps.runId], references: [testRuns.id] }),
}))

export const metricsRelations = relations(metrics, ({ one }) => ({
  run: one(testRuns, { fields: [metrics.runId], references: [testRuns.id] }),
}))

export const alertsRelations = relations(alerts, ({ one }) => ({
  run: one(testRuns, { fields: [alerts.runId], references: [testRuns.id] }),
}))
