alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks
  add constraint tasks_type_check
  check (type in ('followup', 'call', 'email', 'whatsapp', 'meeting', 'other'));
