import type { PipelineStage } from "@/components/crm/pipeline-state";
import type { Lead, LeadStatus, WhatsAppConversation, WhatsAppMessage } from "@/lib/types";
import { normalizePhone, renderTemplate } from "@/lib/utils";

export type ConversationStatusFilter = "all" | "unread" | "waiting" | "responded" | "converted" | "resolved" | "archived";
export type ConversationLeadFilter = "all" | "without" | "with";
export type ConversationPriorityFilter = "all" | "failed" | "hot" | "unassigned" | "today";
export type ConversationSort = "recent" | "unread" | "oldestWaiting" | "hot";
export type ConversationStatus = Exclude<ConversationStatusFilter, "all">;
export type ConversationCounts = {
  all: number;
  unread: number;
  waiting: number;
  responded: number;
  converted: number;
  resolved: number;
  archived: number;
};

export const conversationStatusTabs: Array<{
  id: ConversationStatusFilter;
  label: string;
  countKey: keyof ConversationCounts;
}> = [
  { id: "all", label: "Todas", countKey: "all" },
  { id: "unread", label: "Não lidas", countKey: "unread" },
  { id: "waiting", label: "Aguardando", countKey: "waiting" },
  { id: "responded", label: "Respondidas", countKey: "responded" },
  { id: "converted", label: "Convertidas", countKey: "converted" },
  { id: "resolved", label: "Resolvidas", countKey: "resolved" },
  { id: "archived", label: "Arquivadas", countKey: "archived" },
];

export function conversationStatus(
  direction: WhatsAppMessage["direction"],
  hasLinkedLead: boolean,
  unreadCount: number,
  storedStatus: WhatsAppConversation["status"] | null,
): ConversationStatus {
  if (storedStatus === "archived" || storedStatus === "resolved") return storedStatus;
  if (hasLinkedLead) return "converted";
  if (unreadCount > 0) return "unread";
  if (direction === "outbound") return "waiting";
  return "responded";
}

export function countPendingInboundMessages(messages: WhatsAppMessage[]) {
  const lastOutboundAt = Math.max(
    0,
    ...messages
      .filter((message) => message.direction === "outbound")
      .map((message) => new Date(message.created_at).getTime()),
  );

  return messages.filter(
    (message) =>
      message.direction === "inbound" && new Date(message.created_at).getTime() > lastOutboundAt,
  ).length;
}

export function conversationStatusLabel(status: ConversationStatus) {
  const labels: Record<ConversationStatus, string> = {
    unread: "Não lida",
    waiting: "Aguardando resposta",
    responded: "Respondida",
    converted: "Convertida em lead",
    resolved: "Resolvida",
    archived: "Arquivada",
  };

  return labels[status];
}

export function messageStatusLabel(status: WhatsAppMessage["status"]) {
  const labels: Record<WhatsAppMessage["status"], string> = {
    pending: "pendente",
    sent: "enviada",
    delivered: "entregue",
    read: "lida",
    failed: "falhou",
  };

  return labels[status] ?? status;
}

export function previewTemplateText(
  text: string,
  conversation:
    | {
        contactName: string;
        phone: string;
        lead?: Lead | null;
      }
    | undefined,
) {
  if (!conversation) return text;

  const now = new Date().toISOString();
  const lead: Lead = conversation.lead ?? {
    id: "",
    user_id: null,
    organization_id: null,
    name: conversation.contactName,
    phone: conversation.phone,
    company: "",
    source: "WhatsApp",
    status: "novo",
    estimated_value: null,
    owner_name: null,
    temperature: null,
    outcome_reason: null,
    sla_hours: null,
    last_contact_at: null,
    next_followup_at: null,
    lead_score: null,
    lead_score_label: null,
    lead_score_reasons: null,
    lead_score_updated_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };

  return renderTemplate(text, lead);
}

export function findLeadByPhone(leads: Lead[], phone: string) {
  const candidates = getPhoneCandidates(phone);
  if (candidates.length === 0) return null;

  return (
    leads.find((lead) => {
      const normalized = normalizePhone(lead.phone);
      if (normalized.length < 8) return false;
      return candidates.includes(normalized);
    }) ?? null
  );
}

export function getPhoneCandidates(phone: string) {
  const normalized = normalizePhone(phone);
  const candidates = new Set([normalized]);
  const localNumber = normalized.startsWith("55") ? normalized.slice(2) : normalized;

  candidates.add(localNumber);
  candidates.add(`55${localNumber}`);

  if (localNumber.length === 10) {
    const withNinthDigit = `${localNumber.slice(0, 2)}9${localNumber.slice(2)}`;
    candidates.add(withNinthDigit);
    candidates.add(`55${withNinthDigit}`);
  }

  if (localNumber.length === 11 && localNumber[2] === "9") {
    const withoutNinthDigit = `${localNumber.slice(0, 2)}${localNumber.slice(3)}`;
    candidates.add(withoutNinthDigit);
    candidates.add(`55${withoutNinthDigit}`);
  }

  return Array.from(candidates).filter(Boolean);
}

export function getRepeatedOutboundContactNames(messages: WhatsAppMessage[]) {
  const phonesByName = new Map<string, Set<string>>();

  for (const message of messages) {
    const contactName = message.contact_name?.trim() ?? "";
    if (message.direction !== "outbound" || !contactName) continue;
    const key = normalizeConversationName(contactName);
    if (!key) continue;
    const phones = phonesByName.get(key) ?? new Set<string>();
    phones.add(message.phone_number);
    phonesByName.set(key, phones);
  }

  return new Set(
    Array.from(phonesByName.entries())
      .filter(([, phones]) => phones.size > 1)
      .map(([name]) => name),
  );
}

export function getSafeConversationContactName(name: string | null | undefined, repeatedOutboundNames: Set<string>) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  if (repeatedOutboundNames.has(normalizeConversationName(trimmed))) return null;
  return trimmed;
}

export function normalizeConversationName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getStageTitle(columns: PipelineStage[], status: LeadStatus) {
  return columns.find((column) => column.id === status)?.title ?? status;
}

export function applyMessageRealtimeEvent(current: WhatsAppMessage[], payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) {
  if (payload.eventType === "INSERT") {
    const next = payload.new as WhatsAppMessage;
    if (current.some((message) => message.id === next.id)) return current;
    return [...current, next].sort(sortWhatsAppMessages);
  }

  if (payload.eventType === "UPDATE") {
    const next = payload.new as WhatsAppMessage;
    return current.map((message) => (message.id === next.id ? next : message)).sort(sortWhatsAppMessages);
  }

  if (payload.eventType === "DELETE") {
    return current.filter((message) => message.id !== payload.old.id);
  }

  return current;
}

export function upsertWhatsAppMessage(current: WhatsAppMessage[], next: WhatsAppMessage) {
  const exists = current.some((message) => message.id === next.id || message.message_id === next.message_id);
  return (exists
    ? current.map((message) => (message.id === next.id || message.message_id === next.message_id ? next : message))
    : [...current, next]
  ).sort(sortWhatsAppMessages);
}

export function applyConversationRealtimeEvent(current: WhatsAppConversation[], payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) {
  if (payload.eventType === "INSERT") {
    const next = payload.new as WhatsAppConversation;
    return upsertLocalConversation(current, next);
  }

  if (payload.eventType === "UPDATE") {
    const next = payload.new as WhatsAppConversation;
    return upsertLocalConversation(current, next);
  }

  if (payload.eventType === "DELETE") {
    return current.filter((conversation) => conversation.id !== payload.old.id);
  }

  return current;
}

export function upsertLocalConversation(current: WhatsAppConversation[], next: WhatsAppConversation) {
  const exists = current.some((conversation) => conversation.id === next.id || conversation.phone_number === next.phone_number);
  const items = exists
    ? current.map((conversation) =>
        conversation.id === next.id || conversation.phone_number === next.phone_number ? next : conversation,
      )
    : [next, ...current];

  return items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function sortWhatsAppMessages(a: WhatsAppMessage, b: WhatsAppMessage) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function getWhatsAppMessageDisplay(message: WhatsAppMessage) {
  if (message.content.trim()) return message.content;
  if (message.media_url) return "Mídia recebida";
  return message.direction === "inbound" ? "Mensagem recebida" : "Mensagem enviada";
}

export function sortConversations<
  T extends {
    unreadCount: number;
    lastMessage: WhatsAppMessage;
    activeLead: Lead | null;
  },
>(a: T, b: T, mode: ConversationSort) {
  if (mode === "unread") {
    const unreadDiff = b.unreadCount - a.unreadCount;
    if (unreadDiff !== 0) return unreadDiff;
  }

  if (mode === "oldestWaiting") {
    const aInbound = a.lastMessage.direction === "inbound" ? 0 : 1;
    const bInbound = b.lastMessage.direction === "inbound" ? 0 : 1;
    if (aInbound !== bInbound) return aInbound - bInbound;
    return new Date(a.lastMessage.created_at).getTime() - new Date(b.lastMessage.created_at).getTime();
  }

  if (mode === "hot") {
    const aHot = a.activeLead?.temperature === "quente" ? 1 : 0;
    const bHot = b.activeLead?.temperature === "quente" ? 1 : 0;
    if (aHot !== bHot) return bHot - aHot;
  }

  return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
}
