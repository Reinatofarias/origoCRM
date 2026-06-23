"use server";

import { revalidatePath } from "next/cache";

import {
  callEvolutionApi,
  ensureWhatsAppInstanceForOrganization,
  fetchContactProfilePictureUrl,
  getEvolutionInstanceEndpoint,
  getEvolutionInstanceEndpointForName,
  logWhatsAppEvent as persistWhatsAppEvent,
  recordOutboundWhatsAppMessage,
  updateStoredWhatsAppMessageStatus,
  upsertWhatsAppConversation,
} from "@/lib/server/evolution";
import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature, withOrganizationId } from "@/lib/server/auth";
import type {
  EvolutionSendTextRequest,
  EvolutionSendTextResponse,
  EvolutionWebhookEvent,
  Lead,
  LeadStatus,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

type EvolutionSendTextRawResponse = EvolutionSendTextResponse & {
  key: { id: string };
  message: { key: { id: string } };
  messageId: string;
};

async function resolveOrganizationEvolutionEndpoint(
  auth: Awaited<ReturnType<typeof getAuthenticatedOrganizationContext>>,
  path: string,
) {
  if ("error" in auth) return { endpoint: null, instanceId: null, instanceName: null, error: auth.error ?? "Não autenticado" };

  if (!auth.organizationId) {
    return {
      endpoint: getEvolutionInstanceEndpoint(path),
      instanceId: null,
      instanceName: null,
      error: null,
    };
  }

  const { instance, error } = await ensureWhatsAppInstanceForOrganization({
    organizationId: auth.organizationId,
    userId: auth.user.id,
  });
  const endpoint = instance ? getEvolutionInstanceEndpointForName(path, instance.instance_name) : null;

  return {
    endpoint,
    instanceId: instance?.id ?? null,
    instanceName: instance?.instance_name ?? null,
    error: endpoint ? null : error ?? "Conecte o WhatsApp da sua organização.",
  };
}

export async function sendWhatsAppMessage(
  leadId: string,
  phoneNumber: string,
  message: string,
  nextFollowupAt: string,
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, "conversation:send");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return { success: false, error: planError };

  if (!phoneNumber.trim()) {
    return { success: false, error: "Numero de telefone invalido" };
  }

  if (!message.trim()) {
    return { success: false, error: "Mensagem vazia" };
  }

  if (message.length > 1024) {
    return { success: false, error: "Mensagem muito longa (max 1024 caracteres)" };
  }

  const normalizedPhone = normalizePhone(phoneNumber);
  const evolution = await resolveOrganizationEvolutionEndpoint(auth, "/message/sendText");
  const endpoint = evolution.endpoint;

  if (!endpoint) {
    return { success: false, error: "Instância da Evolution não configurada" };
  }

  const response = await callEvolutionApi<EvolutionSendTextRawResponse>(endpoint, {
    number: normalizedPhone,
    text: message,
    delay: 0,
    linkPreview: false,
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
    response.data.key.id ??
    response.data.message.key.id ??
    crypto.randomUUID();
  const status = normalizeEvolutionStatus(response.data.status);
  const now = new Date().toISOString();
  const leadUpdate = {
    status: "contatado",
    last_contact_at: now,
    updated_at: now,
    ...(nextFollowupAt ? { next_followup_at: nextFollowupAt } : {}),
  };

  let leadUpdateQuery = auth.supabase.from("leads").update(leadUpdate).eq("id", leadId);
  leadUpdateQuery = auth.organizationId
    ? leadUpdateQuery.eq("organization_id", auth.organizationId)
    : leadUpdateQuery.eq("user_id", auth.user.id);

  await Promise.all([
    leadUpdateQuery,
    auth.supabase.from("interactions").insert(withOrganizationId({
      lead_id: leadId,
      user_id: auth.user.id,
      note: "Mensagem enviada via WhatsApp",
      message,
      type: "whatsapp_sent",
      channel: "whatsapp",
    }, auth.organizationId)),
    recordOutboundWhatsAppMessage({
      leadId,
      userId: auth.user.id,
      organizationId: auth.organizationId,
      messageId,
      phoneNumber: normalizedPhone,
      content: message,
      status,
      whatsappInstanceId: evolution.instanceId,
    }),
  ]);

  revalidatePath("/");
  return {
    success: true,
    messageId,
  };
}

export async function sendWhatsAppConversationMessage(
  phoneNumber: string,
  message: string,
  leadId: string | null,
  options: {
    nextFollowupAt: string | null;
    moveStatus: LeadStatus | null;
  },
): Promise<{
  success: boolean;
  message?: WhatsAppMessage;
  lead?: Lead;
  error?: string;
}> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, "conversation:send");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return { success: false, error: planError };

  if (!phoneNumber.trim()) return { success: false, error: "Numero de telefone invalido" };
  if (!message.trim()) return { success: false, error: "Mensagem vazia" };
  if (message.length > 1024) {
    return { success: false, error: "Mensagem muito longa (max 1024 caracteres)" };
  }

  const normalizedPhone = normalizePhone(phoneNumber);
  const evolution = await resolveOrganizationEvolutionEndpoint(auth, "/message/sendText");
  const endpoint = evolution.endpoint;
  if (!endpoint) return { success: false, error: evolution.error ?? "Instância da Evolution não configurada" };

  const response = await callEvolutionApi<EvolutionSendTextRawResponse>(endpoint, {
    number: normalizedPhone,
    text: message,
    delay: 0,
    linkPreview: false,
  } satisfies EvolutionSendTextRequest);

  if (response.error || response.status >= 400 || !response.data) {
    return { success: false, error: response.error || "Erro ao enviar mensagem" };
  }

  const messageId =
    response.data.id ??
    response.data.messageId ??
    response.data.key?.id ??
    response.data.message?.key?.id ??
    crypto.randomUUID();
  const avatarUrl = await fetchContactProfilePictureUrl(normalizedPhone, evolution.instanceName);

  const now = new Date().toISOString();
  let updatedLead: Lead | null = null;

  if (leadId) {
    const leadUpdate: Record<string, unknown> = {
      status: options.moveStatus || "contatado",
      last_contact_at: now,
      updated_at: now,
    };

    if (options.nextFollowupAt) leadUpdate.next_followup_at = options.nextFollowupAt;

    let leadQuery = auth.supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", leadId);
    leadQuery = auth.organizationId
      ? leadQuery.eq("organization_id", auth.organizationId)
      : leadQuery.eq("user_id", auth.user.id);

    const { data: leadData } = await leadQuery.select().single();

    updatedLead = (leadData as Lead | null) ?? null;
  }

  const { data, error } = await auth.supabase
    .from("whatsapp_messages")
    .upsert(
      withOrganizationId({
        lead_id: leadId ?? null,
        user_id: auth.user.id,
        message_id: messageId,
        remote_jid: `${normalizedPhone}@s.whatsapp.net`,
        phone_number: normalizedPhone,
        contact_avatar_url: avatarUrl,
        direction: "outbound",
        content: message,
        status: normalizeEvolutionStatus(response.data.status),
        whatsapp_instance_id: evolution.instanceId,
      }, auth.organizationId),
      { onConflict: "message_id", ignoreDuplicates: true },
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  if (leadId) {
    await auth.supabase.from("interactions").insert(withOrganizationId({
      lead_id: leadId,
      user_id: auth.user.id,
      note: "Mensagem enviada pela inbox WhatsApp",
      message,
      type: "whatsapp_sent",
      channel: "whatsapp",
    }, auth.organizationId));
  }

  await upsertWhatsAppConversation({
    userId: auth.user.id,
    organizationId: auth.organizationId,
    leadId: leadId ?? null,
    phoneNumber: normalizedPhone,
    remoteJid: `${normalizedPhone}@s.whatsapp.net`,
    contactName: updatedLead?.name ?? null,
    contactAvatarUrl: avatarUrl,
    lastMessage: message,
    direction: "outbound",
    status: "responded",
    whatsappInstanceId: evolution.instanceId,
  });

  revalidatePath("/");
  return { success: true, message: data as WhatsAppMessage, lead: updatedLead ?? undefined };
}

type WhatsAppNumberCheckResponse =
  | Array<{ number: string; exists: boolean; jid: string }>
  | { numbers: Array<{ number: string; exists: boolean; jid: string }> };

export async function checkWhatsAppNumbers(phoneNumbers: string[]): Promise<{
  success: boolean;
  numbers?: Array<{ number: string; exists: boolean; jid: string }>;
  error?: string;
}> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, "prospecting:use");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "prospecting");
  if (planError) return { success: false, error: planError };

  const numbers = Array.from(new Set(phoneNumbers.map(normalizePhone).filter(Boolean))).slice(0, 30);
  if (numbers.length === 0) return { success: false, error: "Nenhum numero para validar" };

  const evolution = await resolveOrganizationEvolutionEndpoint(auth, "/chat/whatsappNumbers");
  const endpoint = evolution.endpoint;
  if (!endpoint) return { success: false, error: evolution.error ?? "Instância da Evolution não configurada" };

  const response = await callEvolutionApi<WhatsAppNumberCheckResponse>(endpoint, { numbers }, "POST");

  if (response.error || response.status >= 400 || !response.data) {
    return { success: false, error: response.error || "Erro ao validar numeros no WhatsApp" };
  }

  const rawNumbers = Array.isArray(response.data) ? response.data : response.data.numbers ?? [];
  return {
    success: true,
    numbers: rawNumbers.map((item) => ({
      number: normalizePhone(item.number ?? ""),
      exists: Boolean(item.exists),
      jid: item.jid,
    })),
  };
}

export async function saveWhatsAppConversationAsLead(input: {
  phoneNumber: string;
  leadId: string | null;
  name: string | null;
  company: string;
  source: string;
  status: LeadStatus;
  temperature: Lead["temperature"] | null;
  ownerName: string | null;
  nextFollowupAt: string | null;
}): Promise<{
  success: boolean;
  lead?: Lead;
  error?: string;
}> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, input.leadId ? "lead:update" : "lead:create");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return { success: false, error: planError };

  const phone = normalizePhone(input.phoneNumber);
  if (!phone) return { success: false, error: "Numero de telefone invalido" };

  const fallbackName = input.name?.trim() || phone;
  const status = input.status ?? "novo";
  const now = new Date().toISOString();
  let existingById: Lead | null = null;
  if (input.leadId) {
    let existingByIdQuery = auth.supabase.from("leads").select("*").eq("id", input.leadId);
    existingByIdQuery = auth.organizationId
      ? existingByIdQuery.eq("organization_id", auth.organizationId)
      : existingByIdQuery.eq("user_id", auth.user.id);
    const { data } = await existingByIdQuery.maybeSingle();
    existingById = data as Lead | null;
  }

  let existingByPhone: Lead | null = null;
  if (!existingById) {
    let existingByPhoneQuery = auth.supabase.from("leads").select("*").eq("phone", phone);
    existingByPhoneQuery = auth.organizationId
      ? existingByPhoneQuery.eq("organization_id", auth.organizationId)
      : existingByPhoneQuery.eq("user_id", auth.user.id);
    const { data } = await existingByPhoneQuery.maybeSingle();
    existingByPhone = data as Lead | null;
  }

  let lead = (existingById ?? existingByPhone) as Lead | null;

  if (lead) {
    let updateLeadQuery = auth.supabase
      .from("leads")
      .update({
        name: fallbackName,
        company: input.company ?? lead.company,
        source: input.source ?? lead.source,
        status,
        temperature: input.temperature ?? lead.temperature ?? "morno",
        owner_name: input.ownerName ?? lead.owner_name ?? "",
        last_contact_at: now,
        next_followup_at: input.nextFollowupAt || lead.next_followup_at,
        updated_at: now,
      })
      .eq("id", lead.id);

    updateLeadQuery = auth.organizationId
      ? updateLeadQuery.eq("organization_id", auth.organizationId)
      : updateLeadQuery.eq("user_id", auth.user.id);

    const { data: updatedLead } = await updateLeadQuery.select().single();

    lead = (updatedLead as Lead | null) ?? lead;
  } else {
    lead = (await auth.supabase
      .from("leads")
      .insert(withOrganizationId({
        user_id: auth.user.id,
        name: fallbackName,
        phone,
        company: input.company ?? "",
        source: input.source ?? "WhatsApp",
        status,
        temperature: input.temperature ?? "morno",
        owner_name: input.ownerName ?? "",
        last_contact_at: now,
        next_followup_at: input.nextFollowupAt || null,
        updated_at: now,
      }, auth.organizationId))
      .select()
      .single()).data as Lead | null;
  }

  if (!lead) return { success: false, error: "Não foi possível criar lead" };

  let messageUpdateQuery = auth.supabase
    .from("whatsapp_messages")
    .update({ lead_id: lead.id, updated_at: now })
    .eq("phone_number", phone);
  messageUpdateQuery = auth.organizationId
    ? messageUpdateQuery.eq("organization_id", auth.organizationId)
    : messageUpdateQuery.eq("user_id", auth.user.id);

  const { error } = await messageUpdateQuery;

  if (error) return { success: false, error: error.message };

  await upsertWhatsAppConversation({
    userId: auth.user.id,
    organizationId: auth.organizationId,
    leadId: lead.id,
    phoneNumber: phone,
    remoteJid: `${phone}@s.whatsapp.net`,
    contactName: lead.name,
    contactAvatarUrl: null,
    lastMessage: null,
    direction: null,
    status: "converted",
  });

  revalidatePath("/");
  return { success: true, lead };
}

export async function updateWhatsAppConversationStatus(
  phoneNumber: string,
  status: WhatsAppConversation["status"],
): Promise<{
  success: boolean;
  error?: string;
}> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, "conversation:update");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return { success: false, error: planError };

  const phone = normalizePhone(phoneNumber);
  if (!phone) return { success: false, error: "Numero de telefone invalido" };

  const { error } = await auth.supabase
    .from("whatsapp_conversations")
    .upsert(withOrganizationId({
      user_id: auth.user.id,
      phone_number: phone,
      status,
      unread_count: status === "unread" ? 1 : 0,
      last_read_at: status === "unread" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, auth.organizationId), { onConflict: "user_id,phone_number" });

  if (error) {
      const message = error.message.includes("whatsapp_conversations_status_check")
        ? "Aplique supabase/conversations_operational_migration.sql para liberar o status Resolvida."
        : error.message;
    return { success: false, error: message };
  }

  revalidatePath("/");
  return { success: true };
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
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  const permissionError = requireServerPermission(auth, "conversation:update");
  if (permissionError) return { success: false, error: permissionError };
  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return { success: false, error: planError };

  let historyQuery = auth.supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("lead_id", leadId);

  historyQuery = auth.organizationId
    ? historyQuery.eq("organization_id", auth.organizationId)
    : historyQuery.eq("user_id", auth.user.id);

  const { data, error } = await historyQuery.order("created_at", { ascending: false });

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
    await persistWhatsAppEvent(eventType, payload, null, null);
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
