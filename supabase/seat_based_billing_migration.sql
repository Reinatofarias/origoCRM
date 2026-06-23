alter table public.subscriptions
  add column if not exists seat_count integer not null default 1;

alter table public.subscriptions
  drop constraint if exists subscriptions_seat_count_check;

alter table public.subscriptions
  add constraint subscriptions_seat_count_check check (seat_count >= 1);

update public.subscriptions
set seat_count = 1
where seat_count is null or seat_count < 1;
