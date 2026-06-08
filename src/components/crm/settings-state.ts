import type { CrmPermission, CrmRole } from "@/lib/permissions";

export type SettingsTab = "system" | "whatsapp" | "templates" | "team" | "crm" | "audit" | "logs" | "data";

export type CrmPreferences = {
  companyName: string;
  brandName: string;
  defaultSlaHours: string;
  businessHours: string;
  defaultFollowupDays: string;
  defaultWhatsAppSource: string;
  defaultOwnerName: string;
};

export const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "system", label: "Sistema" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "templates", label: "Mensagens" },
  { id: "team", label: "Equipe" },
  { id: "crm", label: "CRM" },
  { id: "audit", label: "Auditoria" },
  { id: "logs", label: "Logs" },
  { id: "data", label: "Dados" },
];

export const roleOptions: CrmRole[] = ["owner", "admin", "manager", "seller", "support", "viewer"];

export const modulePermissionGroups: Array<{ label: string; permissions: CrmPermission[] }> = [
  { label: "CRM", permissions: ["lead:create", "lead:update", "pipeline:update"] },
  { label: "Conversas", permissions: ["conversation:update", "conversation:send"] },
  { label: "Tarefas", permissions: ["task:manage"] },
  { label: "Mensagens", permissions: ["template:manage"] },
  { label: "Prospecção", permissions: ["prospecting:use"] },
  { label: "Configurações", permissions: ["settings:manage"] },
];

export const sensitivePermissionGroups: Array<{ label: string; permissions: CrmPermission[] }> = [
  { label: "Excluir lead", permissions: ["lead:delete"] },
  { label: "Alterar funil", permissions: ["pipeline:update"] },
  { label: "Enviar mensagens", permissions: ["conversation:send"] },
  { label: "Desconectar WhatsApp", permissions: ["whatsapp:manage"] },
  { label: "Gerenciar cobrança", permissions: ["billing:manage"] },
];

export const defaultCrmPreferences: CrmPreferences = {
  companyName: "OrigoCRM",
  brandName: "OrigoCRM",
  defaultSlaHours: "24",
  businessHours: "08:00-18:00",
  defaultFollowupDays: "1",
  defaultWhatsAppSource: "WhatsApp",
  defaultOwnerName: "",
};

export const migrationSqlByLabel: Record<string, string> = {
  "Base SaaS": "Aplique o arquivo completo supabase/saas_base_migration.sql no SQL Editor do Supabase.",
  "Google Calendar": "Aplique o arquivo completo supabase/google_calendar_migration.sql no SQL Editor do Supabase.",
  "Campos comerciais": [
    "alter table public.leads add column if not exists estimated_value numeric(12,2);",
    "alter table public.leads add column if not exists owner_name text not null default '';",
    "alter table public.leads add column if not exists temperature text not null default 'morno';",
    "alter table public.leads add column if not exists outcome_reason text not null default '';",
    "alter table public.leads add column if not exists sla_hours integer not null default 24;",
    "alter table public.leads add column if not exists archived_at timestamptz;",
    "alter table public.leads drop constraint if exists leads_status_check;",
    "alter table public.leads drop constraint if exists leads_closed_outcome_reason_check;",
    "create index if not exists leads_user_id_temperature_idx on public.leads(user_id, temperature);",
    "create index if not exists leads_user_id_owner_name_idx on public.leads(user_id, owner_name);",
    "create index if not exists leads_user_id_archived_at_idx on public.leads(user_id, archived_at);",
  ].join("\n"),
  "Tabela de tarefas": [
    "create table if not exists public.tasks (",
    "  id uuid primary key default gen_random_uuid(),",
    "  user_id uuid not null references auth.users(id) on delete cascade,",
    "  lead_id uuid references public.leads(id) on delete cascade,",
    "  type text not null default 'followup',",
    "  title text not null,",
    "  notes text,",
    "  due_at timestamptz not null,",
    "  status text not null default 'open' check (status in ('open', 'completed', 'canceled')),",
    "  completed_at timestamptz,",
    "  created_at timestamptz not null default now(),",
    "  updated_at timestamptz not null default now()",
    ");",
    "alter table public.tasks alter column lead_id drop not null;",
    "alter table public.tasks drop constraint if exists tasks_type_check;",
    "alter table public.tasks add constraint tasks_type_check check (type in ('followup', 'call', 'email', 'whatsapp', 'meeting', 'other'));",
    "create index if not exists tasks_user_id_status_due_at_idx on public.tasks(user_id, status, due_at);",
    "create index if not exists tasks_user_id_lead_id_idx on public.tasks(user_id, lead_id);",
    "create index if not exists tasks_user_id_due_at_idx on public.tasks(user_id, due_at);",
    "alter table public.tasks enable row level security;",
  ].join("\n"),
  "Trilha de auditoria": [
    "create table if not exists public.audit_logs (",
    "  id uuid primary key default gen_random_uuid(),",
    "  user_id uuid references auth.users(id) on delete set null,",
    "  entity_type text not null check (entity_type in ('lead', 'task', 'template', 'whatsapp', 'system')),",
    "  entity_id uuid,",
    "  action text not null,",
    "  summary text not null,",
    "  metadata jsonb not null default '{}'::jsonb,",
    "  created_at timestamptz not null default now()",
    ");",
    "create index if not exists audit_logs_user_id_created_at_idx on public.audit_logs(user_id, created_at desc);",
    "create index if not exists audit_logs_user_id_entity_idx on public.audit_logs(user_id, entity_type, entity_id);",
    "alter table public.audit_logs enable row level security;",
  ].join("\n"),
  "Conversas operacionais": [
    "alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_status_check;",
    "alter table public.whatsapp_conversations add constraint whatsapp_conversations_status_check check (status in ('open', 'unread', 'waiting', 'responded', 'converted', 'resolved', 'archived'));",
    "create index if not exists whatsapp_conversations_user_id_status_updated_at_idx on public.whatsapp_conversations(user_id, status, updated_at desc);",
  ].join("\n"),
  "Tags e campanhas": [
    "create table if not exists public.tags (",
    "  id uuid primary key default gen_random_uuid(),",
    "  user_id uuid not null references auth.users(id) on delete cascade,",
    "  name text not null,",
    "  color text not null default '#8B5CF6',",
    "  created_at timestamptz not null default now()",
    ");",
    "create table if not exists public.lead_tags (",
    "  user_id uuid not null references auth.users(id) on delete cascade,",
    "  lead_id uuid not null references public.leads(id) on delete cascade,",
    "  tag_id uuid not null references public.tags(id) on delete cascade,",
    "  created_at timestamptz not null default now(),",
    "  primary key (lead_id, tag_id)",
    ");",
    "create table if not exists public.prospecting_campaigns (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, niche text not null default '', state text not null default '', city text not null default '', template_id uuid references public.message_templates(id) on delete set null, total_contacts integer not null default 0, whatsapp_validated_count integer not null default 0, sent_count integer not null default 0, failed_count integer not null default 0, ignored_count integer not null default 0, status text not null default 'completed', created_at timestamptz not null default now(), updated_at timestamptz not null default now());",
    "create table if not exists public.prospecting_campaign_contacts (id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.prospecting_campaigns(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, business_name text not null, phone text not null default '', category text not null default '', city text not null default '', state text not null default '', lead_score integer, dispatch_status text not null default 'new', message text, error text, sent_at timestamptz, created_at timestamptz not null default now());",
    "create unique index if not exists tags_user_id_lower_name_idx on public.tags(user_id, lower(name));",
    "create index if not exists lead_tags_user_id_lead_id_idx on public.lead_tags(user_id, lead_id);",
    "create index if not exists prospecting_campaigns_user_id_created_at_idx on public.prospecting_campaigns(user_id, created_at desc);",
    "alter table public.tags enable row level security;",
    "alter table public.lead_tags enable row level security;",
    "alter table public.prospecting_campaigns enable row level security;",
    "alter table public.prospecting_campaign_contacts enable row level security;",
  ].join("\n"),
};

export function readCrmPreferences(): CrmPreferences {
  if (typeof window === "undefined") return defaultCrmPreferences;

  try {
    const raw = window.localStorage.getItem("origocrm:settings");
    return raw ? { ...defaultCrmPreferences, ...JSON.parse(raw) } : defaultCrmPreferences;
  } catch {
    return defaultCrmPreferences;
  }
}

export function readUserRole(): CrmRole {
  if (typeof window === "undefined") return "owner";
  const value = window.localStorage.getItem("origocrm:user-role");
  if (value === "readonly") return "viewer";
  return roleOptions.includes(value as CrmRole) ? (value as CrmRole) : "owner";
}
