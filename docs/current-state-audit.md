# Current-state audit

## Repository state

The selected repository is `IrregDraken/draken.io-backend`. Its current remote history contains two commits: the Draken backend foundation commit `ca16674` and a later commit `8c6fd7a` that adds a separately scoped Harold's Place restaurant ordering platform.

The root project is a TypeScript ESM Fastify backend. The root contains no frontend application. It has Supabase migration/configuration, a small API surface, Telegram support, integration interfaces, unit tests, and Docker configuration.

## Root Draken backend classification

| Area                 | State                               | Evidence                                                                                                                                  |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP server          | Working at baseline                 | Fastify app composition and health/auth/company routes; compiler and 18 tests pass                                                        |
| Supabase persistence | Implemented but unverified          | Migration and repository exist; no Supabase credentials, CLI, or live database in this environment                                        |
| Authentication       | Partially working                   | JWT validation boundary exists; registration, login, logout, session persistence, and recovery routes are absent                          |
| Authorization        | Partially working                   | Membership checks and RLS exist; role-based mutation policy and administrative provisioning are incomplete                                |
| AI providers         | Missing live adapters               | Provider-neutral interface and explicit unavailable adapters exist; orchestration only delegates to an unavailable provider               |
| AI employees         | Data model only                     | Employee fields exist, but no agent lifecycle, assignment engine, activity/performance model, or agent execution loop exists              |
| Missions             | Minimal read/event model            | Mission table exists; mission creation, lifecycle transitions, planning, assignment, progress, outputs, and failure handling are absent   |
| Tasks                | Minimal table                       | Task table exists; dependencies, priority, retries, execution, logs, outputs, and backend task engine are absent                          |
| Events               | Append-only route/model             | Events table and append endpoint exist; no durable bus/queue, consumers, or replay/idempotency layer exists                               |
| Message bus          | Missing                             | No Redis, queue, or reliable component communication layer is present                                                                     |
| Tool system          | Missing                             | No tool registry, tool schemas, permission assignments, or tool execution audit model is present                                          |
| Telegram             | Adapter implemented but unconnected | Real Bot API client and commands exist; no token or authorized user IDs were present                                                      |
| GitHub               | Interface-only                      | No real repository inspection/issue/commit adapter exists                                                                                 |
| Frontend             | Missing at root                     | No root Vite/React or other Draken UI application exists                                                                                  |
| Settings/admin       | Missing                             | No settings routes/UI, onboarding, owner/admin workflows, or profile lifecycle routes exist                                               |
| Logging              | Partially working                   | Structured Pino logging and redaction exist; mission/task/tool correlation and durable log records are absent                             |
| Tests                | Baseline passing but incomplete     | 6 test files and 18 tests cover current foundation only; no mission/task/agent/tool/database integration suite exists                     |
| Deployment           | Partial                             | Dockerfile and health endpoints exist; CI/CD for the root service, migration execution, and live deployment verification are absent       |
| Documentation        | Partial                             | README, architecture, Telegram research, and prior implementation report exist; they describe a foundation rather than a complete product |

## Harold's Place subtree

`harolds_place/` is documented as a separate restaurant ordering product with its own Flask backend, customer web app, Flutter staff app, Alembic migration, Docker Compose file, and GitHub Actions workflow. It is unrelated to the Draken Industries operating system and should not be rewritten as part of this work unless the user explicitly changes scope.

## Baseline verification

The root compiler passed with `./node_modules/.bin/tsc --noEmit -p tsconfig.json`. The root Vitest suite passed with 6 files and 18 tests. These results establish that the existing foundation is buildable, not that the requested complete product exists.

## Immediate conclusion

The main verified gap is not a single bug. The repository contains a sound but intentionally minimal backend foundation and no Draken frontend. Completing the requested product requires extending the schema and API with departments, mission lifecycle, task engine, tool registry/execution, durable event communication, auth lifecycle, and administration, then adding a real root frontend that reads and mutates backend state rather than displaying static dashboard data.

## Browser QA checkpoint

The compiled backend served the frontend at `http://127.0.0.1:3000/`. The login page rendered with the Draken dark navy/gold visual system, clear contrast, responsive two-column composition, secure-session copy, and functional email/password fields. Clicking the registration toggle changed the view to a four-field signup form with the expected copy that authenticated accounts do not see company data until membership is granted. No fake company data was displayed.

## Product-expansion checkpoint

The root project now includes a versioned React/Vite frontend under `frontend/`, built into ignored `public/` by `pnpm build:product` and by the multi-stage Dockerfile. The backend now includes auth lifecycle routes, product repository and routes, task engine, tool registry/execution service, durable outbox message bus, command-center structured planning, live OpenAI-compatible/Anthropic/Gemini adapters, authenticated GitHub operations, Resend email, Zapier webhooks, Docker sandbox HTTP jobs, global rate limiting, and a CI workflow.

The final quality gate passed: `pnpm typecheck:all`, `pnpm test` with 7 files and 21 tests, and `pnpm build:product`. The final runtime smoke test returned HTTP 200 for liveness and the static frontend, HTTP 503 for readiness because Supabase and most optional integrations were unconfigured, and HTTP 503 `authentication_unconfigured` for protected identity access. The sandbox OpenAI-compatible base URL was reachable through the configured base URL; its credential was not sent to `api.openai.com`.

The Docker CLI and Supabase/PostgreSQL CLI were unavailable, so image build and live migration application remain deployment-owner steps. The frontend login and signup views were visually inspected in the browser and rendered successfully with the intended dark navy/gold command-room layout.

## Verified 2026-09-03 audit addendum

This addendum supersedes the historical repository-state claims above where they conflict with the current checkout. The current starting commit is `91a17345671dda145fb20fcb41e22131d7f590e9` on `main`.

### A. What currently works

The checked-out root is a TypeScript ESM Node.js 22 Fastify backend with a React/Vite frontend under `frontend/`. `src/app.ts` wires health, auth lifecycle, company/resource, product, GitHub, command, worker, public showcase, and Telegram routes. The backend includes Zod configuration validation, Helmet, CORS allow-listing, rate limiting, structured Pino logging with secret redaction, Supabase clients/repositories, company membership enforcement, and versioned Supabase migrations with RLS policies.

The product layer currently includes domain and persistence support for companies, projects, missions, tasks, departments, workers, activity, inbox, decisions, evaluations, templates, tools, and orchestration records. The worker runtime keeps worker identity separate from AI provider identity, assembles approved runtime context, records runs and status transitions, and does not claim external model fine-tuning or real-world execution without configured tools and credentials.

The AI provider abstraction has configured OpenAI-compatible, Anthropic, and Gemini adapters, with missing credentials represented as unconfigured states. Telegram polling/webhook handling, authenticated GitHub operations, external integration adapters, and tool execution boundaries are implemented. The frontend reads API state and presents loading, empty, error, and unconfigured states instead of invented company data. The separate `harolds_place/` subtree remains outside this architecture.

### B. Incomplete or externally dependent systems

Live Supabase migration/RLS/authentication tests require a real Supabase project and credentials. AI, Telegram, GitHub, Resend, Zapier, and Docker-sandbox operations require deployment credentials and/or reachable services. There is no safe default company owner or automatic company provisioning. There is no production scheduler or generalized durable workflow runner, and R.U.N.E persistent memory/orchestration is future scope.

Docker packaging is statically present but was not run because Docker is unavailable in this sandbox. Readiness may perform remote health checks when integrations are configured, so it should be treated as an operational dependency signal rather than a substitute for deployment probes.

### C. Problems found and disposition

The principal issue found was documentation drift: the earlier body described a pre-frontend/pre-worker state and contradicted the current source tree. This addendum records the current state and is the authoritative correction for handoff. No broken imports, hardcoded secrets, or source-level architectural defect justified a rewrite. The failed `pnpm install --frozen-lockfile` created an untracked `pnpm-workspace.yaml` only because this sandbox rejects the `esbuild` build script; that generated artifact was removed and is not a repository change.

### D. Prioritized plan

**Critical:** apply migrations in a disposable Supabase project; exercise auth, memberships, RLS, and representative company/worker routes; configure deployment secrets through a secret manager.

**Important:** add route-level integration tests against Supabase fixtures, document first-owner/company provisioning and frontend build/deploy steps, and keep this audit synchronized with implementation reports.

**Future:** add policy-backed scheduling/workflows, persistent context and memory with a retention model, broader approval-backed tool orchestration, and R.U.N.E capabilities incrementally. Do not add these as empty placeholders.

### Verification evidence for this checkout

Direct installed-binary checks passed: Prettier formatting, ESLint, TypeScript typecheck, Vitest, and TypeScript build. Vitest reported **8 test files and 25 tests passed**. The normal pnpm command is currently blocked before execution by the sandbox's `ERR_PNPM_IGNORED_BUILDS` policy for `esbuild`; this is recorded as an environment limitation rather than masked by changing project dependency policy. Supabase and Docker remain unverified external-environment steps.

### Next-agent rules

Preserve Fastify, TypeScript, Supabase, the provider abstraction, company membership boundaries, and the existing frontend. Treat migrations/RLS as authoritative. Keep AI credentials in environment variables. Do not claim live integrations or autonomous execution without evidence. Keep `harolds_place/` separate. Update this audit and `docs/implementation-report.md` whenever verified scope changes.
