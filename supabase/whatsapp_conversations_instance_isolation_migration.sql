-- Isolamento definitivo da inbox WhatsApp por organização e instância.
-- Execute depois de:
-- 1. saas_base_migration.sql
-- 2. whatsapp_instances_migration.sql
-- 3. whatsapp_conversation_organization_unique_migration.sql
--
-- Objetivo:
-- - impedir que conversas de um número/instância antiga apareçam na instância atual;
-- - permitir que duas organizações conversem com o mesmo telefone sem colisão;
-- - preparar o app para usar onConflict por organization_id + whatsapp_instance_id + phone_number.

alter table public.whatsapp_conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.whatsapp_conversations
  add column if not exists whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete set null;

alter table public.whatsapp_messages
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.whatsapp_messages
  add column if not exists whatsapp_instance_id uuid references public.whatsapp_instances(id) on delete set null;

-- Herda organização pelo lead quando existir.
update public.whatsapp_conversations c
set organization_id = l.organization_id
from public.leads l
where c.organization_id is null
  and c.lead_id = l.id
  and l.organization_id is not null;

update public.whatsapp_messages m
set organization_id = l.organization_id
from public.leads l
where m.organization_id is null
  and m.lead_id = l.id
  and l.organization_id is not null;

-- Herda organização pelo membro ativo para registros legados sem lead.
update public.whatsapp_conversations c
set organization_id = om.organization_id
from public.organization_members om
where c.organization_id is null
  and c.user_id = om.user_id
  and om.status = 'active';

update public.whatsapp_messages m
set organization_id = om.organization_id
from public.organization_members om
where m.organization_id is null
  and m.user_id = om.user_id
  and om.status = 'active';

-- Amarra conversas/mensagens à instância padrão da organização quando ainda não há vínculo.
update public.whatsapp_conversations c
set whatsapp_instance_id = wi.id
from public.whatsapp_instances wi
where c.whatsapp_instance_id is null
  and c.organization_id = wi.organization_id
  and wi.provider = 'evolution';

update public.whatsapp_messages m
set whatsapp_instance_id = wi.id
from public.whatsapp_instances wi
where m.whatsapp_instance_id is null
  and m.organization_id = wi.organization_id
  and wi.provider = 'evolution';

-- Se uma organização tiver duplicidade do mesmo telefone na mesma instância, mantém a mais recente.
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, whatsapp_instance_id, phone_number
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.whatsapp_conversations
  where organization_id is not null
    and whatsapp_instance_id is not null
)
delete from public.whatsapp_conversations c
using ranked r
where c.id = r.id
  and r.row_number > 1;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_user_id_phone_number_key;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_organization_phone_number_key;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_organization_instance_phone_key;

alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_organization_instance_phone_key
  unique (organization_id, whatsapp_instance_id, phone_number);

create index if not exists whatsapp_conversations_org_instance_status_updated_idx
  on public.whatsapp_conversations(organization_id, whatsapp_instance_id, status, updated_at desc);

create index if not exists whatsapp_messages_org_instance_phone_created_idx
  on public.whatsapp_messages(organization_id, whatsapp_instance_id, phone_number, created_at desc);

-- Recria políticas principais para membros ativos da organização.
alter table public.whatsapp_conversations enable row level security;

drop policy if exists "Users can manage own whatsapp conversations" on public.whatsapp_conversations;
drop policy if exists "whatsapp_conversations_select_members" on public.whatsapp_conversations;
drop policy if exists "whatsapp_conversations_manage_members" on public.whatsapp_conversations;

create policy "whatsapp_conversations_select_members"
on public.whatsapp_conversations
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
);

create policy "whatsapp_conversations_manage_members"
on public.whatsapp_conversations
for all
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager', 'seller', 'support')
  )
)
with check (
  auth.uid() = user_id
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = whatsapp_conversations.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager', 'seller', 'support')
  )
);
