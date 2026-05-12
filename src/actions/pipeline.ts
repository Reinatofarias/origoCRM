"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { LeadStatus } from "@/lib/types";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
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

export async function moveLeadStage(id: string, status: LeadStatus, outcomeReason?: string | null) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const reason = outcomeReason?.trim() ?? "";

  if (status === "fechado" && !reason) {
    return { success: false, error: "Informe o motivo de ganho/perda para fechar o lead." } satisfies ActionResult;
  }

  const updatePayload = {
    status,
    ...(status === "fechado" ? { outcome_reason: reason } : {}),
  };

  const { error } = await auth.supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message } satisfies ActionResult;

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
