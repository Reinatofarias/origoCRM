create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('lead', 'task', 'template', 'whatsapp', 'system')),
  entity_id uuid,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_created_at_idx
  on public.audit_logs(user_id, created_at desc);

create index if not exists audit_logs_user_id_entity_idx
  on public.audit_logs(user_id, entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Users can read own audit logs" on public.audit_logs;
create policy "Users can read own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own audit logs" on public.audit_logs;
create policy "Users can create own audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);
