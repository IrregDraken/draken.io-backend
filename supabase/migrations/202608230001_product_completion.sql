do $$
begin
  alter type public.mission_status add value if not exists 'failed';
  alter type public.task_status add value if not exists 'failed';
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.mission_stage as enum ('created', 'planning', 'executing', 'review', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.tool_status as enum ('active', 'disabled', 'pending');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.bus_event_status as enum ('pending', 'processing', 'processed', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists description text;
alter table public.companies add column if not exists identity jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists timezone text not null default 'UTC';
alter table public.employees add column if not exists description text;
alter table public.employees add column if not exists department_id uuid references public.departments(id) on delete set null;
alter table public.employees add column if not exists current_mission_id uuid references public.missions(id) on delete set null;
alter table public.employees add column if not exists current_task_id uuid references public.tasks(id) on delete set null;
alter table public.missions add column if not exists title text;
alter table public.missions add column if not exists objective text;
alter table public.missions add column if not exists priority integer not null default 3 check (priority between 1 and 5);
alter table public.missions add column if not exists stage public.mission_stage not null default 'created';
alter table public.missions add column if not exists progress numeric(5,2) not null default 0 check (progress between 0 and 100);
alter table public.missions add column if not exists outputs jsonb not null default '[]'::jsonb;
alter table public.missions add column if not exists failure_reason text;
alter table public.tasks add column if not exists priority integer not null default 3 check (priority between 1 and 5);
alter table public.tasks add column if not exists retry_limit integer not null default 0 check (retry_limit between 0 and 20);
alter table public.tasks add column if not exists retry_count integer not null default 0 check (retry_count >= 0);
alter table public.tasks add column if not exists output jsonb;
alter table public.tasks add column if not exists failure_reason text;
alter table public.tasks add column if not exists started_at timestamptz;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists last_error text;

update public.missions set title = name where title is null;
alter table public.missions alter column title set default '';
alter table public.missions alter column title set not null;

create table if not exists public.mission_agents (
  mission_id uuid not null references public.missions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  primary key (mission_id, employee_id)
);

create table if not exists public.mission_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  output_type text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.task_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status public.task_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  output jsonb,
  unique (task_id, attempt_number)
);

create table if not exists public.task_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  attempt_id uuid references public.task_attempts(id) on delete cascade,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text not null,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  permissions jsonb not null default '{}'::jsonb,
  status public.tool_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.employee_tools (
  employee_id uuid not null references public.employees(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  primary key (employee_id, tool_id)
);

create table if not exists public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status text not null check (status in ('requested', 'running', 'succeeded', 'failed', 'denied')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  activity_type text not null,
  mission_id uuid references public.missions(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  tool_execution_id uuid references public.tool_executions(id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.message_bus_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  event_type text not null,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status public.bus_event_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists departments_company_idx on public.departments(company_id);
create index if not exists mission_agents_employee_idx on public.mission_agents(employee_id);
create index if not exists mission_outputs_company_idx on public.mission_outputs(company_id, created_at desc);
create index if not exists task_dependencies_dependency_idx on public.task_dependencies(depends_on_task_id);
create index if not exists task_attempts_task_idx on public.task_attempts(task_id, attempt_number desc);
create index if not exists task_logs_task_idx on public.task_logs(task_id, created_at asc);
create index if not exists tools_company_status_idx on public.tools(company_id, status);
create index if not exists tool_executions_company_created_idx on public.tool_executions(company_id, created_at desc);
create index if not exists activity_log_company_created_idx on public.activity_log(company_id, created_at desc);
create index if not exists message_bus_pending_idx on public.message_bus_events(status, available_at, created_at);

create trigger departments_updated_at before update on public.departments for each row execute function public.set_updated_at();
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger companies_settings_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger tools_updated_at before update on public.tools for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
alter table public.user_profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.mission_agents enable row level security;
alter table public.mission_outputs enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_attempts enable row level security;
alter table public.task_logs enable row level security;
alter table public.tools enable row level security;
alter table public.employee_tools enable row level security;
alter table public.tool_executions enable row level security;
alter table public.activity_log enable row level security;
alter table public.message_bus_events enable row level security;

create policy departments_company_access on public.departments for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy user_profiles_self_access on public.user_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy company_settings_company_access on public.company_settings for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy mission_agents_company_access on public.mission_agents for all using (exists (select 1 from public.missions m where m.id = mission_id and public.is_company_member(m.company_id))) with check (exists (select 1 from public.missions m where m.id = mission_id and public.is_company_member(m.company_id)));
create policy mission_outputs_company_access on public.mission_outputs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy task_dependencies_company_access on public.task_dependencies for all using (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id))) with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));
create policy task_attempts_company_access on public.task_attempts for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy task_logs_company_access on public.task_logs for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy tools_company_access on public.tools for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy employee_tools_company_access on public.employee_tools for all using (exists (select 1 from public.employees e where e.id = employee_id and public.is_company_member(e.company_id))) with check (exists (select 1 from public.employees e where e.id = employee_id and public.is_company_member(e.company_id)));
create policy tool_executions_company_access on public.tool_executions for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy activity_log_company_access on public.activity_log for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy message_bus_events_company_access on public.message_bus_events for all using (company_id is null or public.is_company_member(company_id)) with check (company_id is null or public.is_company_member(company_id));
