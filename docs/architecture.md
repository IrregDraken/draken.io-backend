# Draken Industries backend architecture

## Scope

This repository is the backend foundation for Draken Industries. It is intentionally API-first and contains no seeded companies, employees, missions, tasks, conversations, or pretend integration records. Any capability that lacks credentials or a verified external connection is represented as unavailable or unconfigured.

## Runtime boundary

The runtime is a strict TypeScript ESM service built on Fastify. Fastify provides the HTTP boundary and request lifecycle, while Supabase provides Postgres persistence and Supabase Auth. The HTTP layer delegates to domain services and repository ports; business logic does not call Telegram, AI providers, email vendors, GitHub, Zapier, or Docker directly.

The service uses two Supabase client modes. The user-scoped client is created with the incoming bearer token and is used to validate authenticated identity. The trusted service-role client is used only for server-side data access after the authenticated user or authorized Telegram user has been mapped to a company membership. Service-role credentials are never sent to clients.

## Security model

Browser/API access requires a valid Supabase JWT in the `Authorization: Bearer <token>` header. Company authorization is enforced by membership lookup and by Postgres row-level security policies. Telegram access additionally requires a configured numeric Telegram user ID allow-list; a bot token alone never grants company access. A Telegram user must be both allow-listed and mapped to an active company membership before company commands can read private state.

Telegram webhook requests can require the `X-Telegram-Bot-Api-Secret-Token` header. The webhook endpoint rejects missing or mismatched values when a secret is configured. Polling and webhook modes are mutually exclusive at the Telegram API level, so the runtime exposes an explicit mode and does not start both transports.

## Domains and persistence

The database migration models the following bounded domains: authentication and memberships, companies, employees and roles, missions and projects, tasks, channels and messages, threads and reactions, events and notifications, integrations, AI providers, and orchestration runs. Domain identifiers are UUIDs. Timestamps are UTC `timestamptz` values. All company-owned tables include `company_id`, foreign keys, indexes, and row-level security policies.

## Integration contracts

The integration ports are deliberately small and provider-neutral:

| Contract | Responsibility | Initial state |
| --- | --- | --- |
| `NotificationService` | Deliver a notification through an external channel | Telegram adapter implemented; email adapter returns unavailable until configured |
| `TelegramGateway` | Send messages, receive updates, configure webhook, and inspect health | Implemented with real Bot API calls when credentials exist |
| `AIProvider` | Generate model output through a provider adapter | Registry and adapters are explicit; no provider is claimed connected without credentials and a successful health check |
| `GitHubIntegration` | Provide a seam for repository activity | Interface only, unavailable until credentials and implementation are added |
| `EmailIntegration` | Provide a seam for Resend or another email provider | Interface only, unavailable until credentials and implementation are added |
| `ZapierIntegration` | Deliver outbound automation events | Interface only, unavailable until a webhook is configured |
| `DockerSandboxIntegration` | Execute isolated sandbox jobs | Interface only, unavailable until a sandbox endpoint is configured |

Employee identity is separate from provider identity. An employee record stores a display name and a provider reference, while `ai_providers` stores provider configuration metadata. The orchestrator depends on `AIProvider` and never hardcodes provider behavior into mission or task code.

## HTTP API boundary

The initial API is intentionally small and truthful:

| Route | Authentication | Purpose |
| --- | --- | --- |
| `GET /health/live` | Public | Process liveness only |
| `GET /health/ready` | Public | Database and configured integration readiness |
| `GET /api/v1/me` | Supabase JWT | Authenticated identity and company memberships |
| `GET /api/v1/companies/:companyId` | Supabase JWT + membership | Company metadata |
| `GET /api/v1/companies/:companyId/summary` | Supabase JWT + membership | Real counts and recent activity, with empty values when no records exist |
| `POST /api/v1/companies/:companyId/events` | Supabase JWT + membership | Append a company event through the event service |
| `POST /integrations/telegram/webhook` | Telegram secret header when configured | Receive Telegram updates |

## Operational principles

Structured logs use Pino and redact authorization headers, cookies, bot tokens, and provider keys. Health checks report `ok`, `unconfigured`, or `error`; they do not invent business counts. Database migrations are committed under `supabase/migrations`. Local polling is opt-in through `TELEGRAM_MODE=polling`, while production webhooks use an HTTPS URL and a secret token.
