create table if not exists public.whatsapp_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  instance_name text not null unique,
  provider text not null default 'evolution',
  status text not null default 'created',
  phone_number text,
  profile_name text,
  last_webhook_at timestamptz,
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.whatsapp_instances
  drop constraint if exists whatsapp_instances_status_check;

alter table public.whatsapp_instances
  add constraint whatsapp_instances_status_check
  check (status in ('created', 'connecting', 'open', 'connected', 'disconnected', 'error', 'deleted'));

create index if not exists whatsapp_instances_organization_idx
  on public.whatsapp_instances(organization_id);

create index if not exists whatsapp_instances_instance_name_idx
  on public.whatsapp_instances(instance_name);

alter table public.whatsapp_messages
  add column if not exists whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete set null;

alter table public.whatsapp_conversations
  add column if not exists whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete set null;

alter table public.whatsapp_logs
  add column if not exists whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete set null;

create index if not exists whatsapp_messages_instance_idx
  on public.whatsapp_messages(whatsapp_instance_id);

create index if not exists whatsapp_conversations_instance_idx
  on public.whatsapp_conversations(whatsapp_instance_id);

create index if not exists whatsapp_logs_instance_idx
  on public.whatsapp_logs(whatsapp_instance_id);

alter table public.whatsapp_instances enable row level security;

drop policy if exists "whatsapp_instances_select_members" on public.whatsapp_instances;
create policy "whatsapp_instances_select_members"
on public.whatsapp_instances
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_instances.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

drop policy if exists "whatsapp_instances_manage_admins" on public.whatsapp_instances;
create policy "whatsapp_instances_manage_admins"
on public.whatsapp_instances
for all
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_instances.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_instances.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager')
  )
);
