"use server";

import { revalidatePath } from "next/cache";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  logWhatsAppEvent as persistWhatsAppEvent,
  recordOutboundWhatsAppMessage,
  updateStoredWhatsAppMessageStatus,
} from "@/lib/server/evolution";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import type {
  EvolutionSendTextRequest,
  EvolutionSendTextResponse,
  EvolutionWebhookEvent,
  WhatsAppMessage,
} from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

type EvolutionSendTextRawResponse = EvolutionSendTextResponse & {
  key?: { id?: string };
  message?: { key?: { id?: string } };
  messageId?: string;
};

async function getAuthenticatedSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase nao configurado" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: "Sessao expirada. Entre novamente." };

  return { supabase, user };
}

export async function sendWhatsAppMessage(
  leadId: string,
  phoneNumber: string,
  message: string,
  nextFollowupAt?: string,
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!phoneNumber?.trim()) {
    return { success: false, error: "Numero de telefone invalido" };
  }

  if (!message?.trim()) {
    return { success: false, error: "Mensagem vazia" };
  }

  if (message.length > 1024) {
    return { success: false, error: "Mensagem muito longa (max 1024 caracteres)" };
  }

  const normalizedPhone = normalizePhone(phoneNumber);
  const endpoint = getEvolutionInstanceEndpoint("/message/sendText");

  if (!endpoint) {
    return { success: false, error: "Instancia da Evolution nao configurada" };
  }

  const response = await callEvolutionApi<EvolutionSendTextRawResponse>(endpoint, {
    number: normalizedPhone,
    text: message,
  } satisfies EvolutionSendTextRequest);

  if (response.error || response.status >= 400 || !response.data) {
    return {
      success: false,
      error: response.error || "Erro ao enviar mensagem",
    };
  }

  const messageId =
    response.data.id ??
    response.data.messageId ??
    response.data.key?.id ??
    response.data.message?.key?.id ??
    crypto.randomUUID();
  const status = normalizeEvolutionStatus(response.data.status);
  const now = new Date().toISOString();
  const leadUpdate = {
    status: "contatado",
    last_contact_at: now,
    updated_at: now,
    ...(nextFollowupAt ? { next_followup_at: nextFollowupAt } : {}),
  };

  await Promise.all([
    auth.supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId)
      .eq("user_id", auth.user.id),
    auth.supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: auth.user.id,
      note: "Mensagem enviada via WhatsApp",
      message,
      type: "whatsapp_sent",
      channel: "whatsapp",
    }),
    recordOutboundWhatsAppMessage({
      leadId,
      userId: auth.user.id,
      messageId,
      phoneNumber: normalizedPhone,
      content: message,
      status,
    }),
  ]);

  revalidatePath("/");
  return {
    success: true,
    messageId,
  };
}

function normalizeEvolutionStatus(status: unknown) {
  if (typeof status === "string") {
    const normalized = status.toLowerCase();
    if (["pending", "sent", "delivered", "read", "failed"].includes(normalized)) {
      return normalized as "pending" | "sent" | "delivered" | "read" | "failed";
    }
  }

  return "sent";
}

export async function getWhatsAppHistory(leadId: string): Promise<{
  success: boolean;
  messages?: WhatsAppMessage[];
  error?: string;
}> {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("lead_id", leadId)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };

  return { success: true, messages: (data as WhatsAppMessage[] | null) ?? [] };
}

export async function logWhatsAppEvent(
  eventType: EvolutionWebhookEvent | "webhook.error" | string,
  payload: Record<string, unknown>,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await persistWhatsAppEvent(eventType, payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function updateMessageStatus(
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed",
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await updateStoredWhatsAppMessageStatus(messageId, status);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}
