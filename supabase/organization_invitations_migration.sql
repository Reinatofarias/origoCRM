-- Convites de equipe e hardening de multiusuario.
-- Rode no SQL Editor do Supabase depois de saas_base_migration.sql e role_permissions_migration.sql.

create extension if not exists pgcrypto;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'seller', 'support', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_user_id uuid references auth.users(id) on delete set null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_invitations
  add column if not exists accepted_user_id uuid references auth.users(id) on delete set null;
alter table public.organization_invitations
  add column if not exists token uuid default gen_random_uuid();
alter table public.organization_invitations
  add column if not exists expires_at timestamptz default (now() + interval '7 days');
alter table public.organization_invitations
  add column if not exists accepted_at timestamptz;
alter table public.organization_invitations
  add column if not exists canceled_at timestamptz;

update public.organization_invitations
set email = lower(trim(email))
where email <> lower(trim(email));

create unique index if not exists organization_invitations_token_key
  on public.organization_invitations(token);

create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations(organization_id, lower(email))
  where status = 'pending';

create index if not exists organization_invitations_organization_status_idx
  on public.organization_invitations(organization_id, status, created_at desc);

create index if not exists organization_invitations_email_status_idx
  on public.organization_invitations(lower(email), status, expires_at);

alter table public.organization_invitations enable row level security;

drop policy if exists "Admins can read organization invitations" on public.organization_invitations;
create policy "Admins can read organization invitations"
  on public.organization_invitations for select
  using (public.organization_has_permission(organization_id, 'settings:manage'));

drop policy if exists "Admins can create organization invitations" on public.organization_invitations;
create policy "Admins can create organization invitations"
  on public.organization_invitations for insert
  with check (
    invited_by_user_id = auth.uid()
    and email = lower(trim(email))
    and public.organization_has_permission(organization_id, 'settings:manage')
  );

drop policy if exists "Admins can update organization invitations" on public.organization_invitations;
create policy "Admins can update organization invitations"
  on public.organization_invitations for update
  using (public.organization_has_permission(organization_id, 'settings:manage'))
  with check (public.organization_has_permission(organization_id, 'settings:manage'));

drop policy if exists "Users can read own pending invitations" on public.organization_invitations;
create policy "Users can read own pending invitations"
  on public.organization_invitations for select
  using (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "Users can accept own pending invitations" on public.organization_invitations;
create policy "Users can accept own pending invitations"
  on public.organization_invitations for update
  using (
    status = 'pending'
    and expires_at > now()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    status = 'accepted'
    and accepted_user_id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "Users can create own owner membership" on public.organization_members;
create policy "Users can create owner membership for own organization"
  on public.organization_members for insert
  with check (
    auth.uid() = user_id
    and role = 'owner'
    and status = 'active'
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_members.organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Users can accept pending organization invitation" on public.organization_members;
create policy "Users can accept pending organization invitation"
  on public.organization_members for insert
  with check (
    auth.uid() = user_id
    and status = 'active'
    and exists (
      select 1
      from public.organization_invitations invitation
      where invitation.organization_id = organization_members.organization_id
        and invitation.role = organization_members.role
        and invitation.status = 'pending'
        and invitation.expires_at > now()
        and lower(invitation.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

