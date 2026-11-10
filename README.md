# Workshop 4x4

Booking site, admin panel and agent API for a workshop that services body-on-frame
Toyotas and Lexus GX/LX. The full business spec is in [SPEC.md](SPEC.md).

Everything runs in Docker on one server:

| Service | What it is | Reachable from |
|---|---|---|
| `app` | Next.js site, admin panel (`/admin`), agent API (`/api/agent/*`) | the proxy only |
| `postgres` | Postgres 16 — one database for the app, a separate one for n8n | other containers only |
| `n8n` | Workflow tool that runs the AI features | the proxy only |
| `proxy` | NGINX Proxy Manager — HTTPS and routing | ports 80 and 443 (public), 81 (this machine only) |

Postgres and n8n publish no ports. All data lives in four named volumes:
`workshop_postgres_data`, `workshop_n8n_data`, `workshop_proxy_data`,
`workshop_proxy_letsencrypt`.

## Run it from scratch

You need Docker with the Compose plugin, and `openssl` to generate secrets.

### 1. Create `.env`

```bash
cp .env.example .env
```

Open `.env` and replace every `change-me…` value. The comments in the file say how to
generate each one. In short:

| Variable | How to get it |
|---|---|
| `POSTGRES_PASSWORD`, `N8N_DB_PASSWORD` | `openssl rand -hex 24` (a different one for each) |
| `AUTH_SECRET`, `AGENT_API_KEY`, `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` (a different one for each) |
| `DATABASE_URL` | put the same `POSTGRES_PASSWORD` inside it |
| `ADMIN_EMAIL` | the email you will log in with |
| `ADMIN_PASSWORD_HASH` | see below |
| `N8N_HOST` | the address of the n8n editor, e.g. `n8n.example.com` (use `localhost` for local testing) |

Create the admin password hash (needs Node.js and `npm install` once), then paste the
line it prints into `.env`:

```bash
npm run admin:hash -- "your password"
```

`N8N_ENCRYPTION_KEY` must never change after the first start — n8n uses it to read the
credentials you save in it.

### 2. Start

On the server:

```bash
docker compose up -d --build
```

On your own machine, add the dev override so you can open the app without the proxy:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

The first start takes a few minutes. In order: Postgres starts, the app applies the
database migrations, adds the seed data (bays, opening hours, services, prices, vehicles)
and creates n8n's database, then n8n and the proxy start.

### 3. Check

```bash
docker compose ps
```

Every service should show `healthy`. With the dev override:

- site: <http://127.0.0.1:3000>, admin panel: <http://127.0.0.1:3000/admin>
- n8n editor: <http://127.0.0.1:5678> (the first visit asks you to create the n8n owner account)
- proxy admin: <http://127.0.0.1:81>

### 4. Set up the proxy (server only)

The proxy admin panel listens on `127.0.0.1:81` only. From your own machine, open an SSH
tunnel and then browse to <http://127.0.0.1:8181>:

```bash
ssh -L 8181:127.0.0.1:81 user@your-server
```

Create the admin account on first visit, then add two **Proxy Hosts**, each with a
Let's Encrypt certificate and "Force SSL":

| Domain | Forward hostname | Port | Extra |
|---|---|---|---|
| your site domain (later `workshop.samkobuilds.com`) | `app` | `3000` | |
| the value of `N8N_HOST` | `n8n` | `5678` | turn on "Websockets Support" |

Point both domains' DNS at the server first, or the certificates cannot be issued.

### 5. Connect the AI (when the n8n workflows exist)

- n8n calls the app at `http://app:3000/api/agent/...` and must send the header
  `x-agent-key` with the value of `AGENT_API_KEY`.
- The app calls n8n at the webhook URLs in `N8N_REPAIR_WEBHOOK_URL` and
  `N8N_MODIFICATION_WEBHOOK_URL` (examples are in `.env.example`). While they are empty,
  requests are saved without AI text.

After changing `.env`, run the start command again to apply it.

## Everyday commands

```bash
docker compose ps                 # what is running
docker compose logs -f app        # watch the app (use n8n, postgres or proxy for the others)
docker compose up -d --build      # apply new code or a changed .env
docker compose down               # stop; data stays in the volumes
docker compose down -v            # stop AND delete all data (database, n8n, certificates)
```

## Local development

`docker-compose.dev.yml` is for your own machine only. It opens the app (`3000`),
Postgres (`5432`) and the n8n editor (`5678`) on `127.0.0.1`. Never use it on the server.

To work on the code with hot reload, run only Postgres in Docker and the app outside it:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
npm install
npm run db:init
npm run dev
```

If the Docker app is also running it already uses port 3000; stop it first with
`docker compose stop app`, or start the dev server on another port:
`npm run dev -- --port 3001`.

| Command | Does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm test` | tests that need no database |
| `npm run test:db` | tests against a throw-away Postgres database (needs port 5432 open, see above) |
| `npm run test:all` | both |
| `npm run typecheck` / `npm run lint` | static checks |
| `npm run db:generate` | create a migration after changing `src/db/schema.ts` |
| `npm run db:init` | apply migrations and seed data |

## Backups

Everything worth keeping is in the four volumes. To dump both databases:

```bash
docker compose exec postgres sh -c 'pg_dumpall -U "$POSTGRES_USER"' > backup.sql
```

Keep a copy of `.env` somewhere safe too: without `N8N_ENCRYPTION_KEY` the n8n
credentials in a restored backup cannot be read.
