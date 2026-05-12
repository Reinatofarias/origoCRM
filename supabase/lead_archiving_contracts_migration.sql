alter table public.leads add column if not exists archived_at timestamptz;

create index if not exists leads_user_id_archived_at_idx
  on public.leads(user_id, archived_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_closed_outcome_reason_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_closed_outcome_reason_check
      check (status <> 'fechado' or length(trim(coalesce(outcome_reason, ''))) > 0)
      not valid;
  end if;
end $$;
