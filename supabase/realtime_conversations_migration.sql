-- Enable Supabase Realtime for the WhatsApp inbox tables.
-- Required so the Conversas module receives new messages/conversation changes without refresh.

alter table if exists public.whatsapp_messages replica identity full;
alter table if exists public.whatsapp_conversations replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_messages'
    ) then
      execute 'alter publication supabase_realtime add table public.whatsapp_messages';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'whatsapp_conversations'
    ) then
      execute 'alter publication supabase_realtime add table public.whatsapp_conversations';
    end if;
  end if;
end $$;
