alter table public.tasks alter column lead_id drop not null;

create index if not exists tasks_user_id_due_at_idx
  on public.tasks(user_id, due_at);
