"use server";

import { revalidatePath } from "next/cache";

import { calculateLeadScore } from "@/lib/lead-scoring";
import { getAuthenticatedOrganizationContext, requireServerPermission, withOrganizationId } from "@/lib/server/auth";
import type { Lead, LeadInput, LeadStatus } from "@/lib/types";

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

function formatLeadDatabaseError(message: string) {
  if (message.includes("leads_status_check")) {
    return "O banco ainda bloqueia etapas personalizadas. Aplique supabase/custom_pipeline_stages_migration.sql no SQL Editor do Supabase e tente novamente.";
  }

  if (message.includes("leads_closed_outcome_reason_check")) {
    return "O contrato antigo de fechamento ainda esta ativo. Aplique supabase/custom_pipeline_stages_migration.sql no SQL Editor do Supabase.";
  }

  return message;
}

function isLeadScoringMissingError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("lead_score") || normalized.includes("schema cache");
}

function buildLeadScorePatch(lead: Partial<Lead>): Pick<Lead, "lead_score" | "lead_score_label" | "lead_score_reasons" | "lead_score_updated_at"> {
  const score = calculateLeadScore({
    id: lead.id ?? "pending",
    user_id: lead.user_id ?? null,
    organization_id: lead.organization_id ?? null,
    name: lead.name ?? "",
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    source: lead.source ?? "",
    status: lead.status ?? "novo",
    estimated_value: lead.estimated_value ?? null,
    owner_name: lead.owner_name ?? null,
    temperature: lead.temperature ?? "morno",
    outcome_reason: lead.outcome_reason ?? null,
    sla_hours: lead.sla_hours ?? 24,
    last_contact_at: lead.last_contact_at ?? null,
    next_followup_at: lead.next_followup_at ?? null,
    archived_at: lead.archived_at ?? null,
    lead_score: lead.lead_score ?? 0,
    lead_score_label: lead.lead_score_label ?? "baixo",
    lead_score_reasons: lead.lead_score_reasons ?? [],
    lead_score_updated_at: lead.lead_score_updated_at ?? null,
    created_at: lead.created_at ?? new Date().toISOString(),
    updated_at: lead.updated_at ?? new Date().toISOString(),
  });

  return {
    lead_score: score.score,
    lead_score_label: mapLeadScoreLabel(score.label),
    lead_score_reasons: score.reasons,
    lead_score_updated_at: new Date().toISOString(),
  };
}

function mapLeadScoreLabel(label: ReturnType<typeof calculateLeadScore>["label"]) {
  if (label === "Crítico") return "critico";
  if (label === "Alto") return "alto";
  if (label === "Médio") return "medio";
  return "baixo";
}

export async function createLead(input: LeadInput) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "lead:create");
  if (permissionError) return { success: false, error: permissionError };

  const payload = withOrganizationId({ ...input, ...buildLeadScorePatch(input), user_id: auth.user.id }, auth.organizationId);
  let { data, error } = await auth.supabase
    .from("leads")
    .insert(payload)
    .select()
    .single();

  if (error && isLeadScoringMissingError(error.message)) {
    ({ data, error } = await auth.supabase
      .from("leads")
      .insert(withOrganizationId({ ...input, user_id: auth.user.id }, auth.organizationId))
      .select()
      .single());
  }

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function updateLead(id: string, input: Partial<LeadInput>) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "lead:update");
  if (permissionError) return { success: false, error: permissionError };

  let currentQuery = auth.supabase
    .from("leads")
    .select("*")
    .eq("id", id);

  currentQuery = auth.organizationId ? currentQuery.eq("organization_id", auth.organizationId) : currentQuery.eq("user_id", auth.user.id);
  const { data: currentLead } = await currentQuery.maybeSingle();
  const payload = currentLead
    ? { ...input, ...buildLeadScorePatch({ ...(currentLead as Lead), ...input }) }
    : input;

  let query = auth.supabase
    .from("leads")
    .update(payload)
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  let { data, error } = await query.select().single();

  if (error && isLeadScoringMissingError(error.message)) {
    let fallbackQuery = auth.supabase
      .from("leads")
      .update(input)
      .eq("id", id);

    fallbackQuery = auth.organizationId ? fallbackQuery.eq("organization_id", auth.organizationId) : fallbackQuery.eq("user_id", auth.user.id);
    ({ data, error } = await fallbackQuery.select().single());
  }

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "pipeline:update");
  if (permissionError) return { success: false, error: permissionError };

  let currentQuery = auth.supabase
    .from("leads")
    .select("*")
    .eq("id", id);

  currentQuery = auth.organizationId ? currentQuery.eq("organization_id", auth.organizationId) : currentQuery.eq("user_id", auth.user.id);
  const { data: currentLead } = await currentQuery.maybeSingle();
  const payload = currentLead ? { status, ...buildLeadScorePatch({ ...(currentLead as Lead), status }) } : { status };

  let query = auth.supabase
    .from("leads")
    .update(payload)
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  let { error } = await query;

  if (error && isLeadScoringMissingError(error.message)) {
    let fallbackQuery = auth.supabase
      .from("leads")
      .update({ status })
      .eq("id", id);

    fallbackQuery = auth.organizationId ? fallbackQuery.eq("organization_id", auth.organizationId) : fallbackQuery.eq("user_id", auth.user.id);
    ({ error } = await fallbackQuery);
  }

  if (error) return { success: false, error: formatLeadDatabaseError(error.message) };

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

export async function deleteLead(id: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "lead:delete");
  if (permissionError) return { success: false, error: permissionError };

  let query = auth.supabase
    .from("leads")
    .delete()
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function archiveLead(id: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "lead:delete");
  if (permissionError) return { success: false, error: permissionError };

  let query = auth.supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function unarchiveLead(id: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };
  const permissionError = requireServerPermission(auth, "lead:delete");
  if (permissionError) return { success: false, error: permissionError };

  let query = auth.supabase
    .from("leads")
    .update({ archived_at: null })
    .eq("id", id);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { data, error } = await query.select().single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}
