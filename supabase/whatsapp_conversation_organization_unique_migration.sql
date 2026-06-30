-- Isola conversas WhatsApp por organizacao.
-- Necessario para SaaS: duas organizacoes podem conversar com o mesmo telefone sem colisao.

alter table public.whatsapp_conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.whatsapp_conversations c
set organization_id = l.organization_id
from public.leads l
where c.organization_id is null
  and c.lead_id = l.id
  and l.organization_id is not null;

update public.whatsapp_conversations c
set organization_id = om.organization_id
from public.organization_members om
where c.organization_id is null
  and c.user_id = om.user_id
  and om.status = 'active';

with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, phone_number
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.whatsapp_conversations
  where organization_id is not null
)
delete from public.whatsapp_conversations c
using ranked r
where c.id = r.id
  and r.row_number > 1;

alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_organization_phone_number_key;

alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_organization_phone_number_key
  unique (organization_id, phone_number);

create index if not exists whatsapp_conversations_organization_status_updated_at_idx
  on public.whatsapp_conversations(organization_id, status, updated_at desc);

create index if not exists whatsapp_conversations_organization_phone_number_idx
  on public.whatsapp_conversations(organization_id, phone_number);
