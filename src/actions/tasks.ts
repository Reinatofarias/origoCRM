"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { TaskInput } from "@/lib/types";

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

export async function createTask(input: TaskInput, options: { cancelOpenFollowups?: boolean } = {}) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  if (options.cancelOpenFollowups && input.type === "followup") {
    if (!input.lead_id) return { success: false, error: "Lead obrigatorio para cancelar follow-ups" } satisfies ActionResult;

    const { error: cancelError } = await auth.supabase
      .from("tasks")
      .update({ status: "canceled" })
      .eq("lead_id", input.lead_id)
      .eq("user_id", auth.user.id)
      .eq("type", "followup")
      .eq("status", "open");

    if (cancelError) return { success: false, error: cancelError.message } satisfies ActionResult;
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      lead_id: input.lead_id ?? null,
      user_id: auth.user.id,
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      status: "open",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.type === "followup" && input.lead_id) {
    const { data: lead } = await auth.supabase
      .from("leads")
      .select("next_followup_at")
      .eq("id", input.lead_id)
      .eq("user_id", auth.user.id)
      .single();

    const currentFollowupValue = (lead as { next_followup_at?: string | null } | null)?.next_followup_at;
    const currentFollowup = currentFollowupValue ? new Date(currentFollowupValue).getTime() : null;
    const nextFollowup = new Date(input.due_at).getTime();

    if (!currentFollowup || nextFollowup <= currentFollowup) {
      await auth.supabase
        .from("leads")
        .update({ next_followup_at: input.due_at })
        .eq("id", input.lead_id)
        .eq("user_id", auth.user.id);
    }
  }

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function completeTask(taskId: string, input: { leadId?: string | null; clearLeadFollowup?: boolean }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const now = new Date().toISOString();
  const query = auth.supabase
    .from("tasks")
    .update({ status: "completed", completed_at: now })
    .eq("id", taskId)
    .eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.clearLeadFollowup && input.leadId) {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: null })
      .eq("id", input.leadId)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function updateTask(taskId: string, input: TaskInput) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const query = auth.supabase
    .from("tasks")
    .update({
      lead_id: input.lead_id ?? null,
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.type === "followup" && input.lead_id) {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: input.due_at })
      .eq("id", input.lead_id)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function rescheduleTask(taskId: string, input: { leadId?: string | null; dueAt: string; updateLeadFollowup?: boolean }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const query = auth.supabase
    .from("tasks")
    .update({ due_at: input.dueAt, status: "open", completed_at: null })
    .eq("id", taskId)
    .eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.updateLeadFollowup && input.leadId) {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: input.dueAt })
      .eq("id", input.leadId)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function deleteTask(taskId: string, input: { leadId?: string | null }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const query = auth.supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
