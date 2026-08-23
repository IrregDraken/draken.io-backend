# Draken worker-system design

## Architectural boundary

The existing `employees` row remains the durable **worker identity**. It is not renamed or replaced, which preserves current missions, tasks, tools, Telegram authorization, and company membership behavior. Provider and model selection remain configuration attached to the worker; they are never used as the worker's identity.

The new worker runtime is a pure assembly layer above the existing `AIProvider` adapter boundary:

```text
employee / worker identity
  + active worker version
  + company constitution
  + active training lessons
  + assigned skills
  + approved knowledge and memory
  + permissions and autonomy policy
  + selected provider/model
  -> WorkerRuntimeContext
  -> AIProvider.generate({ systemInstructions, prompt, model })
```

No feature claims that an external model was fine-tuned. Training is represented by versioned instructions, structured knowledge, examples, corrections, skills, memory, evaluations, and approval history.

## Persistence model

| Concern            | Existing or new persistence                                                         | Security boundary                                                                      |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Worker identity    | `employees` plus worker configuration columns                                       | Company-scoped; public fields require explicit showcase opt-in                         |
| Worker versions    | `worker_versions` snapshots                                                         | Company-scoped; snapshots exclude secrets                                              |
| Skills             | `skills`, `worker_skills`                                                           | Company-scoped and versioned                                                           |
| Training           | `training_lessons`, `training_reviews`                                              | Proposed lessons require CEO approval before activation                                |
| Memory             | `worker_memory` with explicit memory type                                           | Training memory is distinct from working, agent, project, company, and decision memory |
| Runtime executions | `worker_runs`                                                                       | Company-scoped audit; prompt/output remain private                                     |
| Evaluations        | `evaluation_sets`, `evaluation_cases`, `evaluation_runs`, `evaluation_case_results` | Scores come from executed cases, never fabricated counters                             |
| Constitution       | `company_constitutions`                                                             | One active version per company is selected at runtime                                  |
| Inbox              | `company_inbox_items`                                                               | Authenticated company members only                                                     |
| Decisions          | `decision_log`                                                                      | Authenticated company members only; public export is opt-in and sanitized              |
| Mission templates  | `mission_templates`                                                                 | Company-scoped blueprint content; no credentials                                       |
| Showcase           | Explicit company and worker visibility fields                                       | Public route returns allow-listed fields only                                          |

## API surface

Authenticated routes are company-membership protected under `/api/v1/companies/:companyId`:

- `GET/POST /workers` and `GET/PATCH /workers/:workerId` expose identity, runtime state, provider/model, version, skills, memory configuration, and public visibility settings.
- `POST /workers/:workerId/clone` and `/fork` preserve lineage while never copying secrets or private memory by default.
- `GET/POST /workers/:workerId/training`, `POST /training-lessons/:lessonId/review`, and `POST /training-lessons/:lessonId/activate` implement proposed-review-approval-activation flow.
- `GET/POST /skills` and `POST /workers/:workerId/skills` keep reusable capabilities independent from worker identity.
- `GET/POST /evaluation-sets`, `POST /evaluation-sets/:setId/run`, and `GET /workers/:workerId/performance` expose repeatable evaluation and source-backed performance data.
- `POST /workers/:workerId/runs` executes a prompt through the worker runtime and records the actual result.
- `GET/PUT /constitution`, `GET/POST /inbox`, `GET /activity`, `GET/POST /decisions`, and `GET/mission-templates` expose the company operating layer.
- `POST /blueprint/export`, `POST /blueprint/import`, and `POST /clone` transfer structure without credentials, private memory, or private data.

The public route `GET /showcase/:slug` returns only an explicitly enabled company profile, visible workers, selected skills, selected metrics, and public mission/workflow summaries.

## Operational guarantees

A worker status is derived from persisted runtime state and recent worker runs. Performance metrics are computed from missions, tasks, worker runs, evaluations, tool failures, corrections, and training records. A proposed lesson cannot affect the runtime until it is explicitly approved and activated. Public showcase and blueprint serialization use allow-listed DTOs instead of raw database rows. Sanitization removes credential-shaped fields from runtime context, worker configuration DTOs, public metrics/workflows, and blueprint exports.

## Rollout note

The migration is additive and designed to run after the existing product-completion migration. Existing employees remain valid workers with sensible defaults: offline runtime status, autonomy level `observe`, version `1`, empty training and memory configuration, and no public showcase visibility. The compiled server smoke check passes in an unconfigured environment (`/` and `/health/live` return 200; `/health/ready` returns 503; `/showcase/example-company` returns `showcase_unconfigured`; protected worker API returns `authentication_unconfigured`). Supabase migration execution and RLS integration tests must still be run against a real disposable project before production rollout.
