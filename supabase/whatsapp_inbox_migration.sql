alter table public.whatsapp_messages alter column lead_id drop not null;
alter table public.whatsapp_messages add column if not exists remote_jid text;
alter table public.whatsapp_messages add column if not exists contact_name text;
