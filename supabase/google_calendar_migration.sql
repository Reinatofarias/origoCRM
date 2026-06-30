-- Google Calendar por usuario: conexao OAuth e sincronizacao automatica de tarefas.
-- Rode depois de supabase/saas_base_migration.sql.

create extension if not exists pgcrypto;

create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text,
  calendar_id text not null default 'primary',
  refresh_token_encrypted text,
  scopes text[] not null default array[]::text[],
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

alter table public.tasks add column if not exists google_event_id text;
alter table public.tasks add column if not exists google_calendar_id text;
alter table public.tasks add column if not exists google_synced_at timestamptz;
alter table public.tasks add column if not exists google_sync_error text;

create index if not exists google_calendar_connections_user_id_idx
  on public.google_calendar_connections(user_id);

create index if not exists google_calendar_connections_organization_id_status_idx
  on public.google_calendar_connections(organization_id, status);

create index if not exists tasks_google_event_id_idx
  on public.tasks(google_event_id)
  where google_event_id is not null;

alter table public.google_calendar_connections enable row level security;

drop policy if exists "Members can read own Google Calendar connection" on public.google_calendar_connections;
create policy "Members can read own Google Calendar connection"
  on public.google_calendar_connections for select
  using (
    user_id = auth.uid()
    and (
      organization_id is null
      or exists (
        select 1
        from public.organization_members om
        where om.organization_id = google_calendar_connections.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
      )
    )
  );

drop policy if exists "Members can insert own Google Calendar connection" on public.google_calendar_connections;
create policy "Members can insert own Google Calendar connection"
  on public.google_calendar_connections for insert
  with check (
    user_id = auth.uid()
    and (
      organization_id is null
      or exists (
        select 1
        from public.organization_members om
        where om.organization_id = google_calendar_connections.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
      )
    )
  );

drop policy if exists "Members can update own Google Calendar connection" on public.google_calendar_connections;
create policy "Members can update own Google Calendar connection"
  on public.google_calendar_connections for update
  using (
    user_id = auth.uid()
    and (
      organization_id is null
      or exists (
        select 1
        from public.organization_members om
        where om.organization_id = google_calendar_connections.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
      )
    )
  )
  with check (
    user_id = auth.uid()
    and (
      organization_id is null
      or exists (
        select 1
        from public.organization_members om
        where om.organization_id = google_calendar_connections.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
      )
    )
  );
