"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { LeadInput, LeadStatus } from "@/lib/types";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

function formatLeadDatabaseError(message: string) {
  if (message.includes("leads_status_check")) {
    return "O banco ainda bloqueia etapas personalizadas. Aplique supabase/custom_pipeline_stages_migration.sql no SQL Editor do Supabase e tente novamente.";
  }

  if (message.includes("leads_closed_outcome_reason_check")) {
    return "O contrato antigo de fechamento ainda esta ativo. Aplique supabase/custom_pipeline_stages_migration.sql no SQL Editor do Supabase.";
  }

  return message;
}

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

export async function createLead(input: LeadInput) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("leads")
    .insert({ ...input, user_id: auth.user.id })
    .select()
    .single();

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function updateLead(id: string, input: Partial<LeadInput>) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("leads")
    .update(input)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

  await auth.supabase.from("interactions").insert({
    lead_id: id,
    user_id: auth.user.id,
    note: `Status alterado para ${status}`,
    message: `Status alterado para ${status}`,
    type: "status_changed",
    channel: "whatsapp",
  });

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function deleteLead(id: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function archiveLead(id: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function unarchiveLead(id: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("leads")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}
