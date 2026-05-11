create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null default 'followup' check (type in ('followup', 'call', 'email', 'whatsapp', 'other')),
  title text not null,
  notes text,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'completed', 'canceled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_status_due_at_idx
  on public.tasks(user_id, status, due_at);

create index if not exists tasks_user_id_lead_id_idx
  on public.tasks(user_id, lead_id);

alter table public.tasks enable row level security;

drop policy if exists "Users can manage own tasks" on public.tasks;
create policy "Users can manage own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();
