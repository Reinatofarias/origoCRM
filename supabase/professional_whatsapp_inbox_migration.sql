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

create index if not exists whatsapp_conversations_user_id_updated_at_idx
  on public.whatsapp_conversations(user_id, updated_at desc);

create index if not exists whatsapp_conversations_user_id_status_idx
  on public.whatsapp_conversations(user_id, status);

alter table public.whatsapp_conversations enable row level security;

drop policy if exists "Users can manage own whatsapp conversations" on public.whatsapp_conversations;
create policy "Users can manage own whatsapp conversations"
  on public.whatsapp_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
        and tablename = 'whatsapp_conversations'
    ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;
end $$;
