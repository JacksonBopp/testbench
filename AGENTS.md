<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Known breaking changes in this version

- **`params` is a Promise** — always `await params` in page/layout components:
  ```ts
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
  }
  ```
- Server components can be `async` and query the DB directly — no `getServerSideProps`
- Route handlers live in `src/app/api/**/route.ts`, export named `GET`/`POST`/`PATCH`/`DELETE` functions
- `export const dynamic = 'force-dynamic'` is required on SSE/streaming routes
<!-- END:nextjs-agent-rules -->

# Project conventions

## Database

- Schema is in `src/db/schema.ts` — always update the schema there and generate a migration with `npm run db:generate`
- Never write raw SQL — use Drizzle query builder
- DB client is a singleton in `src/db/index.ts` — import `{ db }` from `@/db`
- Run migrations: `npm run db:migrate`

## Singleton pattern

Both MQTT and DB clients use a `global.varName` singleton to survive Next.js HMR:

```ts
declare global { var myClient: MyClient | undefined }
const client = global.myClient ?? createClient()
if (process.env.NODE_ENV !== 'production') global.myClient = client
```

## UI / components

- **Always use `src/components/ui/status-badge.tsx`** for any run/step status display — never inline badge spans
- Icons come from `lucide-react` — don't add other icon libraries
- Page layout: `<div className="p-8 max-w-6xl mx-auto">`
- Cards: `rounded-xl border border-zinc-200 bg-white shadow-sm`
- Client components that mutate data should call `router.refresh()` after the API call (not a full page reload)

## API routes

- Mutations (POST/PATCH/DELETE) live in route handlers, not server actions
- Always return `NextResponse.json(...)` with an explicit status code
- Validate inputs at the boundary — trust nothing from the request body

## Do not touch

- `.env.local` — contains real API keys, never read or log these values
- `src/db/migrations/` — never edit migration files manually
- `docker-compose.yml` — infrastructure is stable, don't change ports or service names
