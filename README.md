# Draken Industries

Draken Industries is a private company operating system for authenticated company work. The repository contains a TypeScript ESM Fastify backend, Supabase persistence and authorization, a same-product React/Vite frontend, explicit mission and task lifecycle APIs, a durable outbox-style message bus, a permission-aware tool registry, provider adapters, and real external integration seams.

The product follows one operating rule: **a capability is never represented as working until its credentials, adapter, authorization boundary, and verified runtime path exist**. Empty company tables remain empty. Unconfigured providers surface as unconfigured rather than returning invented activity, employees, missions, or results.

## Repository shape

| Path | Purpose |
| --- | --- |
| `src/` | Fastify API, authentication, repositories, orchestration, task engine, integrations, and routes |
| `supabase/migrations/` | Initial foundation and product-completion Postgres/RLS migrations |
| `frontend/` | React/Vite operating interface; builds into `public/` |
| `public/` | Generated frontend artifact served by the backend when present |
| `docs/` | Architecture, research notes, implementation reports, and current-state audit |
| `harolds_place/` | Separate restaurant ordering product; not modified by Draken product work |

## Local setup

Use Node.js 20 or later and pnpm. Install backend dependencies from the repository root, copy `.env.example` to `.env`, and keep all server secrets outside the frontend directory.

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm build
```

Build the frontend separately:

```bash
cd frontend
pnpm install
pnpm check
pnpm build
cd ..
NODE_ENV=production WEB_DIR=public pnpm start
```

The backend serves `public/index.html` and its generated assets when `WEB_DIR` contains a built frontend. In development, run `pnpm dev` for the API and `cd frontend && pnpm dev` for Vite’s frontend server; Vite proxies `/api` and `/health` to the backend.

## Supabase

Provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` together. The anon client validates user tokens, while the service-role client performs trusted server-side reads and writes. The service-role key must never be bundled into the browser or exposed through API responses.

Apply migrations with the Supabase CLI after linking the intended project:

```bash
pnpm db:push
```

The migrations create no business records. A company owner must provision a company membership, employees, and any integration authorization through a controlled administrative workflow before company data is visible.

## Authentication and authorization

The browser uses Supabase access tokens through the backend’s lifecycle endpoints. Company routes validate the token, load memberships, and enforce membership again for the requested company. RLS policies use `auth.uid()` and the company membership function as a second boundary.

| Route | Behavior |
| --- | --- |
| `POST /api/v1/auth/signup` | Creates a Supabase account and optional profile |
| `POST /api/v1/auth/login` | Returns a Supabase session |
| `POST /api/v1/auth/logout` | Invalidates the local user-scoped session |
| `POST /api/v1/auth/password-reset` | Requests Supabase recovery email |
| `GET /api/v1/auth/session` | Validates the current bearer token |
| `PATCH /api/v1/auth/profile` | Updates the authenticated operator profile |
| `GET /api/v1/me` | Returns identity and active memberships |

An authenticated user without a company membership is shown an explicit onboarding state. The backend does not silently create a company or assign access.

## Product APIs

The API now exposes real company-scoped surfaces for the operating system:

| Area | Routes |
| --- | --- |
| Company | `GET /api/v1/companies/:companyId`, `GET /summary`, `POST /events` |
| Departments | `GET/POST /api/v1/companies/:companyId/departments` |
| AI employees | `GET /api/v1/companies/:companyId/agents` |
| Missions | `GET/POST /api/v1/companies/:companyId/missions`, `PATCH /missions/:missionId/stage` |
| Tasks | `GET/POST /api/v1/companies/:companyId/tasks`, status, start, retry, complete, fail, and dependency endpoints |
| Activity | `GET /api/v1/companies/:companyId/activity` |
| Tools | `GET/POST /api/v1/companies/:companyId/tools`, plus tool-execution endpoint |
| Command center | `POST /api/v1/companies/:companyId/commands` |
| Generic resources | Allow-listed persisted resources through `/resources/:resource` |

Missions move through `created → planning → executing → review → completed`, with explicit failure and retry-to-planning paths. Tasks use guarded status transitions, dependency checks, retry limits, timestamps, output/error fields, task logs, and activity records. A task with incomplete dependencies is persisted as blocked rather than reported as executing.

The command center sends a natural-language request to a configured provider with a strict mission JSON contract. Only valid returned JSON creates a mission. The created mission is explicitly marked unassigned until an authorized operator or future agent-selection workflow assigns an employee; the system does not claim that planning is execution.

## Integrations

| Integration | Runtime state |
| --- | --- |
| OpenAI | Real Chat Completions adapter when `OPENAI_API_KEY` is present |
| Anthropic | Real Messages adapter when `ANTHROPIC_API_KEY` is present |
| Google Gemini | Real `generateContent` adapter when `GOOGLE_GEMINI_API_KEY` is present |
| Manus | Explicitly unavailable until a stable project API contract is provided |
| Telegram | Real polling/webhook adapter; requires bot token, secret settings, numeric allow-list, and DB company authorization |
| GitHub | Real authenticated repository, commits, and issue adapter when `GITHUB_TOKEN` is present |
| Resend | Real email delivery adapter when API key and verified sender are present |
| Zapier | Real webhook delivery adapter when URL is present; webhook delivery is reported per event |
| Docker sandbox | Real health/job HTTP adapter when URL and optional token are present |

Telegram polling and webhooks are mutually exclusive. Production webhook mode requires HTTPS and a secret header; local polling is intended for development. See `docs/research/telegram-integration-notes.md` and the [official Telegram Bot API reference](https://core.telegram.org/bots/api).

## Frontend

The frontend is a responsive dark command-room interface. It contains login and signup flows, explicit no-membership onboarding, company switching, overview metrics, recent events, missions, tasks, AI employees, departments, activity, system health, integrations, settings, and a natural-language command center. All company screens load from backend endpoints and show empty, loading, error, or unconfigured states instead of placeholder business data.

The visual system uses dark navy surfaces, a restrained gold action color, monospace operational labels, responsive sidebar navigation, visible focus states, and reduced-motion support. The generated UI artifact is intentionally not a source of truth; the API and Supabase state remain authoritative.

## Security and operations

The server uses Helmet, CORS allow-listing, Pino redaction for authorization/cookie/provider secrets, global rate limiting, strict Zod request validation, company membership checks, and RLS-backed database boundaries. Provider and integration error responses are intentionally short and do not echo credential values.

The production Dockerfile builds TypeScript in a builder stage and runs only compiled output. A deployment must provide a Supabase project, run the committed migrations, configure a stable public URL, provision at least one company membership, and supply only the integrations intended for that environment. Readiness is not a deployment substitute; it reports the live state of those dependencies.

## Verified limitations

This repository now contains a coherent product foundation and a usable authenticated operating interface, but some capabilities remain credential- or policy-dependent. There is no safe default company owner, no automatic company provisioning, no live external provider connection in the development environment, and no claim that an AI employee has executed a real-world task until an operator connects a provider, assigns tools, and runs the task through an authorized integration. These are deliberate boundaries rather than fabricated completeness.

The `harolds_place/` subtree remains a separately scoped restaurant ordering product. It is preserved as-is and is not part of the Draken operating system surface.

## Quality gate

Run the following from the repository root:

```bash
pnpm typecheck
pnpm test
pnpm build
cd frontend && pnpm check && pnpm build
```

The current implementation report in `docs/implementation-report.md` and the current-state audit in `docs/current-state-audit.md` record the exact verification results and environment limitations for this checkout.
