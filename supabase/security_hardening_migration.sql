-- Security hardening for SaaS permissions and API rate limiting.
-- Run after saas_base_migration.sql, role_permissions_migration.sql and feature migrations.

create or replace function public.organization_member_role(target_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create or replace function public.organization_has_permission(target_organization_id uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.organization_member_role(target_organization_id)
    when 'owner' then true
    when 'admin' then true
    when 'manager' then permission in (
      'lead:create',
      'lead:update',
      'pipeline:update',
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage',
      'prospecting:use',
      'settings:manage'
    )
    when 'seller' then permission in (
      'lead:create',
      'lead:update',
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage',
      'prospecting:use'
    )
    when 'support' then permission in (
      'conversation:update',
      'conversation:send',
      'task:manage',
      'template:manage'
    )
    else false
  end;
$$;

create table if not exists public.security_rate_limits (
  key text primary key,
  scope text not null,
  count integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_rate_limits_scope_updated_at_idx
  on public.security_rate_limits(scope, updated_at desc);

alter table public.security_rate_limits enable row level security;

drop policy if exists "No direct client access to security rate limits" on public.security_rate_limits;
create policy "No direct client access to security rate limits"
  on public.security_rate_limits for all
  using (false)
  with check (false);

drop policy if exists "Members can read subscriptions" on public.subscriptions;
create policy "Members can read subscriptions"
  on public.subscriptions for select
  using (public.is_organization_member(organization_id));

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  using (public.organization_has_permission(organization_id, 'billing:manage'))
  with check (public.organization_has_permission(organization_id, 'billing:manage'));

drop policy if exists "Admins can update organization" on public.organizations;
create policy "Admins can update organization"
  on public.organizations for update
  using (public.organization_has_permission(id, 'settings:manage'))
  with check (public.organization_has_permission(id, 'settings:manage'));

drop policy if exists "Admins can manage members" on public.organization_members;
create policy "Admins can manage members"
  on public.organization_members for update
  using (public.organization_has_permission(organization_id, 'settings:manage'))
  with check (public.organization_has_permission(organization_id, 'settings:manage'));

drop policy if exists "Members can create organization audit logs" on public.audit_logs;
create policy "Members can create organization audit logs"
  on public.audit_logs for insert
  with check (
    (organization_id is not null and public.is_organization_member(organization_id))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can read organization whatsapp logs" on public.whatsapp_logs;
create policy "Members can read organization whatsapp logs"
  on public.whatsapp_logs for select
  using (
    (organization_id is not null and public.organization_has_permission(organization_id, 'whatsapp:manage'))
    or (organization_id is null and auth.uid() = user_id)
  );

drop policy if exists "Members can read organization audit logs" on public.audit_logs;
create policy "Members can read organization audit logs"
  on public.audit_logs for select
  using (
    (organization_id is not null and (
      public.organization_has_permission(organization_id, 'settings:manage')
      or public.organization_has_permission(organization_id, 'billing:manage')
    ))
    or (organization_id is null and auth.uid() = user_id)
  );
