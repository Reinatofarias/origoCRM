import "server-only";

import crypto from "node:crypto";

import type {
  EvolutionApiResponse,
  EvolutionIncomingMessage,
  EvolutionMessageStatus,
  EvolutionWebhookEvent,
} from "@/lib/types";
import { normalizePhone } from "@/lib/utils";
import { buildWhatsAppInstanceName } from "@/lib/whatsapp-instances";
import { createSupabaseServiceRoleClient } from "./supabase";

type EvolutionServerConfig = {
  apiUrl: string;
  apiKey: string;
  webhookKey?: string;
};

export type WhatsAppInstanceRecord = {
  id: string;
  organization_id: string;
  created_by_user_id: string | null;
  instance_name: string;
  provider: string;
  status: string;
  phone_number: string | null;
  profile_name: string | null;
  last_webhook_at: string | null;
  last_error: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getEvolutionServerConfig(): EvolutionServerConfig | null {
  const apiUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();

  if (!apiUrl || !apiKey) return null;

  try {
    const parsedUrl = new URL(apiUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ""),
    apiKey,
    webhookKey: process.env.EVOLUTION_WEBHOOK_KEY?.trim(),
  };
}

export function isEvolutionServerConfigured() {
  return Boolean(getEvolutionServerConfig());
}

export function getEvolutionInstanceEndpointForName(path: string, instanceName: string) {
  if (!instanceName.trim()) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedPath}/${encodeURIComponent(instanceName.trim())}`;
}

export async function getWhatsAppInstanceByOrganization(organizationId: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return { instance: null, error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };

  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "evolution")
    .maybeSingle();

  if (error) return { instance: null, error: error.message };
  return { instance: (data as WhatsAppInstanceRecord | null) ?? null, error: null };
}

export async function getWhatsAppInstanceByName(instanceName: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return { instance: null, error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };

  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (error) return { instance: null, error: error.message };
  return { instance: (data as WhatsAppInstanceRecord | null) ?? null, error: null };
}

export async function ensureWhatsAppInstanceForOrganization(input: {
  organizationId: string;
  userId: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return { instance: null, error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };

  const existing = await getWhatsAppInstanceByOrganization(input.organizationId);
  if (existing.error && existing.error.includes("whatsapp_instances")) {
    return { instance: null, error: "Aplique supabase/whatsapp_instances_migration.sql." };
  }
  if (existing.instance) {
    if (["created", "error", "provisioning"].includes(existing.instance.status)) {
      const provision = await provisionEvolutionInstance(existing.instance.instance_name);
      if (!provision.success) {
        return { instance: existing.instance, error: provision.error };
      }

      return {
        instance: { ...existing.instance, status: "created", last_error: null },
        error: null,
      };
    }

    return { instance: existing.instance, error: null };
  }

  const instanceName = buildWhatsAppInstanceName(input.organizationId);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .insert({
      organization_id: input.organizationId,
      created_by_user_id: input.userId,
      instance_name: instanceName,
      provider: "evolution",
      status: "created",
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return { instance: null, error: error.message };

  const instance = data as WhatsAppInstanceRecord;
  const provision = await provisionEvolutionInstance(instance.instance_name);
  return {
    instance: provision.success ? { ...instance, status: "created", last_error: null } : instance,
    error: provision.error,
  };
}

export async function provisionEvolutionInstance(instanceName: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  await updateWhatsAppInstance(instanceName, { status: "provisioning", last_error: null });

  const createResponse = await callEvolutionApi<Record<string, unknown>>(
    "/instance/create",
    {
      instanceName,
      qrcode: false,
      integration: "WHATSAPP-BAILEYS",
    },
    "POST",
  );

  if (createResponse.error && !createResponse.error.toLowerCase().includes("already")) {
    await updateWhatsAppInstance(instanceName, { status: "error", last_error: createResponse.error });
    return { success: false, error: createResponse.error };
  }

  await updateWhatsAppInstance(instanceName, { status: "created", last_error: null });

  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  if (!appUrl) return { success: true, error: null };

  const webhookResponse = await callEvolutionApi<Record<string, unknown>>(
    getEvolutionInstanceEndpointForName("/webhook/set", instanceName) ?? "",
    {
      enabled: true,
      url: `${appUrl}/api/webhooks/evolution`,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED",
      ],
    },
    "POST",
  );

  if (webhookResponse.error) {
    await updateWhatsAppInstance(instanceName, { last_error: webhookResponse.error });
    return { success: false, error: webhookResponse.error };
  }

  return { success: true, error: null };
}

export async function updateWhatsAppInstance(
  instanceName: string,
  patch: Partial<Pick<
    WhatsAppInstanceRecord,
    "status" | "phone_number" | "profile_name" | "last_webhook_at" | "last_error" | "connected_at" | "disconnected_at"
  >>,
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase
    .from("whatsapp_instances")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("instance_name", instanceName);
}

export async function callEvolutionApi<T>(
  endpoint: string,
  data: Record<string, unknown> | null,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
): Promise<EvolutionApiResponse<T>> {
  const config = getEvolutionServerConfig();

  if (!config) {
    return {
      status: 500,
      error: "Evolution API não configurada",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const canSendBody = method !== "GET";
    const requestInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    };

    if (canSendBody && data && Object.keys(data).length > 0) {
      requestInit.body = JSON.stringify(data);
    }

    const response = await fetch(`${config.apiUrl}${endpoint}`, requestInit);

    const responseData = (await response.json().catch(() => null)) as
      | (T & { message: string })
      | null;

    if (!response.ok) {
      const responseMessage =
        responseData && typeof (responseData as Record<string, unknown>).message === "string"
          ? String((responseData as Record<string, unknown>).message)
          : response.status === 401
            ? "A Evolution recusou a chave da API. Configure EVOLUTION_API_KEY com a chave global AUTHENTICATION_API_KEY do servidor Evolution, não com o token de uma instância."
            : response.status === 403
              ? "A chave configurada não tem permissão para executar esta ação na Evolution."
              : `Erro ${response.status}`;

      console.error("[evolution] API rejected request", {
        endpoint,
        method,
        status: response.status,
      });

      return {
        status: response.status,
        error: responseMessage,
      };
    }

    return {
      status: response.status,
      data: responseData as T,
    };
  } catch (error) {
    const transportError = describeEvolutionTransportError(error);
    let apiHost = "invalid-url";
    try {
      apiHost = new URL(config.apiUrl).host;
    } catch {
      // Configuration validation already handles malformed URLs.
    }
    console.error("[evolution] request failed", {
      apiHost,
      endpoint,
      method,
      code: transportError.code,
      message: transportError.technicalMessage,
    });

    return {
      status: error instanceof DOMException && error.name === "AbortError" ? 504 : 500,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "Tempo limite ao consultar a Evolution API"
          : transportError.userMessage,
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
  userId: string | null,
  organizationId: string | null,
  whatsappInstanceId: string | null = null,
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase.from("whatsapp_logs").insert({
    user_id: userId ?? null,
    organization_id: organizationId ?? null,
    whatsapp_instance_id: whatsappInstanceId,
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
  organizationId: string | null;
  whatsappInstanceId?: string | null;
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
    whatsapp_instance_id: input.whatsappInstanceId ?? null,
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
    remoteJid: null,
    contactName: null,
    contactAvatarUrl: null,
    lastMessage: input.content,
    direction: "outbound",
    status: "responded",
    whatsappInstanceId: input.whatsappInstanceId ?? null,
  });
}

function describeEvolutionTransportError(error: unknown) {
  const cause = error instanceof Error && error.cause && typeof error.cause === "object"
    ? (error.cause as { code?: string; message?: string })
    : null;
  const code = cause?.code ?? "UNKNOWN";
  const technicalMessage = cause?.message ?? (error instanceof Error ? error.message : "Unknown transport error");

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      code,
      technicalMessage,
      userMessage: "O endereço da Evolution não foi encontrado. Revise EVOLUTION_API_URL na Vercel.",
    };
  }
  if (code === "ECONNREFUSED") {
    return {
      code,
      technicalMessage,
      userMessage: "A Evolution recusou a conexão. Confirme se a API está pública e em execução.",
    };
  }
  if (code.includes("CERT") || code.includes("TLS")) {
    return {
      code,
      technicalMessage,
      userMessage: "A conexão segura com a Evolution falhou. Verifique o certificado HTTPS da API.",
    };
  }

  return {
    code,
    technicalMessage,
    userMessage: "Não foi possível acessar a Evolution. Confirme a URL pública HTTPS e a disponibilidade da API.",
  };
}

export async function fetchContactProfilePictureUrl(phoneNumber: string, instanceName?: string | null) {
  if (!instanceName) return null;

  const endpoint = getEvolutionInstanceEndpointForName("/chat/fetchProfilePictureUrl", instanceName);
  if (!endpoint) return null;

  const response = await callEvolutionApi<{ profilePictureUrl: string }>(
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

export function extractEvolutionInstanceName(payload: unknown) {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  const instance =
    getString(record, "instance") ??
    getString(record, "instanceName") ??
    getString(record, "instance_name") ??
    getString(data, "instance") ??
    getString(data, "instanceName") ??
    getString(data, "instance_name");

  return instance?.trim() || null;
}

export async function upsertWhatsAppConversation(input: {
  userId: string;
  organizationId: string | null;
  phoneNumber: string;
  leadId: string | null;
  remoteJid: string | null;
  contactName: string | null;
  contactAvatarUrl: string | null;
  lastMessage: string | null;
  direction: "inbound" | "outbound" | null;
  status?: "open" | "unread" | "waiting" | "responded" | "converted" | "resolved" | "archived";
  whatsappInstanceId?: string | null;
}) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  const phoneNumber = normalizePhone(input.phoneNumber);
  let whatsappInstanceId = input.whatsappInstanceId ?? null;
  if (input.organizationId && !whatsappInstanceId) {
    const { instance } = await getWhatsAppInstanceByOrganization(input.organizationId);
    whatsappInstanceId = instance?.id ?? null;
  }

  const payload: Record<string, unknown> = {
    user_id: input.userId,
    organization_id: input.organizationId ?? null,
    whatsapp_instance_id: whatsappInstanceId,
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
    onConflict: input.organizationId && whatsappInstanceId
      ? "organization_id,whatsapp_instance_id,phone_number"
      : "user_id,phone_number",
  });
}

export async function recordIncomingWhatsAppMessage(
  message: EvolutionIncomingMessage,
  context: { instanceName?: string | null } = {},
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;
  const normalizedMessage = normalizeIncomingWebhookMessage(message);
  const instanceName = context.instanceName ?? extractEvolutionInstanceName(message);
  const { instance } = instanceName ? await getWhatsAppInstanceByName(instanceName) : { instance: null };

  if (!normalizedMessage.remoteJid || !normalizedMessage.messageId) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      reason: "missing_remote_jid_or_message_id",
      message: message as unknown as Record<string, unknown>,
    }, null, null);
    return;
  }

  if (normalizedMessage.remoteJid.includes("@g.us")) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      remoteJid: normalizedMessage.remoteJid,
      messageId: normalizedMessage.messageId,
      reason: "group_message",
    }, null, null);
    return;
  }

  const phoneNumber = normalizePhone(normalizedMessage.remoteJid);
  const messageContent = normalizedMessage.content;
  if (!instance) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      phoneNumber,
      messageId: normalizedMessage.messageId,
      remoteJid: normalizedMessage.remoteJid,
      instanceName,
      reason: "unknown_or_missing_instance",
    }, null, null);
    return;
  }

  const lead = await findLeadByWhatsAppPhone(phoneNumber, instance?.organization_id ?? null);
  const owner = lead
    ? { userId: lead.user_id, organizationId: lead.organization_id ?? null }
    : await resolveInstanceOwner(instance);
  const ownerUserId = owner?.userId ?? null;
  const organizationId = lead?.organization_id ?? instance.organization_id ?? owner?.organizationId ?? null;
  const avatarUrl = await fetchContactProfilePictureUrl(phoneNumber, instance?.instance_name);

  if (!ownerUserId) {
    await logWhatsAppEvent("messages.upsert.unmatched", {
      phoneNumber,
      messageId: normalizedMessage.messageId,
      remoteJid: normalizedMessage.remoteJid,
      reason: "missing_lead_and_owner_user",
    }, null, organizationId, instance.id);
    return;
  }

  if (!lead) {
    await logWhatsAppEvent("messages.upsert.unmatched_saved", {
      phoneNumber,
      messageId: normalizedMessage.messageId,
      ownerUserId,
      organizationId,
      whatsappInstanceId: instance.id,
    }, ownerUserId, organizationId, instance?.id ?? null);
  }

  const now = new Date().toISOString();
  const direction = normalizedMessage.fromMe ? "outbound" : "inbound";
  await supabase.from("whatsapp_messages").upsert(
    {
      lead_id: lead?.id ?? null,
      user_id: ownerUserId,
      organization_id: organizationId,
      whatsapp_instance_id: instance.id,
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
    whatsappInstanceId: instance.id,
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

  await updateWhatsAppInstance(instance.instance_name, {
    last_webhook_at: now,
    last_error: null,
  });
}

function normalizeIncomingWebhookMessage(message: unknown) {
  const record = asRecord(message) ?? {};
  const key = asRecord(record.key) ?? {};
  const nestedData = asRecord(record.data) ?? {};
  const nestedKey = asRecord(nestedData.key) ?? {};
  const messageBody = asRecord(record.message) ?? asRecord(nestedData.message);

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
  const fromMe = Boolean(key.fromMe ?? nestedKey.fromMe ?? record.fromMe ?? nestedData.fromMe);

  const rawContactName = getString(record, "pushName") ?? getString(nestedData, "pushName") ?? null;

  return {
    remoteJid,
    messageId,
    fromMe,
    contactName: fromMe ? null : rawContactName,
    content: extractIncomingMessageContent(messageBody),
    status: record.status ?? nestedData.status,
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
    (audioMessage ? "Áudio recebido" : null) ??
    getString(videoMessage, "caption") ??
    (videoMessage ? "Vídeo recebido" : null) ??
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

async function resolveInstanceOwner(instance: WhatsAppInstanceRecord) {
  if (instance.created_by_user_id) {
    return { userId: instance.created_by_user_id, organizationId: instance.organization_id };
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("organizations")
    .select("owner_user_id")
    .eq("id", instance.organization_id)
    .maybeSingle();

  const ownerUserId = typeof data?.owner_user_id === "string" ? data.owner_user_id : null;
  return ownerUserId ? { userId: ownerUserId, organizationId: instance.organization_id } : null;
}

async function findLeadByWhatsAppPhone(phoneNumber: string, organizationId?: string | null) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const candidates = getBrazilianPhoneCandidates(phoneNumber);

  let exactQuery = supabase
    .from("leads")
    .select("id,user_id,organization_id,phone,created_at")
    .in("phone", candidates);

  if (organizationId) exactQuery = exactQuery.eq("organization_id", organizationId);

  const { data } = await exactQuery.order("created_at", { ascending: false }).limit(1);

  const exactLead = (data?.[0] as { id: string; user_id: string; organization_id: string | null } | undefined) ?? null;
  if (exactLead) return exactLead;

  let fallbackQuery = supabase
    .from("leads")
    .select("id,user_id,organization_id,phone,created_at");

  if (organizationId) fallbackQuery = fallbackQuery.eq("organization_id", organizationId);

  const { data: fallbackData } = await fallbackQuery.order("created_at", { ascending: false }).limit(200);

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

  return (fallbackLead as { id: string; user_id: string; organization_id: string | null } | undefined) ?? null;
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
