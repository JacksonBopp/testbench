import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var pgClient: postgres.Sql | undefined
}

const client = global.pgClient ?? postgres(process.env.DATABASE_URL!)
if (process.env.NODE_ENV !== 'production') global.pgClient = client

export const db = drizzle(client, { schema })
