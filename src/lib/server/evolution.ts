import "server-only";

import crypto from "node:crypto";

import type {
  EvolutionApiResponse,
  EvolutionIncomingMessage,
  EvolutionMessageStatus,
  EvolutionWebhookEvent,
} from "@/lib/types";
import { normalizePhone } from "@/lib/utils";
import { createSupabaseServiceRoleClient } from "./supabase";

type EvolutionServerConfig = {
  apiUrl: string;
  apiKey: string;
  instanceName?: string;
  webhookKey?: string;
};

export function getEvolutionServerConfig(): EvolutionServerConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) return null;

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiKey,
    instanceName: process.env.EVOLUTION_INSTANCE_NAME,
    webhookKey: process.env.EVOLUTION_WEBHOOK_KEY,
  };
}

export function isEvolutionServerConfigured() {
  return Boolean(getEvolutionServerConfig());
}

export function getEvolutionInstanceEndpoint(path: string) {
  const config = getEvolutionServerConfig();
  if (!config?.instanceName) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedPath}/${encodeURIComponent(config.instanceName)}`;
}

export async function callEvolutionApi<T>(
  endpoint: string,
  data?: Record<string, unknown>,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
): Promise<EvolutionApiResponse<T>> {
  const config = getEvolutionServerConfig();

  if (!config) {
    return {
      status: 500,
      error: "Evolution API nao configurada",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    const responseData = (await response.json().catch(() => null)) as
      | (T & { message?: string })
      | null;

    if (!response.ok) {
      return {
        status: response.status,
        error:
          (responseData as Record<string, unknown> | null)?.message?.toString() ??
          `Erro ${response.status}`,
      };
    }

    return {
      status: response.status,
      data: responseData as T,
    };
  } catch (error) {
    return {
      status: error instanceof DOMException && error.name === "AbortError" ? 504 : 500,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Tempo limite ao consultar a Evolution API"
          : error instanceof Error
            ? error.message
            : "Erro desconhecido",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function validateEvolutionWebhook(signature: string) {
  const webhookKey = process.env.EVOLUTION_WEBHOOK_KEY;
  if (!webhookKey || !signature) return false;

  const normalizedSignature = signature.replace(/^Bearer\s+/i, "");
  if (normalizedSignature === webhookKey) return true;

  const expectedHash = crypto.createHash("sha256").update(webhookKey).digest();
  const receivedHash = crypto.createHash("sha256").update(normalizedSignature).digest();

  if (expectedHash.length !== receivedHash.length) return false;

  return crypto.timingSafeEqual(expectedHash, receivedHash);
}

export async function logWhatsAppEvent(
  eventType: EvolutionWebhookEvent | "webhook.error" | string,
  payload: Record<string, unknown>,
  userId?: string | null,
  organizationId?: string | null,
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase.from("whatsapp_logs").insert({
    user_id: userId ?? null,
    organization_id: organizationId ?? null,
    event_type: eventType,
    status: eventType === "webhook.error" ? "error" : "success",
    payload,
    error_message:
      eventType === "webhook.error" ? String(payload.error ?? "Unknown error") : null,
  });
}

export async function recordOutboundWhatsAppMessage(input: {
  leadId: string;
  userId: string;
  organizationId?: string | null;
  messageId: string;
  phoneNumber: string;
  content: string;
  status: EvolutionMessageStatus;
}) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase.from("whatsapp_messages").insert({
    lead_id: input.leadId,
    user_id: input.userId,
    organization_id: input.organizationId ?? null,
    message_id: input.messageId,
    phone_number: input.phoneNumber,
    direction: "outbound",
    content: input.content,
    status: input.status,
  });

  await upsertWhatsAppConversation({
    userId: input.userId,
    organizationId: input.organizationId,
    leadId: input.leadId,
    phoneNumber: input.phoneNumber,
    lastMessage: input.content,
    direction: "outbound",
    status: "responded",
  });
}

export async function fetchContactProfilePictureUrl(phoneNumber: string) {
  const endpoint = getEvolutionInstanceEndpoint("/chat/fetchProfilePictureUrl");
  if (!endpoint) return null;

  const response = await callEvolutionApi<{ profilePictureUrl?: string }>(
    endpoint,
    { number: normalizePhone(phoneNumber) },
    "POST",
  );

  if (response.error || !response.data?.profilePictureUrl) return null;
  return response.data.profilePictureUrl;
}

export async function updateStoredWhatsAppMessageStatus(
  messageId: string,
  status: EvolutionMessageStatus,
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase
    .from("whatsapp_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("message_id", messageId);
}

export async function upsertWhatsAppConversation(input: {
  userId: string;
  organizationId?: string | null;
  phoneNumber: string;
  leadId?: string | null;
  remoteJid?: string | null;
  contactName?: string | null;
  contactAvatarUrl?: string | null;
  lastMessage?: string | null;
  direction?: "inbound" | "outbound" | null;
  status?: "open" | "unread" | "waiting" | "responded" | "converted" | "resolved" | "archived";
}) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  const phoneNumber = normalizePhone(input.phoneNumber);
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    organization_id: input.organizationId ?? null,
    phone_number: phoneNumber,
    status: input.status ?? (input.direction === "inbound" ? "unread" : "responded"),
    updated_at: now,
  };

  if (input.leadId !== undefined) payload.lead_id = input.leadId;
  if (input.remoteJid) payload.remote_jid = input.remoteJid;
  if (input.contactName) payload.contact_name = input.contactName;
  if (input.contactAvatarUrl) payload.contact_avatar_url = input.contactAvatarUrl;
  if (input.lastMessage !== undefined) {
    payload.last_message = input.lastMessage ?? "";
    payload.last_message_at = now;
  }
  if (input.direction) {
    payload.last_message_direction = input.direction;
    payload.unread_count = input.direction === "inbound" ? 1 : 0;
    if (input.direction === "outbound") payload.last_read_at = now;
  }

  await supabase.from("whatsapp_conversations").upsert(payload, {
    onConflict: "user_id,phone_number",
  });
}

export async function recordIncomingWhatsAppMessage(message: EvolutionIncomingMessage) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;
  const normalizedMessage = normalizeIncomingWebhookMessage(message);

  if (!normalizedMessage.remoteJid || !normalizedMessage.messageId) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      reason: "missing_remote_jid_or_message_id",
      message: message as unknown as Record<string, unknown>,
    });
    return;
  }

  if (normalizedMessage.remoteJid.includes("@g.us")) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      remoteJid: normalizedMessage.remoteJid,
      messageId: normalizedMessage.messageId,
      reason: "group_message",
    });
    return;
  }

  const phoneNumber = normalizePhone(normalizedMessage.remoteJid);
  const messageContent = normalizedMessage.content;
  const lead = await findLeadByWhatsAppPhone(phoneNumber);
  const owner = lead ? { userId: lead.user_id, organizationId: lead.organization_id ?? null } : await resolveWebhookOwner();
  const ownerUserId = owner?.userId ?? null;
  const organizationId = lead?.organization_id ?? owner?.organizationId ?? null;
  const avatarUrl = await fetchContactProfilePictureUrl(phoneNumber);

  if (!ownerUserId) {
    await logWhatsAppEvent("messages.upsert.unmatched", {
      phoneNumber,
      messageId: normalizedMessage.messageId,
      remoteJid: normalizedMessage.remoteJid,
      reason: "missing_lead_and_owner_user",
    });
    return;
  }

  if (!lead) {
    await logWhatsAppEvent("messages.upsert.unmatched_saved", {
      phoneNumber,
      messageId: normalizedMessage.messageId,
      ownerUserId,
      organizationId,
    });
  }

  const now = new Date().toISOString();
  const direction = normalizedMessage.fromMe ? "outbound" : "inbound";
  await supabase.from("whatsapp_messages").upsert(
    {
      lead_id: lead?.id ?? null,
      user_id: ownerUserId,
      organization_id: organizationId,
      message_id: normalizedMessage.messageId,
      remote_jid: normalizedMessage.remoteJid,
      phone_number: phoneNumber,
      contact_name: normalizedMessage.contactName,
      contact_avatar_url: avatarUrl,
      direction,
      content: messageContent,
      status: normalizeEvolutionMessageStatus(
        normalizedMessage.status,
        direction === "outbound" ? "sent" : "delivered",
      ),
    },
    { onConflict: "message_id", ignoreDuplicates: true },
  );

  await upsertWhatsAppConversation({
    userId: ownerUserId,
    organizationId,
    leadId: lead?.id ?? null,
    phoneNumber,
    remoteJid: normalizedMessage.remoteJid,
    contactName: normalizedMessage.contactName,
    contactAvatarUrl: avatarUrl,
    lastMessage: messageContent,
    direction,
  });

  if (lead && direction === "inbound") {
    await Promise.all([
      supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: lead.user_id,
        organization_id: lead.organization_id ?? null,
        note: `Lead respondeu: ${messageContent || "mensagem recebida"}`,
        message: messageContent,
        type: "note",
        channel: "whatsapp",
      }),
      supabase
        .from("leads")
        .update({
          status: "respondeu",
          last_contact_at: now,
          updated_at: now,
        })
        .eq("id", lead.id),
    ]);
  }
}

function normalizeIncomingWebhookMessage(message: unknown) {
  const record = asRecord(message);
  const key = asRecord(record?.key);
  const nestedData = asRecord(record?.data);
  const nestedKey = asRecord(nestedData?.key);
  const messageBody = asRecord(record?.message) ?? asRecord(nestedData?.message);

  const remoteJid =
    getString(key, "remoteJid") ??
    getString(nestedKey, "remoteJid") ??
    getString(record, "remoteJid") ??
    getString(nestedData, "remoteJid") ??
    getString(record, "jid") ??
    getString(nestedData, "jid");
  const messageId =
    getString(key, "id") ??
    getString(nestedKey, "id") ??
    getString(record, "id") ??
    getString(record, "keyId") ??
    getString(record, "messageId") ??
    getString(nestedData, "id") ??
    getString(nestedData, "keyId") ??
    getString(nestedData, "messageId");
  const fromMe = Boolean(key?.fromMe ?? nestedKey?.fromMe ?? record?.fromMe ?? nestedData?.fromMe);

  return {
    remoteJid,
    messageId,
    fromMe,
    contactName: getString(record, "pushName") ?? getString(nestedData, "pushName") ?? null,
    content: extractIncomingMessageContent(messageBody),
    status: record?.status ?? nestedData?.status,
  };
}

function extractIncomingMessageContent(messageBody: Record<string, unknown> | null) {
  const extendedTextMessage = asRecord(messageBody?.extendedTextMessage);
  const imageMessage = asRecord(messageBody?.imageMessage);
  const audioMessage = asRecord(messageBody?.audioMessage);
  const documentMessage = asRecord(messageBody?.documentMessage);
  const videoMessage = asRecord(messageBody?.videoMessage);
  const stickerMessage = asRecord(messageBody?.stickerMessage);

  return (
    getString(messageBody, "conversation") ??
    getString(extendedTextMessage, "text") ??
    getString(imageMessage, "caption") ??
    (imageMessage ? "Imagem recebida" : null) ??
    (audioMessage ? "Audio recebido" : null) ??
    getString(videoMessage, "caption") ??
    (videoMessage ? "Video recebido" : null) ??
    getString(documentMessage, "fileName") ??
    (documentMessage ? "Documento recebido" : null) ??
    (stickerMessage ? "Sticker recebido" : null) ??
    ""
  );
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function resolveWebhookOwner() {
  const configuredOwner = process.env.ORIGOCRM_OWNER_USER_ID || process.env.CRM_OWNER_USER_ID;
  if (configuredOwner) return { userId: configuredOwner, organizationId: null as string | null };

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  for (const table of ["leads", "message_templates", "interactions"]) {
    const { data } = await supabase.from(table).select("user_id,organization_id").limit(1).maybeSingle();
    const row = data as { user_id?: string; organization_id?: string | null } | null;
    if (row?.user_id) return { userId: row.user_id, organizationId: row.organization_id ?? null };
  }

  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  const fallbackUserId = data.users[0]?.id ?? null;
  return fallbackUserId ? { userId: fallbackUserId, organizationId: null as string | null } : null;
}

async function findLeadByWhatsAppPhone(phoneNumber: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const candidates = getBrazilianPhoneCandidates(phoneNumber);

  const { data } = await supabase
    .from("leads")
    .select("id,user_id,organization_id,phone,created_at")
    .in("phone", candidates)
    .order("created_at", { ascending: false })
    .limit(1);

  const exactLead = (data?.[0] as { id: string; user_id: string; organization_id?: string | null } | undefined) ?? null;
  if (exactLead) return exactLead;

  const { data: fallbackData } = await supabase
    .from("leads")
    .select("id,user_id,organization_id,phone,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const fallbackLead = fallbackData?.find((lead) => {
    const normalizedLeadPhone = normalizePhone(String(lead.phone ?? ""));
    return (
      normalizedLeadPhone.length >= 8 &&
      candidates.some(
        (candidate) =>
          candidate.endsWith(normalizedLeadPhone) || normalizedLeadPhone.endsWith(candidate),
      )
    );
  });

  return (fallbackLead as { id: string; user_id: string; organization_id?: string | null } | undefined) ?? null;
}

function getBrazilianPhoneCandidates(phoneNumber: string) {
  const candidates = new Set([phoneNumber]);
  const localNumber = phoneNumber.startsWith("55") ? phoneNumber.slice(2) : phoneNumber;

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

  return Array.from(candidates);
}

function normalizeEvolutionMessageStatus(
  status: unknown,
  fallback: EvolutionMessageStatus,
): EvolutionMessageStatus {
  if (typeof status !== "string") return fallback;

  const normalized = status.toLowerCase();
  if (["pending", "sent", "delivered", "read", "failed"].includes(normalized)) {
    return normalized as EvolutionMessageStatus;
  }

  if (normalized.includes("read")) return "read";
  if (normalized.includes("delivery") || normalized.includes("delivered")) return "delivered";
  if (normalized.includes("server") || normalized.includes("sent")) return "sent";
  if (normalized.includes("error") || normalized.includes("fail")) return "failed";

  return fallback;
}
