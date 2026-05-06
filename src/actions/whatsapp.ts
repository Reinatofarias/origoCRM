"use server";

import { revalidatePath } from "next/cache";

import {
  callEvolutionApi,
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
  const response = await callEvolutionApi<EvolutionSendTextResponse>("/message/sendText", {
    number: normalizedPhone,
    text: message,
  } satisfies EvolutionSendTextRequest);

  if (response.error || response.status >= 400 || !response.data) {
    return {
      success: false,
      error: response.error || "Erro ao enviar mensagem",
    };
  }

  const now = new Date().toISOString();

  await Promise.all([
    auth.supabase
      .from("leads")
      .update({
        status: "contatado",
        last_contact_at: now,
        updated_at: now,
      })
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
      messageId: response.data.id,
      phoneNumber: normalizedPhone,
      content: message,
      status: response.data.status,
    }),
  ]);

  revalidatePath("/");
  return {
    success: true,
    messageId: response.data.id,
  };
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
