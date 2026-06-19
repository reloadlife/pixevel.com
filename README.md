# Pixevel

Pixevel is a Persian-first, RTL, mobile-first e-commerce store built with Next.js
(App Router), PostgreSQL, and [Drizzle ORM](https://orm.drizzle.team).

## Getting Started

```bash
bun install
cp .env.example .env   # set DATABASE_URL, SESSION_SECRET, etc.
bun run db:up          # start the local Postgres container
bun run db:push        # sync the Drizzle schema to the database
bun run dev            # http://localhost:4000
```

## Database (Drizzle)

The schema lives in `src/db/schema.ts`; the client is created by `getDb()` in
`src/lib/db.ts`.

| Command              | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `bun run db:push`    | Push the schema directly to the DB (dev / deploy).      |
| `bun run db:generate`| Generate SQL migration files into `./drizzle`.          |
| `bun run db:migrate` | Apply generated migrations.                             |
| `bun run db:studio`  | Open Drizzle Studio.                                    |

`drizzle.config.ts` holds the kit configuration (dialect, schema path, output
dir, and `DATABASE_URL` credentials).

## Code Quality

[Biome](https://biomejs.dev) handles both linting and formatting (config in
`biome.json`). ESLint and Prettier are not used.

| Command            | Description                                            |
| ------------------ | ----------------------------------------------------- |
| `bun run lint`     | Lint only (`biome lint`).                              |
| `bun run format`   | Format files in place (`biome format --write`).       |
| `bun run check`    | Lint + format + organize imports (`biome check --write`). |

CI runs `biome ci` on every push and pull request. Type checking runs as part of
`next build` (no separate `tsc` step).

## Deployment

`docker compose` builds three targets from the `Dockerfile`: `app` (the Next.js
standalone server), `migrate` (runs `db:push` against the database on deploy),
and `postgres`. See `compose.yaml` and `scripts/deploy-server.sh`.
