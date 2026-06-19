# Pixevel

Pixevel is a Persian-first, RTL, mobile-first e-commerce store built with Next.js
(App Router), PostgreSQL, and [Drizzle ORM](https://orm.drizzle.team).

## Getting Started

```bash
npm install
cp .env.example .env   # set DATABASE_URL, SESSION_SECRET, etc.
npm run db:up          # start the local Postgres container
npm run db:push        # sync the Drizzle schema to the database
npm run dev            # http://localhost:4000
```

## Database (Drizzle)

The schema lives in `src/db/schema.ts`; the client is created by `getDb()` in
`src/lib/db.ts`.

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `npm run db:push`    | Push the schema directly to the DB (dev / deploy).      |
| `npm run db:generate`| Generate SQL migration files into `./drizzle`.          |
| `npm run db:migrate` | Apply generated migrations.                             |
| `npm run db:studio`  | Open Drizzle Studio.                                    |

`drizzle.config.ts` holds the kit configuration (dialect, schema path, output
dir, and `DATABASE_URL` credentials).

## Code Quality

[Biome](https://biomejs.dev) handles both linting and formatting (config in
`biome.json`). ESLint and Prettier are not used.

| Command            | Description                                            |
| ------------------ | ----------------------------------------------------- |
| `npm run lint`     | Lint only (`biome lint`).                              |
| `npm run format`   | Format files in place (`biome format --write`).       |
| `npm run check`    | Lint + format + organize imports (`biome check --write`). |

CI runs `biome ci` on every push and pull request. Type checking runs as part of
`next build` (no separate `tsc` step).

## Deployment

`docker compose` builds three targets from the `Dockerfile`: `app` (the Next.js
standalone server), `migrate` (runs `db:push` against the database on deploy),
and `postgres`. See `compose.yaml` and `scripts/deploy-server.sh`.
