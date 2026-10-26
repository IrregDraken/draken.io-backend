# Discord integration design

**Status:** Proposed implementation contract  
**Scope:** Draken Industries Discord headquarters and individual employee bot identities  
**Repository:** `IrregDraken/draken.io-backend`

## 1. Product decisions

- Discord is an interaction surface for Draken Industries, not the source of truth for employees, memory, tasks, permissions, or orchestration.
- Each employee has one durable Draken employee record and may have one or more external communication identities.
- Approach A is selected: each Discord-facing employee has an individual Discord application and bot user.
- No ordinary human Discord accounts are required for AI employees.
- R.U.N.E remains the executive coordinator and the same persistent identity across interfaces. It does not impersonate or suppress other employees.
- The first integration cohort is R.U.N.E, Marcus, and Victor. Aaron, Nadia, and Amara are defined in the employee roster but remain inactive until deliberately activated.
- Four additional employee positions remain reserved. The initial six-person roster is R.U.N.E plus five named employees.
- Preserve the existing `employees` identity, worker runtime, provider abstraction, permissions, memory, versions, and company scoping. Extend additively.

## 2. Existing backend seams confirmed by source inspection

- `employees` is already the durable worker identity.
- `WorkerRepository` creates and loads employee records and runtime context.
- `WorkerRuntimeService` executes a worker through the configured provider and records worker runs/status.
- Worker configuration already includes personality, responsibilities, operating principles, permissions, autonomy, skills, memory, knowledge, and version snapshots.
- `src/app.ts` composes Fastify, Supabase repositories, worker runtime, and Telegram integration.
- The Telegram adapter is a useful reference for webhook validation and channel separation.
- There is no Discord integration in the inspected source tree.
- The message-bus persistence described in repository documentation must not be mistaken for a running consumer. The technical-debt report identifies the need for a durable long-lived worker/consumer with leases, retries, dead-letter handling, and metrics.
- Supabase migration application and live RLS/integration tests have not been verified in a production project.

## 3. Target architecture

```text
Discord Gateway / REST
        |
        v
Discord transport adapter
        |
        v
Identity resolver ---- company + employee + bot identity mapping
        |
        v
Conversation/message service
        |
        +---- authorization and channel policy
        |
        +---- durable inbound event / idempotency
        |
        v
Worker runtime (selected employee)
        |
        +---- approved memory, skills, knowledge, tools, autonomy
        |
        +---- agent-to-agent conversation orchestration
        |
        v
Durable outbound delivery queue
        |
        v
Correct employee's Discord bot identity
```

The transport layer must not contain employee personalities or hard-code project logic. The employee runtime must not depend on Discord SDK types. This keeps Discord replaceable by the website, WhatsApp, or another interface.

## 4. Persistence additions

Implement an additive migration after the existing worker-system migration.

### Discord bot identities

A company-scoped table (suggested name: `employee_channel_identities`) should store:
- generated identity ID;
- company ID and employee ID;
- channel/provider key (initially `discord`);
- external application ID and bot user ID;
- public username/display metadata;
- status (`pending`, `active`, `disabled`, `revoked`, `error`);
- non-secret configuration and timestamps.

Enforce a unique active mapping for a given provider + bot user ID, and an appropriate unique mapping for company + employee + provider. Never store bot tokens in this table.

Bot tokens belong in the hosting platform's encrypted secret store, keyed by a stable identity reference. Do not commit tokens, place them in browser code, log them, or expose them through employee APIs.

### Conversations and messages

Use a channel-neutral model for conversations, participants, messages, delivery attempts, and provider-specific external references. Every record is company-scoped. Store sender employee/user identity separately from the transport bot identity.

Inbound messages require an external message ID and idempotency key. Outbound messages require delivery state, attempt count, retry schedule, last error (sanitized), and external message ID when accepted by Discord.

If existing product tables already cover part of this model, extend/reuse them rather than creating duplicate conversation or event systems. Confirm the actual schema before writing migrations.

## 5. Message lifecycle

1. Receive Discord event.
2. Verify event authenticity through the Discord Gateway connection and validate server, channel, and bot identity.
3. Ignore messages authored by bots unless they are explicitly generated by a trusted Draken internal message event. Never let ordinary bot output trigger another inbound run.
4. Resolve the receiving bot identity and company/employee mapping.
5. Enforce guild, channel, user, role, employee, and conversation access policy.
6. Normalize the message into a channel-neutral inbound message.
7. Persist it idempotently before starting AI work.
8. Route direct employee mentions/DMs to the addressed employee. Route team/channel discussions only to the relevant authorized employees according to participation policy.
9. Invoke the worker runtime with approved conversation context and the correct trigger type.
10. Persist the employee response and enqueue outbound delivery.
11. Deliver through that employee's own bot identity.
12. Record delivery result and retry transient failures with bounded attempts; move exhausted messages to a dead-letter state for inspection.

Do not hold an HTTP interaction open while a long model run executes. Acknowledge promptly and process work asynchronously where Discord's interaction contract permits.

## 6. Agent-to-agent communication

Employees communicate through a backend conversation/orchestration service, not by scraping one another's Discord messages.

- Internal messages have explicit sender employee, recipient employee or group, conversation, correlation ID, and originating task/mission.
- Participation is scoped: specialist questions go to relevant employees; explicit whole-team requests invite the appropriate roster.
- R.U.N.E may coordinate, summarize, and surface disagreements, but must not rewrite another employee's identity or claim their work.
- Prevent recursive agent loops with correlation IDs, bounded turns, depth limits, rate limits, and duplicate suppression.
- Every agent-to-agent message and generated response is auditable.
- Do not fabricate simultaneous independent work. Record actual runs and task state.

## 7. Security and Discord configuration

- No Administrator permission for employee bots.
- Start with least privilege: View Channels, Send Messages, Read Message History only where needed, Embed Links/Attach Files only where required, and Use Application Commands if slash commands are implemented.
- Manage Roles and Manage Channels should not be granted to ordinary employee bots. If R.U.N.E needs a management action, expose a narrow backend operation with explicit authorization rather than broad Discord server privileges.
- Enable only the Gateway intents required by the implemented experience. Message Content is a privileged intent and must be enabled/configured only if the chosen message flow requires it and Discord approves it.
- Validate guild ID and bot identity on every event. Restrict bot installation to the intended server.
- Keep each bot token in encrypted deployment secrets. Rotate/revoke compromised tokens immediately.
- Verify Discord request signatures for HTTP interactions/webhooks. For Gateway connections, use the official authenticated Gateway session and validate event state.
- Apply per-user, per-channel, per-employee, and per-company rate limits.
- Treat Discord message content and attachments as untrusted input. Do not allow messages to change employee policy, permissions, or system instructions.
- Require human approval for privileged external actions according to company policy.

## 8. Discord server structure

Initial categories/channels are proposed, not yet created:

- COMMAND: `#rune`, `#command-center`, `#approvals`, `#briefings`
- OPERATIONS: `#operations`, `#tasks`, `#activity`, `#reports`
- INTELLIGENCE: `#research`, `#analysis`, `#knowledge`
- ENGINEERING: `#development`, `#code-review`, `#testing`, `#deployments`
- PROJECTS: `#project-hub` and project-specific rooms as needed
- SYSTEM: `#agent-status`, `#system-logs`, `#integrations`

Use Discord roles for human/server access and presentation, but backend authorization remains authoritative. Create employee roles only where they add useful channel-level visibility or mention behavior; a bot identity is not granted authority merely because of its name or role color.

## 9. Implementation sequence

### Phase 0: Preflight
- Confirm the actual target guild ID, R.U.N.E bot user ID, current installation, and bot online/offline state.
- Inspect current database migrations and product message/conversation tables before designing schema changes.
- Confirm hosting target, public HTTPS endpoint, secret-store support, and current deployment status.
- Record existing server roles/channels before modifying them.

### Phase 1: Discord transport foundation
- Add Discord config validation and a transport adapter.
- Implement a single-bot R.U.N.E Gateway connection first.
- Add health/readiness reporting without exposing secrets.
- Add inbound message normalization, guild allow-list, and safe message delivery.
- Add focused unit tests with mocked Discord API/Gateway boundaries.

### Phase 2: Durable conversation pipeline
- Reuse or add company-scoped conversation/message persistence.
- Add inbound idempotency and outbound delivery queue.
- Add a persistent consumer with leases, bounded retries, dead-letter handling, graceful shutdown, and metrics.
- Add correlation IDs and loop prevention.

### Phase 3: R.U.N.E vertical slice
- Connect R.U.N.E's Discord bot user to the existing R.U.N.E employee record.
- Test DM, mention, allowed channel, unauthorized channel, restart recovery, duplicate event, provider-unconfigured response, and outbound failure/retry.
- Do not proceed to more bots until this passes.

### Phase 4: Marcus and Victor
- Create employee records and configure personalities, responsibilities, autonomy, provider/model, and permissions.
- Create their Discord applications/bot users and store tokens securely.
- Install both in the target guild with least privilege.
- Verify direct conversation and team collaboration, including agent-to-agent communication through the backend.

### Phase 5: Remaining roster
- Create Aaron, Nadia, and Amara as inactive employee records with approved profiles.
- Activate their Discord identities only when needed.
- Reserve four future employee positions without creating placeholder Discord applications.

## 10. Acceptance criteria for first production-capable slice

- R.U.N.E appears as its own bot identity in the intended server.
- A permitted user can DM or mention R.U.N.E and receive a response generated by the existing worker runtime.
- Messages are persisted once, with traceable inbound and outbound records.
- Duplicate Discord events do not create duplicate AI runs.
- Bot-authored messages cannot create infinite bot-to-bot loops.
- Unauthorized guilds, channels, and users are rejected.
- Bot tokens never appear in logs, API responses, source control, or frontend bundles.
- A restart does not silently lose queued messages.
- Provider/database/Discord outages produce visible, recoverable error states.
- Tests cover authorization, idempotency, retries, routing, and failure handling.
- No production readiness claim is made until live deployment, database migration, and end-to-end tests pass.

## 11. Explicit non-goals for this phase

- Replacing the existing backend or employee model.
- Building ten ordinary Discord user accounts.
- Creating all nine additional bot applications before the first integration is proven.
- Giving bots Administrator permissions.
- Using Discord messages as the source of truth for agent-to-agent communication.
- Claiming a live Discord connection before credentials, deployment, and end-to-end verification exist.
- Rewriting the unrelated `harolds_place/` product.
