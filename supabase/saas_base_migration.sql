-- Base SaaS: organizacoes, membros, assinaturas e isolamento por organizacao.
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes anteriores.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'manager', 'seller', 'support', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_slug text not null default 'manual' check (plan_slug in ('base', 'pro', 'prospecting', 'premium', 'manual')),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'semiannual', 'annual')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  provider text default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id)
);

alter table public.leads add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.message_templates add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.interactions add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.tasks add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_messages add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_conversations add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_logs add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.audit_logs add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.tags add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.lead_tags add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_conversation_tags add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.prospecting_campaigns add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.prospecting_campaign_contacts add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

with known_users as (
  select id as user_id, coalesce(email, 'OrigoCRM') as email from auth.users
  union
  select user_id, 'OrigoCRM' from public.leads where user_id is not null
  union
  select user_id, 'OrigoCRM' from public.message_templates where user_id is not null
  union
  select user_id, 'OrigoCRM' from public.tasks where user_id is not null
  union
  select user_id, 'OrigoCRM' from public.whatsapp_messages where user_id is not null
  union
  select user_id, 'OrigoCRM' from public.audit_logs where user_id is not null
),
inserted_orgs as (
  insert into public.organizations (name, owner_user_id, slug)
  select
    split_part(email, '@', 1) || ' - OrigoCRM',
    user_id,
    'org-' || replace(user_id::text, '-', '')
  from known_users
  where not exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = known_users.user_id
  )
  on conflict (slug) do nothing
  returning id, owner_user_id
)
insert into public.organization_members (organization_id, user_id, role, status)
select id, owner_user_id, 'owner', 'active'
from inserted_orgs
on conflict (organization_id, user_id) do nothing;

insert into public.subscriptions (organization_id, plan_slug, billing_period, status, provider)
select id, 'manual', 'monthly', 'trialing', 'manual'
from public.organizations
on conflict (organization_id) do nothing;

update public.leads t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.message_templates t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.interactions t
set organization_id = coalesce(
  (select l.organization_id from public.leads l where l.id = t.lead_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.tasks t
set organization_id = coalesce(
  (select l.organization_id from public.leads l where l.id = t.lead_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.whatsapp_messages t
set organization_id = coalesce(
  (select l.organization_id from public.leads l where l.id = t.lead_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.whatsapp_conversations t
set organization_id = coalesce(
  (select l.organization_id from public.leads l where l.id = t.lead_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.whatsapp_logs t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.audit_logs t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.tags t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.lead_tags t
set organization_id = coalesce(
  (select l.organization_id from public.leads l where l.id = t.lead_id),
  (select tg.organization_id from public.tags tg where tg.id = t.tag_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.whatsapp_conversation_tags t
set organization_id = coalesce(
  (select c.organization_id from public.whatsapp_conversations c where c.id = t.conversation_id),
  (select tg.organization_id from public.tags tg where tg.id = t.tag_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.prospecting_campaigns t
set organization_id = om.organization_id
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

update public.prospecting_campaign_contacts t
set organization_id = coalesce(
  (select c.organization_id from public.prospecting_campaigns c where c.id = t.campaign_id),
  om.organization_id
)
from public.organization_members om
where t.organization_id is null and t.user_id = om.user_id and om.status = 'active';

create index if not exists organizations_owner_user_id_idx on public.organizations(owner_user_id);
create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists organization_members_org_role_idx on public.organization_members(organization_id, role);
create index if not exists subscriptions_organization_id_status_idx on public.subscriptions(organization_id, status);

create index if not exists leads_organization_id_status_idx on public.leads(organization_id, status);
create index if not exists leads_organization_id_next_followup_idx on public.leads(organization_id, next_followup_at);
create index if not exists leads_organization_id_phone_idx on public.leads(organization_id, phone);
create index if not exists tasks_organization_id_status_due_at_idx on public.tasks(organization_id, status, due_at);
create index if not exists interactions_organization_id_lead_id_idx on public.interactions(organization_id, lead_id);
create index if not exists message_templates_organization_id_idx on public.message_templates(organization_id);
create index if not exists whatsapp_messages_organization_id_created_at_idx on public.whatsapp_messages(organization_id, created_at desc);
create index if not exists whatsapp_conversations_organization_id_updated_at_idx on public.whatsapp_conversations(organization_id, updated_at desc);
create index if not exists whatsapp_logs_organization_id_created_at_idx on public.whatsapp_logs(organization_id, created_at desc);
create index if not exists audit_logs_organization_id_created_at_idx on public.audit_logs(organization_id, created_at desc);
create unique index if not exists tags_organization_id_lower_name_idx on public.tags(organization_id, lower(name));
create index if not exists lead_tags_organization_id_lead_id_idx on public.lead_tags(organization_id, lead_id);
create index if not exists prospecting_campaigns_organization_id_created_at_idx on public.prospecting_campaigns(organization_id, created_at desc);
create index if not exists prospecting_campaign_contacts_organization_id_status_idx on public.prospecting_campaign_contacts(organization_id, dispatch_status);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin')
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Members can read organizations" on public.organizations;
create policy "Members can read organizations"
  on public.organizations for select
  using (public.is_organization_member(id));

drop policy if exists "Users can create own organization" on public.organizations;
create policy "Users can create own organization"
  on public.organizations for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Admins can update organization" on public.organizations;
create policy "Admins can update organization"
  on public.organizations for update
  using (public.is_organization_admin(id))
  with check (public.is_organization_admin(id));

drop policy if exists "Members can read organization members" on public.organization_members;
create policy "Members can read organization members"
  on public.organization_members for select
  using (public.is_organization_member(organization_id));

drop policy if exists "Users can create own owner membership" on public.organization_members;
create policy "Users can create own owner membership"
  on public.organization_members for insert
  with check (auth.uid() = user_id and role in ('owner', 'admin'));

drop policy if exists "Admins can manage members" on public.organization_members;
create policy "Admins can manage members"
  on public.organization_members for update
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

drop policy if exists "Members can read subscriptions" on public.subscriptions;
create policy "Members can read subscriptions"
  on public.subscriptions for select
  using (public.is_organization_member(organization_id));

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

drop policy if exists "Users can manage own leads" on public.leads;
drop policy if exists "Members can manage organization leads" on public.leads;
create policy "Members can manage organization leads"
  on public.leads for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own templates" on public.message_templates;
drop policy if exists "Members can manage organization templates" on public.message_templates;
create policy "Members can manage organization templates"
  on public.message_templates for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own interactions" on public.interactions;
drop policy if exists "Members can manage organization interactions" on public.interactions;
create policy "Members can manage organization interactions"
  on public.interactions for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own tasks" on public.tasks;
drop policy if exists "Members can manage organization tasks" on public.tasks;
create policy "Members can manage organization tasks"
  on public.tasks for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own whatsapp messages" on public.whatsapp_messages;
drop policy if exists "Members can manage organization whatsapp messages" on public.whatsapp_messages;
create policy "Members can manage organization whatsapp messages"
  on public.whatsapp_messages for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own whatsapp conversations" on public.whatsapp_conversations;
drop policy if exists "Members can manage organization whatsapp conversations" on public.whatsapp_conversations;
create policy "Members can manage organization whatsapp conversations"
  on public.whatsapp_conversations for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can read own whatsapp logs" on public.whatsapp_logs;
drop policy if exists "Members can read organization whatsapp logs" on public.whatsapp_logs;
create policy "Members can read organization whatsapp logs"
  on public.whatsapp_logs for select
  using (public.is_organization_member(organization_id));

drop policy if exists "Users can read own audit logs" on public.audit_logs;
drop policy if exists "Users can create own audit logs" on public.audit_logs;
drop policy if exists "Members can read organization audit logs" on public.audit_logs;
drop policy if exists "Members can create organization audit logs" on public.audit_logs;
create policy "Members can read organization audit logs"
  on public.audit_logs for select
  using (public.is_organization_member(organization_id));
create policy "Members can create organization audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own tags" on public.tags;
drop policy if exists "Members can manage organization tags" on public.tags;
create policy "Members can manage organization tags"
  on public.tags for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own lead tags" on public.lead_tags;
drop policy if exists "Members can manage organization lead tags" on public.lead_tags;
create policy "Members can manage organization lead tags"
  on public.lead_tags for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own conversation tags" on public.whatsapp_conversation_tags;
drop policy if exists "Members can manage organization conversation tags" on public.whatsapp_conversation_tags;
create policy "Members can manage organization conversation tags"
  on public.whatsapp_conversation_tags for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own prospecting campaigns" on public.prospecting_campaigns;
drop policy if exists "Members can manage organization prospecting campaigns" on public.prospecting_campaigns;
create policy "Members can manage organization prospecting campaigns"
  on public.prospecting_campaigns for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));

drop policy if exists "Users can manage own prospecting campaign contacts" on public.prospecting_campaign_contacts;
drop policy if exists "Members can manage organization prospecting campaign contacts" on public.prospecting_campaign_contacts;
create policy "Members can manage organization prospecting campaign contacts"
  on public.prospecting_campaign_contacts for all
  using (public.is_organization_member(organization_id))
  with check (auth.uid() = user_id and public.is_organization_member(organization_id));
