# Local Docker stack

Citus (coordinator + 3 workers), API, and feed-lab on the `encrypt-local` network.

## Before you start

1. **Install Docker** with Compose v2 (`docker compose`).

2. **Local env** (host dev: `npm run dev:api`, `npm run dev:lab`, tests):

   ```bash
   cp .env.example .env
   ```

   Edit `.env` if needed. Vite apps (`apps/web`, `apps/feed-lab`) read from the repo root via `envDir`. The API loads `.env` via dotenv on startup.

3. **Docker env** — `.env.docker` at the repo root (committed defaults). Edit for custom Citus credentials or ports. Compose passes it via `env_file`, mounts it at `/app/.env` inside `api` and `feed-lab` (for dotenv / Vite `envDir`), and uses it for `${POSTGRES_*}` interpolation.

   | File            | Purpose                                          |
   | --------------- | ------------------------------------------------ |
   | `.env.example`  | Template for local `.env`                        |
   | `.env`          | Gitignored local dev (copy from `.env.example`)  |
   | `.env.docker`   | Docker stack (`POSTGRES_*`, API, feed-lab proxy) |
   | `.env.electron` | Committed; `VITE_ELECTRON` for Electron builds   |

   `npm run dev:stack` passes `--env-file .env.docker` automatically.

4. **Review credentials** in `.env.docker` — defaults are fine for local dev. Compose builds `DATABASE_URL` for the API container from `POSTGRES_*`.

5. **`POSTGRES_PORT`** (default `5432`) must be free on the host. Set another value in `.env.docker` if needed.

6. **First start** (build images + create DB volumes):

   ```bash
   npm run dev:stack:build
   ```

   Or:

   ```bash
   docker compose --env-file .env.docker up -d --build
   ```

7. **Wait for one-shot init jobs** — **Exited (0)** is expected for:
   - `citus-bootstrap` (registers workers)
   - `api-migrate` (Prisma migrate + Citus distribution)

8. **Open the apps**:
   - feed-lab: http://localhost:5174 (or `https://` when `FEED_LAB_DEV_HTTPS=true` in `.env.docker`)
   - API health: http://localhost:3000/health
   - Postgres: `psql`, DBeaver, etc. at `localhost:<POSTGRES_PORT>` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from `.env.docker`

### Feednt Android + Docker API

The API container publishes `3000:3000` on the host. Phones and emulators must use your **machine's LAN IP** — they cannot reach `localhost` on your PC.

Capacitor WebView origin is `http://localhost`; ensure `.env.docker` includes `http://localhost` in `CORS_ALLOWED_ORIGINS` (default stack already does).

Phone and PC must be on the same Wi‑Fi.

After changing `apps/feed-lab/package.json` or root `package-lock.json`, rebuild feed-lab:

```bash
docker compose --env-file .env.docker build feed-lab
docker compose --env-file .env.docker up -d feed-lab
```

## Everyday commands

```bash
npm run dev:stack          # start stack (no rebuild)
npm run dev:stack:logs     # follow logs
npm run docker:down        # stop containers
docker compose --env-file .env.docker down -v   # stop and delete volumes (fresh DB)
```

## Changing database credentials

`POSTGRES_HOST_AUTH_METHOD=trust` is set for inter-node Citus traffic in local dev only.

After changing `.env.docker` credentials on an existing cluster, recreate volumes:

```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
```

## Verify Citus

```bash
docker exec -it citus-coordinator psql -U encrypt -d encrypt_feed
```

```sql
SELECT * FROM citus_get_active_worker_nodes();
SELECT logicalrelid::text, partmethod FROM pg_dist_partition ORDER BY 1;
```

`partmethod = h` on `message_key_manifest_shards` means hash-distributed by `recipient_key_id`.

## Database migrations (API)

**Docker stack:** `api-migrate` runs `db:setup` once per `docker compose up` (after Citus bootstrap), before the API starts.

**Host** (with `DATABASE_URL` in `.env` pointing at `localhost:POSTGRES_PORT`):

```bash
npm run db:setup

# Or separately:
npm run db:migrate
npm run db:citus:distribute
```

Rebuild the API image after dependency changes, or restart `api` after Prisma schema changes (the container runs `prisma generate` on startup):

```bash
npm run dev:stack:build
# or, after schema-only changes:
docker compose --env-file .env.docker up -d --build api
```

Recipients in a `keyManifest` must be registered (`users` row). Keys become registered after accepting a friend invitation or establishing a friendship. Run `npm run db:seed` to seed registered dev users and a dev friendship for local testing.

## Running API on the host (optional)

With Citus in Docker, use the same `POSTGRES_*` values in root `.env` and set:

`DATABASE_URL=postgresql://<user>:<password>@localhost:<POSTGRES_PORT>/<db>`
