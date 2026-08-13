# Draken Industries backend implementation report

**Author:** Manus AI
**Repository:** `IrregDraken/draken.io-backend`
**Implementation date:** 14 August 2026
**Starting state:** The selected repository was empty: no commits, source files, dependencies, Supabase configuration, deployment configuration, or existing application code were present.

## Executive summary

A complete backend foundation was created inside the existing repository. The implementation is a strict TypeScript ESM service using Fastify for HTTP, Supabase Auth and Postgres for authentication and persistence, Postgres row-level security for company boundaries, Pino for structured logging, and an explicit integration-port design.

Telegram is the first real external adapter. The adapter implements Bot API calls for bot health, messages, polling, webhook configuration, webhook inspection, and deletion. The command service implements `/start`, `/help`, `/ping`, and `/status`. Access requires both a configured Telegram user-ID allow-list and an active database authorization mapping to a company; a bot token alone is insufficient.

No fake companies, AI employees, missions, tasks, messages, activity, or integration responses were seeded. Because no Supabase or Telegram credentials were present in the execution environment, neither external service was claimed as connected. The readiness endpoint reports these components as `unconfigured`, and the final smoke test confirmed that behavior.

## Architecture created

The backend is divided into the following boundaries:

| Boundary | Implementation | Responsibility |
| --- | --- | --- |
| HTTP runtime | Fastify 5 | Secure HTTP server, routing, request lifecycle, JSON responses |
| Authentication | Supabase Auth client | Validate bearer JWTs and derive authenticated users |
| Authorization | `CompanyRepository`, `requireMembership`, Postgres RLS | Require active company membership at both application and database layers |
| Persistence | Supabase Postgres | Company-scoped domain models and migrations |
| Domain services | `HealthService`, `TelegramCommandService`, `OrchestratorService` | Business behavior independent of vendor clients |
| AI boundary | `AIProvider` and `AIProviderRegistry` | Provider-neutral abstraction for OpenAI, Anthropic, Google Gemini, and Manus |
| Notifications | `NotificationService` | Channel-neutral notification contract; Telegram is implemented, email remains unavailable |
| External integrations | GitHub, email/Resend, Zapier, Docker sandbox interfaces | Explicit seams and truthful unavailable adapters |
| Observability | Pino plus Fastify logging | Structured logs with secret redaction |
| Deployment | Dockerfile, `.env.example`, Supabase migration/config | Reproducible build and explicit runtime configuration |

The orchestrator communicates through the `AIProvider` interface. Employee identity is kept separate from provider identity: an employee stores display name, role, department, personality, system instructions, capabilities, permissions, status, and current assignment, while `ai_providers` stores provider metadata and status.

Telegram update delivery was implemented with explicit polling and webhook modes. Telegram documents `getUpdates` and webhooks as mutually exclusive update-delivery methods, and webhook requests can be protected with the `X-Telegram-Bot-Api-Secret-Token` header [1]. A current deployment guide also confirms long polling as the simpler local-development option and HTTPS webhooks as the public deployment option [2].

## Files created

| Area | Files |
| --- | --- |
| Project and deployment | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `Dockerfile`, `.dockerignore`, `.env.example`, `.gitignore`, `README.md` |
| Architecture and research | `docs/architecture.md`, `docs/research/telegram-integration-notes.md`, `docs/implementation-report.md` |
| Runtime and configuration | `src/app.ts`, `src/server.ts`, `src/config.ts`, `src/logger.ts`, `src/supabase.ts`, `src/domain.ts`, `src/types.d.ts` |
| Authentication and persistence | `src/auth.ts`, `src/repositories/companyRepository.ts` |
| AI and external interfaces | `src/integrations/ai.ts`, `src/integrations/external.ts`, `src/services/orchestrator.ts` |
| Telegram | `src/integrations/telegram.ts`, `src/services/telegramService.ts`, `src/routes/telegram.ts` |
| Health and API routes | `src/services/health.ts`, `src/routes/health.ts`, `src/routes/auth.ts`, `src/routes/company.ts`, `src/routes/resources.ts` |
| Database | `supabase/config.toml`, `supabase/migrations/202608140001_initial_foundation.sql` |
| Tests | `tests/app.test.ts`, `tests/auth.test.ts`, `tests/config.test.ts`, `tests/health.test.ts`, `tests/integrations.test.ts`, `tests/telegram.test.ts` |

No pre-existing files were modified because the repository was empty at the start.

## Database tables and models

The migration creates the following tables. Every company-owned table has a `company_id` foreign key, indexes, and row-level security policies. The migration creates no rows.

| Domain | Tables |
| --- | --- |
| Company and auth | `companies`, `company_memberships`, `roles` |
| AI employees | `employees`, `ai_providers` |
| Work management | `missions`, `projects`, `tasks` |
| Company chat | `channels`, `channel_participants`, `messages`, `threads`, `thread_messages`, `message_reactions` |
| Events and notifications | `events`, `notifications` |
| Integrations | `integrations`, `telegram_authorizations` |
| Orchestration | `orchestration_runs` |

The schema includes status enums, timestamps, update triggers, foreign-key deletion behavior, partial uniqueness for nullable user/employee participants and reactions, and a global uniqueness constraint for Telegram user authorization to prevent ambiguous company mapping.

## API routes

| Route | Authentication | Result |
| --- | --- | --- |
| `GET /health/live` | Public | Process liveness; returns `200` when the process is running |
| `GET /health/ready` | Public | Supabase and integration readiness; returns `503` when dependencies are unconfigured or failing |
| `GET /api/v1/me` | Supabase JWT | Authenticated user and active company memberships |
| `GET /api/v1/companies/:companyId` | Supabase JWT plus active membership | Company metadata |
| `GET /api/v1/companies/:companyId/summary` | Supabase JWT plus active membership | Real counts for employees, missions, projects, tasks, channels, messages, notifications, and recent events |
| `POST /api/v1/companies/:companyId/events` | Supabase JWT plus active membership | Append a company event |
| `GET /api/v1/companies/:companyId/resources/:resource` | Supabase JWT plus active membership | Read records for the explicit resource allow-list: roles, employees, missions, projects, tasks, channels, messages, threads, events, notifications, integrations, AI providers, and orchestration runs |
| `POST /integrations/telegram/webhook` | Telegram secret header when configured | Receive and process Telegram updates |

## Authentication and authorization implementation

API requests require `Authorization: Bearer <supabase-access-token>`. The backend validates the token through Supabase Auth. It then loads active company memberships and places the identity and memberships in the request context.

Company routes call `requireMembership` before reading or writing company data. The migration also enables row-level security for all company-owned tables and defines `public.is_company_member(company_id)` using the authenticated Supabase user ID. This means an application-layer mistake is not the only security boundary.

The service-role key is used only by server-side repository operations and is never returned to clients. The `.env.example` and `.gitignore` files keep secrets out of version control. Structured logging redacts authorization headers, cookies, bot tokens, and provider keys.

## Telegram implementation

The adapter includes real HTTP calls to Telegram Bot API methods `getMe`, `sendMessage`, `getUpdates`, `setWebhook`, `deleteWebhook`, and `getWebhookInfo`. `TelegramNotificationService` implements the channel-neutral `NotificationService` contract on top of that client. It supports:

| Capability | Implementation state |
| --- | --- |
| Local polling | Implemented and enabled only with `TELEGRAM_MODE=polling` |
| Production webhook | Implemented and enabled only with `TELEGRAM_MODE=webhook` and an HTTPS URL |
| Secret-header validation | Implemented through `X-Telegram-Bot-Api-Secret-Token` |
| User allow-list | Implemented through `TELEGRAM_AUTHORIZED_USER_IDS` |
| Company mapping | Implemented through `telegram_authorizations` plus an active company membership |
| `/start`, `/help`, `/ping` | Implemented |
| `/status` | Implemented using live health and database counts; no fake business state |
| Duplicate transport prevention | Implemented by explicit mutually exclusive mode and one polling loop |

When an unauthorized user sends a command, the service denies access without exposing company data. When a user is present in the environment allow-list but has no active company mapping, the service denies company functionality and states that the mapping is missing.

## Environment variables required

The complete template is in `.env.example`.

| Variable group | Variables | Required state |
| --- | --- | --- |
| Server | `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `CORS_ORIGINS` | Server defaults are provided; production should set explicit values |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required together for database-backed API use |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_AUTHORIZED_USER_IDS`, `TELEGRAM_MODE` | Required for a live Telegram connection; user IDs are never hardcoded |
| Telegram webhooks | `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET` | Required for production webhook mode |
| External integration seams | `GITHUB_TOKEN`, `RESEND_API_KEY`, `ZAPIER_WEBHOOK_URL`, `DOCKER_SANDBOX_URL` | Optional; blank values are reported as unconfigured |
| AI provider seams | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `MANUS_API_KEY` | Optional; credentials alone do not claim a live adapter |

## Tests executed and results

The following commands were executed against the repository:

| Command | Result |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | Passed |
| `./node_modules/.bin/vitest run` | Passed: 6 test files, 18 tests |
| `./node_modules/.bin/tsc -p tsconfig.json` | Passed; production output generated under ignored `dist/` |
| Compiled-server smoke test with `NODE_ENV=test TELEGRAM_MODE=disabled LOG_LEVEL=error` | Passed: `/health/live` returned `200`, `/health/ready` returned `503` with truthful `unconfigured` components, and `/api/v1/me` returned `503` with `authentication_unconfigured` |

The test suite covers configuration validation, Supabase authentication boundary behavior, company membership authorization, Telegram allow-list and command behavior, Telegram webhook secret validation, update normalization, health checks, explicit AI-provider unavailability, and Fastify HTTP routes.

The environment did not include the Supabase CLI, PostgreSQL client, or Docker binary, so the SQL migration was not applied against a live local database in this session. It was reviewed statically and is committed for application through a linked Supabase project.

## Integrations ready for credentials

Supabase is ready for project URL and key configuration, followed by migration application. Telegram is ready for a real bot token, an explicit numeric allow-list, a database authorization mapping, and either local polling or an HTTPS webhook deployment. Its notification adapter is available through the `NotificationService` interface.

GitHub, Resend/email, Zapier, and Docker sandbox have named interfaces and health-state seams, but their live adapters are intentionally pending. OpenAI, Anthropic, Google Gemini, and Manus have provider-neutral registry entries and explicit unavailable adapters, but no live model adapter is claimed connected.

## Integrations actually connected

**None were connected in this execution.** The environment check found all Supabase and Telegram variables absent. The implementation therefore reports external dependencies as unconfigured rather than inventing successful connectivity.

## Remaining backend work

The next implementation steps are to apply the migration to the target Supabase project, configure Supabase Auth settings and initial company memberships through an administrative provisioning flow, insert explicit Telegram authorization mappings, and perform a real Telegram smoke test with the intended bot. Live adapters for AI providers, GitHub activity, Resend/email, Zapier, and Docker sandbox remain to be implemented when their operational contracts and credentials are supplied.

Production hardening should also add rate limiting, request correlation IDs, audit-log retention policy, secret rotation procedures, and an administrative membership-provisioning workflow. These were not silently invented because no product or operational requirements for them were supplied.

## Blockers and assumptions

The repository was empty, so TypeScript/Fastify/Supabase was selected as the new backend foundation rather than adapting an existing framework. No Supabase project URL, keys, Telegram bot token, authorized user IDs, webhook URL, or webhook secret were available. The current implementation intentionally stops at a credential-gated, test-verified foundation.

The Telegram authorization model assumes one Telegram user maps to one company, enforced by a database uniqueness index, because the required commands do not include company selection. If a user must operate across multiple companies, the schema and command protocol should be extended explicitly rather than guessing.

## References

[1]: https://core.telegram.org/bots/api "Telegram Bot API"
[2]: https://grammy.dev/guide/deployment-types "grammY: Long Polling vs. Webhooks"
