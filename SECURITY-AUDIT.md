# Security audit: what it found and what was fixed

| | |
|---|---|
| **Date** | 12 November 2026 |
| **Tool** | `/cso` skill for Claude Code (AI-assisted audit, 15 phases, read-only) |
| **Mode** | Daily: only findings with confidence 8/10 or higher are reported |
| **Scope** | The whole repository and its git history, the CI/CD pipeline, the Docker setup, the n8n integration and the live server |
| **Version audited** | 1.0.3 (commit `ffd8d74`) |

## Result

| Severity | Found | Fixed |
|---|---|---|
| Critical | 0 | – |
| High | 1 | 1 |
| Medium | 3 | 3 |

No critical findings. All four reported findings are fixed in releases 1.0.5 and
1.0.6 (the high one needed a second pass, described below). Seven smaller points fell below the reporting bar; one of
them is fixed too, and the rest are listed at the end with the reason they are
accepted for now.

## Findings and fixes

### 1. HIGH: the admin login lockout could be bypassed

**Found.** The "5 wrong tries, then wait 15 minutes" rule lived only in the
login form's server action. Auth.js also accepts a login at
`POST /api/auth/callback/credentials`, and that address checked the same
password with no limit at all.

**Proof.** Eight wrong logins in a row were sent to that address on the live
site (with an e-mail that does not exist). All eight were evaluated; none was
refused.

**Impact.** Unlimited password guessing against the only admin account, which
opens every customer's name, phone, e-mail and car.

**Fixed.**

- The lockout moved into the one function that checks the password
  (`src/lib/admin/login.ts`), which Auth.js calls for every sign-in path. A
  locked-out address is refused before the password is even looked at.
- The limiter no longer empties itself when it holds 5,000 addresses; it drops
  the oldest entries one by one, so a flood of fake addresses cannot lift a
  real lockout (`src/lib/admin/rate-limit.ts`).
- New tests: `tests/admin-login.test.ts`.

**Second pass (after release 1.0.5).** Re-testing on the live site showed the
first fix was incomplete. Next.js bundles the login form and the `/api/auth`
route separately, so each had its own copy of the counter: an attacker got five
tries on each address instead of five in total. The counter is now shared by
the whole process (`globalThis`), in the release that follows 1.0.5.

**Checked.** Against the final image, in an isolated test container: three
wrong tries through the callback address plus two through the form locked the
address out on both. The sixth try showed the lockout message, the *correct*
password was refused from that address, and another address could still sign in.

### 2. MEDIUM: an offer e-mail could go to someone else's address

**Found.** Customers are stored one row per phone number, and the row keeps the
first e-mail it ever saw. The offer e-mail was sent to that stored address, not
to the one typed on the request.

**How it could be abused.** Someone submits any form with a victim's phone
number and their own e-mail. When the victim later asks for an offer, the
approved offer goes to the stranger and the real customer never receives it.
The same rule also broke the normal case of a returning customer with a new
e-mail.

**Fixed.**

- Every request now stores the e-mail typed on it (`requests.contact_email`,
  migration `drizzle/0005_request_contact_email.sql`).
- The offer is sent to that address, and the admin inbox shows that address
  (`src/lib/requests/offer.ts`, `src/lib/admin/queries.ts`).
- New test in `tests/requests.db.test.ts` replays the abuse and checks the offer
  reaches the real customer.

### 3. MEDIUM: third-party images were pulled by moving tags

**Found.** `postgres:16-alpine`, `n8n:stable` and `nginx-proxy-manager:2` are
tags that the publisher moves to newer builds. Every release redeploy re-pulled
them, so unreviewed code could land in the containers that hold the database,
the AI and Gmail credentials, and all HTTPS traffic. An n8n upgrade also
migrates its own database, which a rollback of the app would not undo.

**Fixed.** All three are pinned to an exact version and digest in
`docker-compose.yml` (`postgres:16.15-alpine`, `n8n:2.47.4`,
`nginx-proxy-manager:2.17.0`). They are the builds already running, so the pin
changes nothing on the server. Upgrades now go through a pull request.

### 4. MEDIUM: no code owner for the release pipeline

**Found.** Nothing named a required reviewer for the workflow files that build
and publish the image.

**Fixed.** `.github/CODEOWNERS` names the owner for `/.github/`,
`docker-compose.yml` and the `Dockerfile`.

## What came back clean

- **Secrets:** none in the code or anywhere in the git history. `.env` is
  ignored and was never committed.
- **Dependencies:** no known vulnerabilities in the packages that ship in the
  image. The lockfile is committed.
- **CI/CD:** every GitHub Action is pinned to a commit SHA, the token is
  read-only by default, and no workflow runs untrusted pull-request code with
  secrets.
- **Docker:** the app runs as a non-root user and no secret is baked into the
  image. Postgres and n8n publish no ports.
- **Webhooks:** all six n8n webhooks require a secret header, and the agent API
  requires its own key.
- **AI:** customer text is only ever passed as user input, never as
  instructions. AI output is shown as plain text, and whatever the agent asks
  for is validated by the app.
- **Admin panel:** every admin action and query checks the session. No SQL
  injection, unsafe HTML or request-forgery paths were found.

## Below the reporting bar

| Point | Status |
|---|---|
| Audit reports could be committed by accident | **Fixed:** `.security-reports/` is in `.gitignore` |
| No HSTS, CSP or frame-protection headers | Open. Planned in the proxy settings |
| The public booking form has no rate limit | Open. A script could fill the calendar with fake bookings |
| 11 moderate advisories in development-only packages | Accepted. None of them ships in the image |
| The `deploy` user has passwordless `sudo` | Accepted. Key-only SSH, root login disabled, SSH limited by the cloud firewall |
| Auth.js error redirect uses the container address | Open. Needs `AUTH_URL` set; cosmetic |
| Backups sit unencrypted on the same server | Accepted for the course. They are also downloaded off the server |

## Hardening done before the audit

- Cloud firewall: only 22, 80 and 443 are open, and 22 only from the owner's address.
  The proxy admin page and Portainer listen on `127.0.0.1` and are reached
  through an SSH tunnel.
- SSH: keys only, root login disabled.
- n8n editor limited to the owner's address in the proxy.
- `main` is protected: pull request and green CI required, no bypass.
- Nightly database backup, with a script that proves a backup restores.
- An earlier code review fixed rate limits on the AI endpoints, the trusted
  proxy address and the double-send guard on offers.

---

*An AI-assisted audit is a first pass, not a replacement for a professional
penetration test. It can miss subtle problems.*
