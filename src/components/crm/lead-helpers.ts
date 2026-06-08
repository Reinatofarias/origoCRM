import { defaultClosedStageIds } from "@/components/crm/pipeline-state";
import type { Lead, LeadInput, LeadStatus, Task } from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

export type TaskRepeat = "none" | "weekly" | "monthly" | "daily";

export function isLeadClosed(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  return closedStageIds.has(lead.status);
}

export function isFollowupDue(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.next_followup_at || isLeadClosed(lead, closedStageIds)) return false;
  const dueAt = new Date(lead.next_followup_at);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

export function isFollowupOverdue(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.next_followup_at || isLeadClosed(lead, closedStageIds)) return false;
  return new Date(lead.next_followup_at).getTime() < startOfDay(new Date()).getTime();
}

export function isTaskDueToday(task: Task) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

export function isTaskDueOnDate(task: Task, date: Date) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return startOfDay(dueAt).getTime() === startOfDay(date).getTime();
}

export function isTaskOverdue(task: Task) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return dueAt.getTime() < startOfDay(new Date()).getTime();
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function isLeadCreatedToday(lead: Lead) {
  return startOfDay(new Date(lead.created_at)).getTime() === startOfDay(new Date()).getTime();
}

export function getFollowupLabel(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (isLeadClosed(lead, closedStageIds)) return { text: "Concluído", tone: "text-zinc-500" };
  if (!lead.next_followup_at) return { text: "Sem follow-up", tone: "text-zinc-500" };

  const dueAt = new Date(lead.next_followup_at);
  const today = new Date();
  const diffDays = Math.ceil(
    (startOfDay(dueAt).getTime() - startOfDay(today).getTime()) / 86400000,
  );

  if (diffDays < 0) return { text: "Follow-up atrasado", tone: "text-red-300" };
  if (diffDays === 0) return { text: "Follow-up hoje", tone: "text-amber-300" };
  if (diffDays === 1) return { text: "Follow-up amanhã", tone: "text-[#25D366]" };
  return {
    text: `Follow-up ${dueAt.toLocaleDateString("pt-BR")}`,
    tone: "text-zinc-400",
  };
}

export function getDueAtLabel(value: string) {
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return { text: "Data inválida", tone: "text-red-300" };

  const today = new Date();
  const diffDays = Math.ceil(
    (startOfDay(dueAt).getTime() - startOfDay(today).getTime()) / 86400000,
  );
  const time = dueAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (diffDays < 0) return { text: `Atrasado desde ${dueAt.toLocaleDateString("pt-BR")}`, tone: "text-red-300" };
  if (diffDays === 0) return { text: `Hoje às ${time}`, tone: "text-amber-300" };
  if (diffDays === 1) return { text: `Amanhã às ${time}`, tone: "text-[#25D366]" };
  return {
    text: `${dueAt.toLocaleDateString("pt-BR")} às ${time}`,
    tone: "text-zinc-400",
  };
}

export function taskTypeLabel(type: Task["type"]) {
  if (type === "followup") return "Follow-up";
  if (type === "call") return "Ligação";
  if (type === "email") return "Email";
  if (type === "whatsapp") return "WhatsApp";
  if (type === "meeting") return "Reunião";
  return "Outro";
}

export function taskRepeatLabel(repeat: TaskRepeat) {
  if (repeat === "daily") return "Diária";
  if (repeat === "weekly") return "Semanal";
  if (repeat === "monthly") return "Mensal";
  return "Não repetir";
}

export function getTaskRepeat(task: Pick<Task, "notes">): TaskRepeat {
  const match = task.notes?.match(/\[\[repeat:(none|daily|weekly|monthly)\]\]/);
  return (match?.[1] as TaskRepeat | undefined) ?? "none";
}

export function stripTaskMetadata(notes: string | null) {
  return (notes ?? "").replace(/\s*\[\[repeat:(none|daily|weekly|monthly)\]\]\s*/g, "").trim();
}

export function buildTaskNotes(notes: string, repeat: TaskRepeat) {
  const cleanNotes = stripTaskMetadata(notes);
  if (repeat === "none") return cleanNotes || null;
  return `${cleanNotes}${cleanNotes ? "\n" : ""}[[repeat:${repeat}]]`;
}

export function formatGoogleCalendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarUrl(input: {
  title: string;
  startsAt: string;
  details: string | null;
  lead: Lead | null;
}) {
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) return null;

  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + 30);

  const details = [
    input.details,
    input.lead ? `Lead: ${input.lead.name}` : null,
    input.lead?.phone ? `Telefone: ${input.lead.phone}` : null,
    input.lead?.company ? `Empresa: ${input.lead.company}` : null,
  ].filter(Boolean).join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title || "Tarefa OrigoCRM",
    dates: `${formatGoogleCalendarDate(startsAt)}/${formatGoogleCalendarDate(endsAt)}`,
    details,
  });

  return `https://calendar.google.com/calendar/render${params.toString()}`;
}

export function openGoogleCalendarEvent(input: {
  title: string;
  startsAt: string;
  details: string | null;
  lead: Lead | null;
}) {
  const url = buildGoogleCalendarUrl(input);
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function getNextRecurringDueAt(value: string, repeat: TaskRepeat) {
  if (repeat === "none") return null;

  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return null;

  if (repeat === "daily") dueAt.setDate(dueAt.getDate() + 1);
  if (repeat === "weekly") dueAt.setDate(dueAt.getDate() + 7);
  if (repeat === "monthly") dueAt.setMonth(dueAt.getMonth() + 1);

  return dueAt.toISOString();
}

export function isCommercialTask(task: Task) {
  return Boolean(task.lead_id);
}

export function getLastContactLabel(lead: Lead) {
  if (!lead.last_contact_at) return "Sem contato";

  const contactedAt = new Date(lead.last_contact_at);
  const today = new Date();
  const diffDays = Math.floor(
    (startOfDay(today).getTime() - startOfDay(contactedAt).getTime()) / 86400000,
  );

  if (diffDays <= 0) return "Contato hoje";
  if (diffDays === 1) return "Contato ontem";
  return `Contato há ${diffDays} dias`;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function isSameDay(value: string, date: Date) {
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return false;
  return startOfDay(current).getTime() === startOfDay(date).getTime();
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }
  return date.toISOString();
}

export function isSameFollowupDay(value: string, days: number) {
  const selected = new Date(value);
  const quickDate = new Date();
  quickDate.setDate(quickDate.getDate() + days);
  return startOfDay(selected).getTime() === startOfDay(quickDate).getTime();
}

export function formatPhoneCompact(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return normalized || phone;
  return `${normalized.slice(0, -4)}-${normalized.slice(-4)}`;
}

export function getLeadInitials(lead: Lead) {
  return lead.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function getColumnHealth(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  const due = leads.filter((lead) => isFollowupDue(lead, closedStageIds)).length;
  if (due > 0) return `${due} com follow-up`;
  return leads.length ? "Em dia" : "Sem itens";
}

export function getPipelineColumnStats(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  const value = leads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);
  const overdue = leads.filter((lead) => isFollowupOverdue(lead, closedStageIds)).length;
  const hot = leads.filter((lead) => (lead.temperature ?? "morno") === "quente").length;
  const noAction = leads.filter(
    (lead) => !isLeadClosed(lead, closedStageIds) && lead.status !== "novo" && !lead.next_followup_at,
  ).length;

  return { value, overdue, hot, noAction };
}

export function getLeadUrgencyScore(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  let score = 0;
  if (isFollowupOverdue(lead, closedStageIds)) score += 100;
  else if (isFollowupDue(lead, closedStageIds)) score += 70;
  if ((lead.temperature ?? "morno") === "quente") score += 35;
  if (lead.status === "proposta") score += 20;
  if (!isLeadClosed(lead, closedStageIds) && lead.status !== "novo" && !lead.next_followup_at) score += 25;
  if (!lead.owner_name) score += 8;
  return score;
}

export function sortPipelineLeadsByUrgency(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  return [...leads].sort((a, b) => {
    const scoreDiff = getLeadUrgencyScore(b, closedStageIds) - getLeadUrgencyScore(a, closedStageIds);
    if (scoreDiff !== 0) return scoreDiff;

    const nextFollowupA = a.next_followup_at ? new Date(a.next_followup_at).getTime() : Number.MAX_SAFE_INTEGER;
    const nextFollowupB = b.next_followup_at ? new Date(b.next_followup_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (nextFollowupA !== nextFollowupB) return nextFollowupA - nextFollowupB;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export function getSourceLabel(source: string) {
  return source.trim() || "Origem não informada";
}

export function formatCurrency(value: number | null) {
  if (!value) return null;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function leadToInput(lead: Lead): LeadInput {
  return {
    name: lead.name,
    phone: lead.phone,
    company: lead.company,
    source: lead.source,
    status: lead.status,
    estimated_value: lead.estimated_value ?? null,
    owner_name: lead.owner_name ?? "",
    temperature: lead.temperature ?? "morno",
    outcome_reason: lead.outcome_reason ?? "",
    sla_hours: lead.sla_hours ?? 24,
  };
}

export function getTemperatureLabel(temperature: Lead["temperature"] | null) {
  if (temperature === "quente") return { text: "Quente", tone: "border-red-400/25 bg-red-500/10 text-red-200" };
  if (temperature === "frio") return { text: "Frio", tone: "border-sky-400/25 bg-sky-500/10 text-sky-200" };
  return { text: "Morno", tone: "border-amber-400/25 bg-amber-500/10 text-amber-100" };
}

export function getSlaLabel(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.last_contact_at || !lead.sla_hours || isLeadClosed(lead, closedStageIds)) return null;

  const expiresAt = new Date(lead.last_contact_at).getTime() + lead.sla_hours * 60 * 60 * 1000;
  const remainingHours = Math.ceil((expiresAt - Date.now()) / 3600000);

  if (remainingHours < 0) return { text: "SLA vencido", tone: "text-red-300" };
  if (remainingHours <= 4) return { text: `SLA ${remainingHours}h`, tone: "text-amber-300" };
  return { text: `SLA ${remainingHours}h`, tone: "text-zinc-500" };
}
