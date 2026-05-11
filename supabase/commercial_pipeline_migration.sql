alter table public.leads add column if not exists estimated_value numeric(12,2);
alter table public.leads add column if not exists owner_name text not null default '';
alter table public.leads add column if not exists temperature text not null default 'morno';
alter table public.leads add column if not exists outcome_reason text not null default '';
alter table public.leads add column if not exists sla_hours integer not null default 24;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_temperature_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_temperature_check
      check (temperature in ('frio', 'morno', 'quente'));
  end if;
end $$;

create index if not exists leads_user_id_temperature_idx on public.leads(user_id, temperature);
create index if not exists leads_user_id_owner_name_idx on public.leads(user_id, owner_name);
