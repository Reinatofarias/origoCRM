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
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase.from("whatsapp_logs").insert({
    user_id: userId ?? null,
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
    message_id: input.messageId,
    phone_number: input.phoneNumber,
    direction: "outbound",
    content: input.content,
    status: input.status,
  });
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

export async function recordIncomingWhatsAppMessage(message: EvolutionIncomingMessage) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;
  if (message.key.remoteJid.includes("@g.us")) {
    await logWhatsAppEvent("messages.upsert.ignored", {
      remoteJid: message.key.remoteJid,
      messageId: message.key.id,
      reason: "group_message",
    });
    return;
  }

  const phoneNumber = normalizePhone(message.key.remoteJid);
  const messageContent =
    message.message.conversation ??
    message.message.extendedTextMessage?.text ??
    message.message.imageMessage?.caption ??
    message.message.documentMessage?.fileName ??
    "";
  const lead = await findLeadByWhatsAppPhone(phoneNumber);
  const ownerUserId = lead?.user_id ?? (await resolveWebhookOwnerUserId());

  if (!ownerUserId) {
    await logWhatsAppEvent("messages.upsert.unmatched", {
      phoneNumber,
      messageId: message.key.id,
      remoteJid: message.key.remoteJid,
      reason: "missing_lead_and_owner_user",
    });
    return;
  }

  if (!lead) {
    await logWhatsAppEvent("messages.upsert.unmatched_saved", {
      phoneNumber,
      messageId: message.key.id,
      ownerUserId,
    });
  }

  const now = new Date().toISOString();
  const direction = message.key.fromMe ? "outbound" : "inbound";
  await supabase.from("whatsapp_messages").upsert(
    {
      lead_id: lead?.id ?? null,
      user_id: ownerUserId,
      message_id: message.key.id,
      remote_jid: message.key.remoteJid,
      phone_number: phoneNumber,
      contact_name: message.pushName ?? null,
      direction,
      content: messageContent,
      status: normalizeEvolutionMessageStatus(
        message.status,
        direction === "outbound" ? "sent" : "delivered",
      ),
    },
    { onConflict: "message_id", ignoreDuplicates: true },
  );

  if (lead && direction === "inbound") {
    await Promise.all([
      supabase.from("interactions").insert({
        lead_id: lead.id,
        user_id: lead.user_id,
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

async function resolveWebhookOwnerUserId() {
  const configuredOwner = process.env.ORIGOCRM_OWNER_USER_ID || process.env.CRM_OWNER_USER_ID;
  if (configuredOwner) return configuredOwner;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  for (const table of ["leads", "message_templates", "interactions"]) {
    const { data } = await supabase.from(table).select("user_id").limit(1).maybeSingle();
    const userId = (data as { user_id?: string } | null)?.user_id;
    if (userId) return userId;
  }

  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  return data.users[0]?.id ?? null;
}

async function findLeadByWhatsAppPhone(phoneNumber: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const candidates = getBrazilianPhoneCandidates(phoneNumber);

  const { data } = await supabase
    .from("leads")
    .select("id,user_id,phone,created_at")
    .in("phone", candidates)
    .order("created_at", { ascending: false })
    .limit(1);

  const exactLead = (data?.[0] as { id: string; user_id: string } | undefined) ?? null;
  if (exactLead) return exactLead;

  const { data: fallbackData } = await supabase
    .from("leads")
    .select("id,user_id,phone,created_at")
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

  return (fallbackLead as { id: string; user_id: string } | undefined) ?? null;
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
