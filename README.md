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

On the server the app runs a **released image**: GitHub Actions builds it on every merge
into `main` and stores it in GHCR (see [Releases](#releases)). Set `APP_VERSION` in `.env`
to the release you want (for example `1.0.1`), then:

```bash
docker compose up -d
```

On your own machine, add the dev override. It builds the app from the code in this folder
and opens it without the proxy:

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
docker compose up -d              # apply a changed .env or APP_VERSION
docker compose down               # stop; data stays in the volumes
docker compose down -v            # stop AND delete all data (database, n8n, certificates)
```

## Releases

Every change goes branch → pull request → green CI → merge. `main` is protected.

1. **CI** (`.github/workflows/ci.yml`) runs on each pull request: lint, type check, unit
   and database tests, and a Docker build.
2. **Release** (`.github/workflows/release.yml`) runs on each merge into `main`: it builds
   the image and pushes it to GHCR as `1.0.<run number>`, `sha-<commit>` and `latest`.
   Nothing is deployed automatically.
3. **Deploy** in Portainer (reached through an SSH tunnel, like the proxy admin):
   Stacks → `workshop-4x4` → set `APP_VERSION` to the new number → Update the stack with
   "Re-pull image" on. Database migrations run when the new container starts.
4. **Roll back**: set `APP_VERSION` back to the previous number and update again.
   A release that added a database migration cannot be rolled back this way; restore the
   backup taken before it instead.

```bash
ssh -L 9443:127.0.0.1:9443 user@your-server    # then open https://127.0.0.1:9443
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

Everything worth keeping is in the four volumes; the two databases are what changes daily.

```bash
scripts/backup.sh           # dump both databases to ~/backups, keep the newest 14
scripts/restore-check.sh    # load the newest dump into a throw-away Postgres and print row counts
```

On the server the backup runs every night from cron (a copy of the script is in `~/bin`):

```
30 3 * * *  /home/deploy/bin/workshop-backup.sh >> /home/deploy/backups/backup.log 2>&1
```

`restore-check.sh` never touches the live database: it starts its own container with no
network, restores into it, prints how many bookings, customers, requests, vehicles, n8n
workflows and credentials came back, and removes the container. Run it after any change to
the backup setup, and now and then anyway — an untested backup is only a hope.

To restore for real, start only Postgres with an empty volume, load the file, then start
the rest:

```bash
zcat ~/backups/<file>.sql.gz | docker exec -i workshop-4x4-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d postgres'
```

Two things the scripts do not do for you:

- **Copy backups off the server.** They sit on the same droplet as the database. Download
  them regularly (`scp user@your-server:backups/<file> .`).
- **Keep `.env`.** Without `N8N_ENCRYPTION_KEY` the n8n credentials in a restored backup
  cannot be read. Keep a copy somewhere safe, outside the server and outside git.

## Security notes

- **Only ports 22, 80 and 443 are public**, and 22 only from the owner's IP (DigitalOcean
  Cloud Firewall, which Docker cannot bypass the way it bypasses `ufw`). Postgres and n8n
  publish no ports. The proxy admin (81) and Portainer (9443) listen on `127.0.0.1` and are
  reached through an SSH tunnel.
- **SSH:** key only, no passwords, no root login (`PermitRootLogin no`). Security updates
  install automatically (`unattended-upgrades`).
- **Containers and root:** the app and n8n run as the unprivileged `node` user and Postgres
  as `postgres`. Two third-party images run as root inside their container, by design of
  the image: NGINX Proxy Manager (it binds ports 80/443 and manages certificates) and
  Portainer (it controls Docker through the Docker socket, which is root-equivalent on the
  host). That is why neither admin panel is exposed to the internet.
- **The `docker` group is root-equivalent.** The `deploy` user is in it, so the SSH key for
  `deploy` must be protected like a root password.
- **n8n** is behind an IP allow-list on its proxy host, and every workshop webhook checks
  the `x-webhook-secret` header. The app reaches n8n on the internal Docker network.
- **Secrets** live only in `.env` on the server and in Portainer's stack variables. Nothing
  secret is in the repository or in the image.
- **Third-party images are pinned** to an exact version and digest in `docker-compose.yml`.
  To upgrade one, change both in a pull request
  (`docker buildx imagetools inspect <image>:<version>` prints the digest), and take a
  backup first when it is n8n or Postgres.

## Security audit

The project was audited on 12 November 2026 with the `/cso` skill (an AI-assisted security
audit: secrets, dependencies, CI/CD, Docker, webhooks, AI handling, access control, and the
live server).

**Result: no critical findings, one high and three medium. All four are fixed.**

| # | Severity | What the audit found | What was fixed |
|---|---|---|---|
| 1 | High | The admin login lockout could be bypassed through Auth.js's own callback address, allowing unlimited password guesses | The lockout now sits inside the password check itself, so every sign-in path is counted |
| 2 | Medium | An offer e-mail went to the first e-mail ever stored for a phone number, which could be a stranger's | Each request stores the e-mail typed on it, and the offer goes there |
| 3 | Medium | Postgres, n8n and the proxy were pulled by moving tags on every release | All three are pinned to an exact version and digest |
| 4 | Medium | No required reviewer for the release pipeline files | `.github/CODEOWNERS` added |

The full report, with the proof for each finding, what came back clean, and the smaller
points that are still open, is in [SECURITY-AUDIT.md](SECURITY-AUDIT.md).
