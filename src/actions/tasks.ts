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
      lead_id: input.lead_id,
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

  if (input.type === "followup") {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: input.due_at })
      .eq("id", input.lead_id)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function completeTask(taskId: string, input: { leadId: string; clearLeadFollowup?: boolean }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("tasks")
    .update({ status: "completed", completed_at: now })
    .eq("id", taskId)
    .eq("lead_id", input.leadId)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.clearLeadFollowup) {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: null })
      .eq("id", input.leadId)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function rescheduleTask(taskId: string, input: { leadId: string; dueAt: string; updateLeadFollowup?: boolean }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const { error } = await auth.supabase
    .from("tasks")
    .update({ due_at: input.dueAt, status: "open", completed_at: null })
    .eq("id", taskId)
    .eq("lead_id", input.leadId)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.updateLeadFollowup) {
    await auth.supabase
      .from("leads")
      .update({ next_followup_at: input.dueAt })
      .eq("id", input.leadId)
      .eq("user_id", auth.user.id);
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
