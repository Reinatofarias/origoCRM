"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrganizationContext, withOrganizationId } from "@/lib/server/auth";
import type { LeadStatus } from "@/lib/types";

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

export async function moveLeadStage(id: string, status: LeadStatus, outcomeReason?: string | null) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const reason = outcomeReason?.trim() ?? "";

  const updatePayload = {
    status,
    ...(reason ? { outcome_reason: reason } : {}),
  };

  let query = auth.supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) } satisfies ActionResult;

  await auth.supabase.from("interactions").insert(withOrganizationId({
    lead_id: id,
    user_id: auth.user.id,
    note: `Status alterado para ${status}`,
    message: `Status alterado para ${status}`,
    type: "status_changed",
    channel: "whatsapp",
  }, auth.organizationId));

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
