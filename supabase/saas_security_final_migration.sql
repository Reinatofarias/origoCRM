-- Hardening final da base SaaS.
-- Execute depois de saas_base_migration.sql, role_permissions_migration.sql,
-- organization_invitations_migration.sql, security_hardening_migration.sql
-- e whatsapp_instances_migration.sql.

-- Assinaturas são somente leitura para clientes autenticados.
-- Criação e atualização ficam exclusivamente com rotas server-side usando service_role.
drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
drop policy if exists "Owners can manage subscriptions" on public.subscriptions;
drop policy if exists "Members can read subscriptions" on public.subscriptions;
create policy "Members can read subscriptions"
  on public.subscriptions
  for select
  using (public.is_organization_member(organization_id));

create or replace function public.organization_subscription_is_operational(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions subscription
    where subscription.organization_id = target_organization_id
      and (
        subscription.provider = 'manual'
        or subscription.status in ('active', 'trialing')
      )
  );
$$;

create or replace function public.organization_has_permission(target_organization_id uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      permission = 'billing:manage'
      or public.organization_subscription_is_operational(target_organization_id)
    )
    and case public.organization_member_role(target_organization_id)
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

-- Campos de identidade da organização não podem ser transferidos pelo cliente.
create or replace function public.protect_organization_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role') or auth.role() = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'A identidade e o proprietário da organização não podem ser alterados.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_organization_identity_trigger on public.organizations;
create trigger protect_organization_identity_trigger
before update on public.organizations
for each row execute function public.protect_organization_identity();

-- Impede escalada de papel, troca de usuário/organização e alteração do proprietário.
create or replace function public.protect_organization_member_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role') or auth.role() = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id then
    raise exception 'A identidade do membro não pode ser alterada.';
  end if;

  if old.role = 'owner' and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
  ) then
    raise exception 'O proprietário não pode ser rebaixado ou desativado.';
  end if;

  if new.role = 'owner' and old.role <> 'owner' then
    raise exception 'A promoção para proprietário exige processo administrativo seguro.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_organization_member_identity_trigger on public.organization_members;
create trigger protect_organization_member_identity_trigger
before update on public.organization_members
for each row execute function public.protect_organization_member_identity();

-- Dados estruturais de convites permanecem imutáveis após a criação.
create or replace function public.protect_organization_invitation_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role') or auth.role() = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.invited_by_user_id is distinct from old.invited_by_user_id
    or new.token is distinct from old.token then
    raise exception 'Os dados estruturais do convite não podem ser alterados.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_organization_invitation_identity_trigger on public.organization_invitations;
create trigger protect_organization_invitation_identity_trigger
before update on public.organization_invitations
for each row execute function public.protect_organization_invitation_identity();

-- Gestão de instância obedece à mesma matriz de permissões do backend.
drop policy if exists "whatsapp_instances_manage_admins" on public.whatsapp_instances;
drop policy if exists "whatsapp_instances_manage_authorized" on public.whatsapp_instances;
create policy "whatsapp_instances_manage_authorized"
  on public.whatsapp_instances
  for all
  using (public.organization_has_permission(organization_id, 'whatsapp:manage'))
  with check (public.organization_has_permission(organization_id, 'whatsapp:manage'));

-- Tokens OAuth são pessoais e não podem trocar de usuário ou organização.
create or replace function public.protect_google_calendar_connection_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('postgres', 'service_role') or auth.role() = 'service_role' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id then
    raise exception 'A identidade da conexão Google não pode ser alterada.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_google_calendar_connection_identity_trigger
  on public.google_calendar_connections;
create trigger protect_google_calendar_connection_identity_trigger
before update on public.google_calendar_connections
for each row execute function public.protect_google_calendar_connection_identity();
