# Draken Industries Backend

This repository contains the backend foundation for Draken Industries. It is an API-first TypeScript service with Supabase persistence and authentication, company-level authorization, provider-neutral AI orchestration seams, company chat and event data models, and a real Telegram integration that is disabled until credentials and authorization mappings are configured.

No fake companies, employees, missions, tasks, messages, or activity are seeded. A capability is reported as **unconfigured**, **pending**, or **unavailable** until it has a real credential and a verified implementation.

## Local setup

Install Node.js 20 or later, copy `.env.example` to `.env`, and provide all three Supabase values if Supabase is being used. Install dependencies with `pnpm install`, compile with `pnpm build`, and run the service with `pnpm dev`.

The migration is in `supabase/migrations/202608140001_initial_foundation.sql`. With the Supabase CLI installed and linked to a project, apply it with `pnpm db:push`. The migration assumes the standard Supabase `auth.users` table exists. It creates no business records.

## Authentication and authorization

API requests use a Supabase access token:

```text
Authorization: Bearer <supabase-access-token>
```

The backend validates the token through Supabase Auth, loads active company memberships, and checks membership again for company routes. Postgres row-level security policies also use `auth.uid()` and `public.is_company_member(company_id)`. The service-role key is server-only and must never be exposed to a browser.

## Telegram

Telegram is disabled by default. For local development, set `TELEGRAM_MODE=polling`, configure `TELEGRAM_BOT_TOKEN`, and populate `TELEGRAM_AUTHORIZED_USER_IDS` with numeric IDs. Each allow-listed Telegram user must also have an active row in `telegram_authorizations` for a company, and the mapped company must have an active `company_memberships` record. The allow-list and database mapping are both required.

For production, set `TELEGRAM_MODE=webhook`, provide an HTTPS `TELEGRAM_WEBHOOK_URL`, and configure `TELEGRAM_WEBHOOK_SECRET`. The backend registers the webhook at startup and validates `X-Telegram-Bot-Api-Secret-Token` on every webhook request. Polling and webhooks are never started together.

The implemented commands are `/start`, `/help`, `/ping`, and `/status`. The status command reads current health and company counts from the backend. Empty tables produce zero counts; no data is invented.

## HTTP routes

| Route | Access | Behavior |
| --- | --- | --- |
| `GET /health/live` | Public | Process liveness |
| `GET /health/ready` | Public | Supabase and integration readiness; returns 503 when not fully ready |
| `GET /api/v1/me` | Supabase JWT | Current user and active company memberships |
| `GET /api/v1/companies/:companyId` | JWT + membership | Company metadata |
| `GET /api/v1/companies/:companyId/summary` | JWT + membership | Real entity counts and recent events |
| `POST /api/v1/companies/:companyId/events` | JWT + membership | Append a company event |
| `GET /api/v1/companies/:companyId/resources/:resource` | JWT + membership | Read persisted records for roles, employees, missions, projects, tasks, channels, messages, threads, events, notifications, integrations, AI providers, or orchestration runs |
| `POST /integrations/telegram/webhook` | Telegram secret when configured | Receive Telegram updates |

## Integration status

Telegram has a real Bot API adapter for `getMe`, `sendMessage`, `getUpdates`, `setWebhook`, `deleteWebhook`, and `getWebhookInfo`. GitHub, Resend/email, Zapier, and Docker sandbox have explicit interfaces and truthful unavailable adapters. AI provider entries for OpenAI, Anthropic, Google Gemini, and Manus are registered behind the `AIProvider` interface, but no live model adapter is claimed connected by this foundation.

## Validation

Run `pnpm typecheck` for static validation and `pnpm test` for automated tests. The final implementation report records the exact commands and results executed in the current environment.
