create extension if not exists pgcrypto;

create type public.company_status as enum ('active', 'suspended', 'archived');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'removed');
create type public.employee_status as enum ('available', 'busy', 'away', 'offline', 'disabled');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.mission_status as enum ('planned', 'active', 'blocked', 'completed', 'cancelled');
create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed', 'cancelled');
create type public.channel_type as enum ('public', 'private', 'direct');
create type public.integration_status as enum ('unconfigured', 'pending', 'connected', 'error', 'disabled');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'read');
create type public.orchestration_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.company_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_key text not null check (provider_key in ('openai', 'anthropic', 'google-gemini', 'manus')),
  display_name text not null,
  status public.integration_status not null default 'unconfigured',
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider_key)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  ai_provider_id uuid references public.ai_providers(id) on delete set null,
  display_name text not null,
  department text,
  personality text,
  system_instructions text,
  capabilities jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  status public.employee_status not null default 'offline',
  current_assignment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_employee_id uuid references public.employees(id) on delete set null,
  name text not null,
  description text,
  status public.mission_status not null default 'planned',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  owner_employee_id uuid references public.employees(id) on delete set null,
  name text not null,
  description text,
  status public.project_status not null default 'planned',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assignee_employee_id uuid references public.employees(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'backlog',
  blocked_reason text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  type public.channel_type not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.channel_participants (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (employee_id is not null))
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_employee_id uuid references public.employees(id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((author_user_id is not null) <> (author_employee_id is not null))
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  root_message_id uuid not null unique references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.thread_messages (
  thread_id uuid not null references public.threads(id) on delete cascade,
  message_id uuid not null unique references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, message_id)
);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (employee_id is not null))
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_employee_id uuid references public.employees(id) on delete cascade,
  channel text not null,
  subject text,
  body text not null,
  status public.notification_status not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((recipient_user_id is not null) <> (recipient_employee_id is not null))
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  integration_key text not null check (integration_key in ('telegram', 'github', 'resend', 'zapier', 'docker-sandbox')),
  display_name text not null,
  status public.integration_status not null default 'unconfigured',
  configuration jsonb not null default '{}'::jsonb,
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, integration_key)
);

create table public.telegram_authorizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  telegram_user_id bigint not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, telegram_user_id)
);

create table public.orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  provider_id uuid references public.ai_providers(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status public.orchestration_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index company_memberships_user_idx on public.company_memberships(user_id, status);
create index roles_company_idx on public.roles(company_id);
create index ai_providers_company_idx on public.ai_providers(company_id);
create index employees_company_idx on public.employees(company_id, status);
create index missions_company_idx on public.missions(company_id, status);
create index projects_company_idx on public.projects(company_id, status);
create index tasks_company_idx on public.tasks(company_id, status);
create index channels_company_idx on public.channels(company_id);
create unique index channel_participants_user_unique on public.channel_participants(channel_id, user_id) where user_id is not null;
create unique index channel_participants_employee_unique on public.channel_participants(channel_id, employee_id) where employee_id is not null;
create unique index message_reactions_user_unique on public.message_reactions(message_id, user_id, reaction) where user_id is not null;
create unique index message_reactions_employee_unique on public.message_reactions(message_id, employee_id, reaction) where employee_id is not null;
create index messages_company_created_idx on public.messages(company_id, created_at desc);
create index events_company_occurred_idx on public.events(company_id, occurred_at desc);
create index notifications_company_status_idx on public.notifications(company_id, status);
create unique index telegram_authorizations_user_global_unique on public.telegram_authorizations(telegram_user_id);
create index telegram_authorizations_user_idx on public.telegram_authorizations(telegram_user_id, active);
create index orchestration_company_status_idx on public.orchestration_runs(company_id, status);

create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger company_memberships_updated_at before update on public.company_memberships for each row execute function public.set_updated_at();
create trigger roles_updated_at before update on public.roles for each row execute function public.set_updated_at();
create trigger ai_providers_updated_at before update on public.ai_providers for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();
create trigger missions_updated_at before update on public.missions for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger channels_updated_at before update on public.channels for each row execute function public.set_updated_at();
create trigger messages_updated_at before update on public.messages for each row execute function public.set_updated_at();
create trigger threads_updated_at before update on public.threads for each row execute function public.set_updated_at();
create trigger integrations_updated_at before update on public.integrations for each row execute function public.set_updated_at();
create trigger telegram_authorizations_updated_at before update on public.telegram_authorizations for each row execute function public.set_updated_at();

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships
    where company_id = target_company_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.ai_providers enable row level security;
alter table public.employees enable row level security;
alter table public.missions enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.channels enable row level security;
alter table public.channel_participants enable row level security;
alter table public.messages enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.events enable row level security;
alter table public.notifications enable row level security;
alter table public.integrations enable row level security;
alter table public.telegram_authorizations enable row level security;
alter table public.orchestration_runs enable row level security;

create policy companies_member_select on public.companies for select using (public.is_company_member(id));
create policy memberships_self_select on public.company_memberships for select using (user_id = auth.uid());

create policy roles_company_access on public.roles for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy ai_providers_company_access on public.ai_providers for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy employees_company_access on public.employees for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy missions_company_access on public.missions for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy projects_company_access on public.projects for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy tasks_company_access on public.tasks for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy channels_company_access on public.channels for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy participants_company_access on public.channel_participants for all using (exists (select 1 from public.channels c where c.id = channel_id and public.is_company_member(c.company_id))) with check (exists (select 1 from public.channels c where c.id = channel_id and public.is_company_member(c.company_id)));
create policy messages_company_access on public.messages for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy threads_company_access on public.threads for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy thread_messages_company_access on public.thread_messages for all using (exists (select 1 from public.threads t where t.id = thread_id and public.is_company_member(t.company_id))) with check (exists (select 1 from public.threads t where t.id = thread_id and public.is_company_member(t.company_id)));
create policy reactions_company_access on public.message_reactions for all using (exists (select 1 from public.messages m where m.id = message_id and public.is_company_member(m.company_id))) with check (exists (select 1 from public.messages m where m.id = message_id and public.is_company_member(m.company_id)));
create policy events_company_access on public.events for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy notifications_company_access on public.notifications for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy integrations_company_access on public.integrations for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy telegram_auth_company_access on public.telegram_authorizations for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy orchestration_company_access on public.orchestration_runs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
