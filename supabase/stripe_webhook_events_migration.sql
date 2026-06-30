-- Idempotência e rastreabilidade dos webhooks de cobrança Stripe.
-- Execute depois de saas_base_migration.sql e seat_based_billing_migration.sql.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  status text not null default 'processing',
  attempts integer not null default 1,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_webhook_events_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint stripe_webhook_events_attempts_check
    check (attempts > 0)
);

create index if not exists stripe_webhook_events_status_updated_at_idx
  on public.stripe_webhook_events(status, updated_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "No direct client access to Stripe webhook events"
  on public.stripe_webhook_events;
create policy "No direct client access to Stripe webhook events"
  on public.stripe_webhook_events
  for all
  using (false)
  with check (false);
