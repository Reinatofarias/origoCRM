-- Lead Scoring: campos opcionais para persistir pontuacao comercial do lead.
-- O CRM ja calcula o score em tela; estes campos permitem salvar historico/calculo no banco em evolucoes futuras.

alter table public.leads
  add column if not exists lead_score integer;

alter table public.leads
  add column if not exists lead_score_label text;

alter table public.leads
  add column if not exists lead_score_reasons text[] not null default '{}';

alter table public.leads
  add column if not exists lead_score_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_lead_score_check'
  ) then
    alter table public.leads
      add constraint leads_lead_score_check
      check (lead_score is null or (lead_score >= 0 and lead_score <= 100));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_lead_score_label_check'
  ) then
    alter table public.leads
      add constraint leads_lead_score_label_check
      check (lead_score_label is null or lead_score_label in ('baixo', 'medio', 'alto', 'critico'));
  end if;
end $$;

create index if not exists leads_organization_id_lead_score_idx
  on public.leads(organization_id, lead_score desc);

create index if not exists leads_user_id_lead_score_idx
  on public.leads(user_id, lead_score desc);
