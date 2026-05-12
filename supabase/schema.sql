create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  company text not null default '',
  source text not null default '',
  status text not null default 'novo',
  estimated_value numeric(12,2),
  owner_name text not null default '',
  temperature text not null default 'morno' check (temperature in ('frio', 'morno', 'quente')),
  outcome_reason text not null default '',
  sla_hours integer not null default 24,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add column if not exists last_contact_at timestamptz;
alter table public.leads add column if not exists next_followup_at timestamptz;
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists updated_at timestamptz not null default now();
alter table public.leads add column if not exists estimated_value numeric(12,2);
alter table public.leads add column if not exists owner_name text not null default '';
alter table public.leads add column if not exists temperature text not null default 'morno';
alter table public.leads add column if not exists outcome_reason text not null default '';
alter table public.leads add column if not exists sla_hours integer not null default 24;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  note text not null,
  message text,
  type text not null default 'note' check (type in ('whatsapp_sent', 'status_changed', 'followup_created', 'note')),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'call', 'email', 'other')),
  created_at timestamptz not null default now()
);

alter table public.interactions add column if not exists message text;
alter table public.interactions add column if not exists type text not null default 'note';

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null default 'followup' check (type in ('followup', 'call', 'email', 'whatsapp', 'meeting', 'other')),
  title text not null,
  notes text,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'completed', 'canceled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  message_id text not null,
  remote_jid text,
  phone_number text not null,
  contact_name text,
  contact_avatar_url text,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text not null default '',
  media_url text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  phone_number text not null,
  remote_jid text,
  contact_name text,
  contact_avatar_url text,
  status text not null default 'open' check (status in ('open', 'unread', 'waiting', 'responded', 'converted', 'archived')),
  unread_count integer not null default 0,
  last_message text not null default '',
  last_message_direction text check (last_message_direction in ('inbound', 'outbound')),
  last_message_at timestamptz,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, phone_number)
);

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  status text not null default 'success' check (status in ('success', 'error')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

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

alter table public.whatsapp_messages alter column lead_id drop not null;
alter table public.whatsapp_messages add column if not exists remote_jid text;
alter table public.whatsapp_messages add column if not exists contact_name text;
alter table public.whatsapp_messages add column if not exists contact_avatar_url text;

create index if not exists leads_user_id_status_idx on public.leads(user_id, status);
create index if not exists leads_user_id_next_followup_idx on public.leads(user_id, next_followup_at);
create index if not exists leads_user_id_phone_idx on public.leads(user_id, phone);
create index if not exists leads_user_id_archived_at_idx on public.leads(user_id, archived_at);
create index if not exists interactions_user_id_lead_id_idx on public.interactions(user_id, lead_id);
create index if not exists tasks_user_id_status_due_at_idx on public.tasks(user_id, status, due_at);
create index if not exists tasks_user_id_lead_id_idx on public.tasks(user_id, lead_id);
create index if not exists whatsapp_messages_user_id_lead_id_idx on public.whatsapp_messages(user_id, lead_id);
create unique index if not exists whatsapp_messages_message_id_idx on public.whatsapp_messages(message_id);
create index if not exists whatsapp_conversations_user_id_updated_at_idx on public.whatsapp_conversations(user_id, updated_at desc);
create index if not exists whatsapp_conversations_user_id_status_idx on public.whatsapp_conversations(user_id, status);
create index if not exists whatsapp_logs_user_id_created_at_idx on public.whatsapp_logs(user_id, created_at desc);
create index if not exists audit_logs_user_id_created_at_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_user_id_entity_idx on public.audit_logs(user_id, entity_type, entity_id);

alter table public.leads enable row level security;
alter table public.message_templates enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_logs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Users can manage own leads" on public.leads;
create policy "Users can manage own leads"
  on public.leads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own templates" on public.message_templates;
create policy "Users can manage own templates"
  on public.message_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own interactions" on public.interactions;
create policy "Users can manage own interactions"
  on public.interactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own whatsapp messages" on public.whatsapp_messages;
create policy "Users can manage own whatsapp messages"
  on public.whatsapp_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own whatsapp conversations" on public.whatsapp_conversations;
create policy "Users can manage own whatsapp conversations"
  on public.whatsapp_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own whatsapp logs" on public.whatsapp_logs;
create policy "Users can read own whatsapp logs"
  on public.whatsapp_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own audit logs" on public.audit_logs;
create policy "Users can read own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own audit logs" on public.audit_logs;
create policy "Users can create own audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_messages_set_updated_at on public.whatsapp_messages;
create trigger whatsapp_messages_set_updated_at
before update on public.whatsapp_messages
for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_conversations_set_updated_at on public.whatsapp_conversations;
create trigger whatsapp_conversations_set_updated_at
before update on public.whatsapp_conversations
for each row execute function public.set_updated_at();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_messages'
    ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_conversations'
    ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;
end $$;
