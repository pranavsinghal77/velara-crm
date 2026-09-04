# Velara CRM

AI-assisted CRM for Indian B2B sales teams. React SPA + Express/Postgres API.

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io)

---

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Security model](#security-model)
- [Features](#features)
- [API reference](#api-reference)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Known gaps](#known-gaps)

---

## Quick start

Requires Node 20+ and a Postgres database.

### 1. API server

```bash
cd server
npm install
cp .env.example .env
```

Fill in `.env`. At minimum you need `DATABASE_URL` and two different JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Run that twice, once for `JWT_ACCESS_SECRET` and once for `JWT_REFRESH_SECRET`. The
server refuses to start if either is missing, shorter than 32 characters, or if the
two are identical.

Create the schema and load demo data:

```bash
cd server
npm run db:deploy
npm run db:seed
```

`db:seed` prints a generated password for the demo accounts once. Set
`SEED_PASSWORD` first if you would rather choose it. Then:

```bash
npm run dev
```

The API listens on `http://localhost:3001`. `GET /health` reports real database
connectivity.

### 2. Web app

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173` and sign in with `admin@velara.com` plus the password
the seeder printed.

---

## Architecture

```
velara-crm/
├── src/                      # React SPA
│   ├── lib/
│   │   ├── api.ts            # the only place that talks HTTP
│   │   ├── config.ts         # env-driven API URL and feature flags
│   │   ├── motion.ts         # reduced-motion check, count-up hook
│   │   └── realtime.ts       # authenticated socket.io client
│   ├── store/useCrmStore.ts  # zustand store, optimistic writes with rollback
│   ├── components/
│   ├── pages/                # 15 route-level pages, all lazy-loaded
│   ├── types/models.ts       # wire types, mirroring the API serialisers
│   └── test/fixtures.ts      # test data (not shipped to users)
└── server/
    ├── prisma/
    │   ├── schema.prisma     # org-scoped models, real DateTime columns
    │   ├── migrations/       # versioned SQL
    │   └── seed.ts           # CLI seeder
    └── src/
        ├── config/           # validated env, pooled Prisma client
        ├── middlewares/       # auth, RBAC, validation, rate limits, errors
        ├── schemas/          # zod schemas: also the field allowlists
        ├── controllers/
        ├── routes/
        ├── services/ai.service.ts
        ├── utils/            # tokens, password, timezone maths, serialisers
        └── realtime.ts       # per-organisation socket rooms
```

**Data flow.** The browser holds no business data of its own. Every read and write
goes through `src/lib/api.ts` to the API, which scopes each query to the caller's
organisation using the `orgId` in their verified access token. The store keeps an
in-memory working copy for rendering, applies writes optimistically, and rolls them
back if the server rejects them.

**Dates.** Postgres stores real `DateTime` values. The API serialises them into the
`YYYY-MM-DD` / `HH:mm` pairs the UI works with, rendered in the organisation's
timezone (`APP_TIMEZONE`, default `Asia/Kolkata`). Fields like a reminder's
"due today" flag are computed at read time, never stored, so they cannot go stale
overnight.

**Motion.** Durations, easings and every keyframe live in the Motion section of
`src/index.css`; a component applies a class rather than picking its own curve, for
the same reason pages do not pick their own gutter. Entrances use
`animation-fill-mode: backwards` without exception — `forwards` leaves the final
keyframe applied for good, and a lingering `transform` on the page wrapper would
make it the containing block for the `position: fixed` modals that several pages
render inside it. `prefers-reduced-motion` is honoured globally, with spinners and
typing indicators exempted: a frozen progress indicator reads as a hung request.

---

## Configuration

### `server/.env`

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Use the pooled URL on serverless hosts. |
| `JWT_ACCESS_SECRET` | yes | ≥32 chars. Must differ from the refresh secret. |
| `JWT_REFRESH_SECRET` | yes | ≥32 chars. |
| `ACCESS_TOKEN_TTL` | no | Default `15m`. |
| `REFRESH_TOKEN_TTL_DAYS` | no | Default `30`. |
| `BCRYPT_ROUNDS` | no | Default `12`. |
| `PORT` | no | Default `3001`. |
| `NODE_ENV` | no | `development` \| `test` \| `production`. |
| `CORS_ORIGINS` | no | Comma-separated browser origins. Default `http://localhost:5173`. |
| `TRUST_PROXY` | no | Set `true` behind a load balancer so rate limiting sees real client IPs. |
| `APP_TIMEZONE` | no | IANA zone for business dates. Default `Asia/Kolkata`. |
| `GEMINI_API_KEY` | no | Leave blank to run without AI; AI endpoints then return `503`. |
| `GEMINI_MODEL` | no | Default `gemini-2.5-flash`. |
| `GEMINI_VISION_MODEL` | no | Default `gemini-2.5-flash`. |

### `.env` (web app)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | for production builds | e.g. `https://api.yourdomain.com/api`. The build fails without it. |
| `VITE_ENABLE_DEMO_LOGIN` | no | `true` shows demo-account shortcuts on the login screen. Leave off for real tenants. |

---

## Security model

**Authentication.** Two tokens:

- A short-lived JWT access token, returned in the login response body and held in
  memory by the SPA. Sent as `Authorization: Bearer`. It is never written to
  `localStorage`, so an XSS bug cannot steal a long-lived credential.
- An opaque refresh token in an httpOnly, Secure cookie scoped to `/api/auth`. Only
  its SHA-256 hash is stored. It rotates on every use; presenting an already-used
  token revokes that user's entire token family and forces a fresh sign-in.

Passwords are bcrypt hashes. Logins for unknown addresses spend the same time as
real ones so response timing does not reveal which emails are registered.

**Authorisation.** `requireAuth` is mounted once over the whole `/api` tree, so a
newly added route cannot accidentally ship public. Roles are ranked
Viewer < Sales < Manager < Admin:

| Action | Minimum role |
|---|---|
| Read leads, messages, reminders, team roster | Viewer |
| Create/edit leads, reminders, messages; submit field evidence | Sales |
| Delete leads, manage campaigns, broadcast notifications, view analytics | Manager |
| Manage members, roles and settings | Admin |

Deactivating a member takes effect on their next request, not whenever their token
happens to expire, and revokes their refresh tokens immediately. An organisation
cannot be left without an active admin.

**Tenancy.** Every tenant-owned row carries `orgId`, and every query is scoped by
the `orgId` from the caller's token — never from the request body. Ids from another
tenant resolve to "not found" rather than leaking existence.

**Input handling.** Every write endpoint validates against a zod schema, and
`validate()` replaces the request body with the parse result. Unknown fields are
therefore stripped before Prisma sees them: posting `{"role":"Admin"}` to a lead
update does nothing. Socket.io connections are authenticated and joined to a
server-chosen, per-organisation room.

**Rate limiting.** Tiered per user (falling back to IP): 300 req/min overall,
10 login attempts per 15 min keyed on IP + email, 20 AI calls/min, 120 writes/min.

**AI.** When Gemini is unconfigured or failing, endpoints return `503` and the UI
says so. They do not fabricate sentiment scores, compliance verdicts or pipeline
summaries. Structured responses are requested as JSON and validated against a
schema before use. Untrusted text is fenced and labelled as data in the prompt, the
knowledge base lives server-side, and CRM context is read from the database rather
than accepted from the client.

---

## Features

### Core CRM
- **Leads** — Kanban and table views, AI scoring with a visible breakdown, cursor
  pagination, server-side search and filtering.
- **Inbox** — WhatsApp, email and SMS threads per lead, smart replies, sentiment
  radar, tiered escalation dossiers.
- **Reminders** — Timezone-correct scheduling with derived today/tomorrow/overdue
  state and a calendar view.
- **Analytics** — Pipeline value, conversion rate, source mix and an eight-week
  acquisition trend, all aggregated in SQL.
- **Leaderboard** — Per-owner pipeline, win count and conversion rate.
- **Team, Documents, Social, Workflows, Support, Field Ops** — supporting modules.

### Social channels
Facebook Pages, Instagram, LinkedIn, X and WhatsApp Business, each connected by a
real OAuth authorization-code flow with single-use `state` (and PKCE for X). Tokens
are encrypted at rest, refreshed before they expire, and a platform this server
holds no client credentials for reports itself unavailable rather than showing a
green dot.

Publishing is per-target: a post carries one row per account, so one platform
rejecting the content leaves the others published and the post lands as
`PartiallyPublished` with the provider's own message on the target that failed. A
target is retried up to three times and then left alone.

Engagement is read back from each provider — likes, comments, shares, impressions,
reach — and a figure a platform does not expose is recorded as *unavailable with
the reason*, never as zero. Instagram reports no share count and LinkedIn no
impressions without the Community Management product, and the API says so instead
of showing a nought that no platform measured.

A background worker publishes scheduled posts when their time arrives, keeps tokens
alive and refreshes insights. Each due post is claimed with a conditional update
before any provider call, so two API instances cannot both publish it.

### Field operations
Campaigns, tasks and photo-based compliance checks. A submitted photo is genuinely
sent to a vision model; the verdict is written by the server, and a task stays
`aiVerified: false` if the check could not be performed. Field agents cannot write
their own compliance score.

### AI
Smart replies, sentiment and frustration scoring, escalation dossiers, a knowledge
assistant, visual compliance inspection, and a pipeline copilot grounded in a live
CRM snapshot. All optional — the app is fully usable with `GEMINI_API_KEY` unset.

---

## API reference

All routes are under `/api`. Everything except `/api/auth/login`, `/refresh` and
`/logout` requires `Authorization: Bearer <accessToken>`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{accessToken, user}` + refresh cookie |
| POST | `/auth/refresh` | Rotates the refresh cookie, returns a new access token |
| POST | `/auth/logout` | Revokes the refresh token |
| GET | `/auth/me` | Current user and organisation |
| POST | `/auth/change-password` | Revokes all other sessions |

### Resources
| Method | Path | Role |
|---|---|---|
| GET | `/leads` | Viewer. `?limit&cursor&status&isHot&search&ownerId` |
| GET/POST | `/leads`, `/leads/:id` | Sales to write |
| PUT/DELETE | `/leads/:id` | Sales / Manager to delete |
| GET/POST | `/messages` | `?leadId&unreadOnly` |
| PUT | `/messages/:id/read`, `/messages/read-all` | |
| GET/POST | `/reminders` | `?completed&from&to` |
| PUT/DELETE | `/reminders/:id`, `/reminders/:id/toggle` | |
| GET | `/notifications` | Own + org broadcasts only |
| POST | `/notifications` | Manager |
| GET | `/users` | Viewer |
| POST/PUT | `/users`, `/users/:id`, `/users/:id/toggle-active` | Admin |
| GET | `/analytics/overview`, `/trend`, `/leaderboard` | |
| GET | `/field-campaigns` | |
| POST | `/field-campaigns`, `/field-campaigns/tasks` | Manager |
| PUT | `/field-campaigns/tasks/:id` | Sales |

### Social
| Method | Path | Role |
|---|---|---|
| GET | `/social/providers`, `/social/connections` | Viewer |
| POST | `/social/connect/:platform` | Admin. Returns the consent URL |
| GET | `/social/callback/:platform` | Unauthenticated; proven by `state` |
| DELETE/PUT | `/social/connections/:id`, `/:id/default`, `/:id/verify` | Admin |
| GET/POST | `/social/posts` | Sales to write |
| POST | `/social/posts/:id/publish`, `/social/posts/run-due` | Sales |
| DELETE | `/social/posts/:id` | Cancels a schedule; refuses a live post |
| GET | `/social/insights` | Stored figures only; never calls a provider |
| POST | `/social/insights/refresh` | Fetches now, subject to the staleness floor |
| GET | `/social/ideas` | Suggestions from the tenant's own best posts |

### AI
`GET /ai/status`, and `POST` to `/ai/smart-reply`, `/ai/sentiment-analysis`,
`/ai/escalate`, `/ai/knowledge-query`, `/ai/visual-compliance`, `/ai/chat`.

List endpoints return `{data, nextCursor}`. Errors return
`{success: false, error: {code, message, details?}}`.

---

## Scripts

### Web app
| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck (strict) then build |
| `npm run lint` | ESLint over app and server |
| `npm test` | Vitest watch |
| `npm run test:run` | Vitest once |

### Server (`cd server`)
| Script | Purpose |
|---|---|
| `npm run dev` | tsx watch on :3001 |
| `npm run build` / `start` | Compile to `dist/`, run it |
| `npm run typecheck` | tsc, no emit |
| `npm test` | Vitest once |
| `npm run db:deploy` | Apply migrations (use in CI/production) |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:seed` | Load demo data. `--reset` clears the demo org first |
| `npm run db:studio` | Prisma Studio |

---

## Deployment

**API.** Any Node host. `npm ci && npm run build && npm run db:deploy && npm start`.
Set `NODE_ENV=production`, `TRUST_PROXY=true` behind a proxy, and `CORS_ORIGINS` to
your web app's exact origin. In production the refresh cookie is issued with
`Secure` and `SameSite=None`, so the API must be served over HTTPS.

**Web app.** `VITE_API_URL=https://api.yourdomain.com/api npm run build`, then serve
`dist/`. `vercel.json` carries the SPA rewrite, security headers and immutable
caching for hashed assets.

---

## Known gaps

Honest list of what is not done:

- **`@google/generative-ai` is the legacy Gemini SDK.** It works, but Google's
  successor package is the long-term home. Model ids are configurable via
  `GEMINI_MODEL`; verify the default against the current model list for your key.
- **No email delivery.** Inviting a member sets a temporary password that an admin
  has to communicate out of band. There is no password-reset flow.
- **The Documents, Workflows and Social pages are not yet wired to their
  backends.** Those APIs exist and are tested — storage, automation runs,
  publishing and insights — but several panels still render local component state,
  and the social performance panels still show the arrays they shipped with,
  labelled "sample data". The wiring is the remaining work, not the backend.
- **No inbound social webhooks.** Comments and DMs are not ingested, so the Inbox
  covers WhatsApp, email and SMS but not replies on a published post. Publishing
  and insights are outbound only.
- **No PWA.** There is no service worker or manifest, despite the mobile-first
  layout.
- **Field photos are stored as base64 in Postgres.** Fine for light use; move to
  object storage before real volume.
- **`permissions[]` is stored and displayed but not enforced.** Authorisation is by
  role today; the per-permission checks are not wired up.
- **No integration tests against a live database.** The suites cover the API client,
  store behaviour, timezone maths, serialisation, validation schemas and password
  hashing — all without a database.

---

## License

MIT
