alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_status_check;

alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_status_check
  check (status in ('open', 'unread', 'waiting', 'responded', 'converted', 'resolved', 'archived'));

create index if not exists whatsapp_conversations_user_id_status_updated_at_idx
  on public.whatsapp_conversations(user_id, status, updated_at desc);
