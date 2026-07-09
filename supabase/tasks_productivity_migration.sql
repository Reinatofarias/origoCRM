alter table public.tasks add column if not exists priority text not null default 'medium';
alter table public.tasks add column if not exists workflow_status text not null default 'todo';
alter table public.tasks add column if not exists start_at timestamptz;
alter table public.tasks add column if not exists position integer not null default 0;

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high', 'urgent'));

alter table public.tasks drop constraint if exists tasks_workflow_status_check;
alter table public.tasks
  add constraint tasks_workflow_status_check
  check (workflow_status in ('todo', 'in_progress', 'waiting', 'review', 'completed', 'blocked'));

update public.tasks
set workflow_status = 'completed'
where status = 'completed'
  and workflow_status <> 'completed';

create index if not exists tasks_organization_workflow_due_idx
  on public.tasks(organization_id, workflow_status, due_at);

create index if not exists tasks_organization_priority_due_idx
  on public.tasks(organization_id, priority, due_at);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_checklist_items_task_idx on public.task_checklist_items(task_id, position);
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);
create index if not exists task_activity_logs_task_idx on public.task_activity_logs(task_id, created_at);

alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity_logs enable row level security;

drop policy if exists "Members can manage organization task checklist" on public.task_checklist_items;
create policy "Members can manage organization task checklist"
  on public.task_checklist_items for all
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = task_checklist_items.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = task_checklist_items.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "Members can manage organization task comments" on public.task_comments;
create policy "Members can manage organization task comments"
  on public.task_comments for all
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = task_comments.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = task_comments.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );

drop policy if exists "Members can read organization task activity" on public.task_activity_logs;
create policy "Members can read organization task activity"
  on public.task_activity_logs for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = task_activity_logs.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );
