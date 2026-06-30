create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8B5CF6',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create table if not exists public.whatsapp_conversation_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, tag_id)
);

create table if not exists public.prospecting_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  niche text not null default '',
  state text not null default '',
  city text not null default '',
  template_id uuid references public.message_templates(id) on delete set null,
  total_contacts integer not null default 0,
  whatsapp_validated_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  ignored_count integer not null default 0,
  status text not null default 'completed' check (status in ('draft', 'running', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospecting_campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.prospecting_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  phone text not null default '',
  category text not null default '',
  city text not null default '',
  state text not null default '',
  lead_score integer,
  dispatch_status text not null default 'new' check (dispatch_status in ('new', 'queued', 'sending', 'sent', 'failed', 'ignored', 'lead_added')),
  message text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tags_user_id_lower_name_idx on public.tags(user_id, lower(name));
create index if not exists lead_tags_user_id_lead_id_idx on public.lead_tags(user_id, lead_id);
create index if not exists lead_tags_user_id_tag_id_idx on public.lead_tags(user_id, tag_id);
create index if not exists whatsapp_conversation_tags_user_id_conversation_id_idx on public.whatsapp_conversation_tags(user_id, conversation_id);
create index if not exists prospecting_campaigns_user_id_created_at_idx on public.prospecting_campaigns(user_id, created_at desc);
create index if not exists prospecting_campaign_contacts_campaign_id_idx on public.prospecting_campaign_contacts(campaign_id);
create index if not exists prospecting_campaign_contacts_user_id_status_idx on public.prospecting_campaign_contacts(user_id, dispatch_status);

alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;
alter table public.whatsapp_conversation_tags enable row level security;
alter table public.prospecting_campaigns enable row level security;
alter table public.prospecting_campaign_contacts enable row level security;

drop policy if exists "Users can manage own tags" on public.tags;
create policy "Users can manage own tags"
  on public.tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own lead tags" on public.lead_tags;
create policy "Users can manage own lead tags"
  on public.lead_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own conversation tags" on public.whatsapp_conversation_tags;
create policy "Users can manage own conversation tags"
  on public.whatsapp_conversation_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own prospecting campaigns" on public.prospecting_campaigns;
create policy "Users can manage own prospecting campaigns"
  on public.prospecting_campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own prospecting campaign contacts" on public.prospecting_campaign_contacts;
create policy "Users can manage own prospecting campaign contacts"
  on public.prospecting_campaign_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists prospecting_campaigns_set_updated_at on public.prospecting_campaigns;
create trigger prospecting_campaigns_set_updated_at
before update on public.prospecting_campaigns
for each row execute function public.set_updated_at();
