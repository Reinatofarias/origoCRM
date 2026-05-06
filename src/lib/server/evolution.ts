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

  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store",
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
      status: 500,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
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
  if (!supabase || message.key.fromMe) return;

  const phoneNumber = normalizePhone(message.key.remoteJid);
  const messageContent =
    message.message.conversation ??
    message.message.imageMessage?.caption ??
    message.message.documentMessage?.fileName ??
    "";

  const { data: leadResult } = await supabase
    .from("leads")
    .select("id,user_id")
    .eq("phone", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lead = leadResult as { id: string; user_id: string } | null;

  if (!lead) {
    await logWhatsAppEvent("messages.upsert.unmatched", {
      phoneNumber,
      messageId: message.key.id,
    });
    return;
  }

  const now = new Date().toISOString();

  await Promise.all([
    supabase.from("whatsapp_messages").insert({
      lead_id: lead.id,
      user_id: lead.user_id,
      message_id: message.key.id,
      phone_number: phoneNumber,
      direction: "inbound",
      content: messageContent,
      status: message.status,
    }),
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
