"use server";

import { revalidatePath } from "next/cache";

import { deleteTaskFromGoogleCalendar, syncTaskToGoogleCalendar } from "@/lib/server/google-calendar";
import { getAuthenticatedOrganizationContext, requireServerPermission, withOrganizationId } from "@/lib/server/auth";
import type { Lead, Task, TaskInput } from "@/lib/types";

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

async function getLeadForTask(auth: Awaited<ReturnType<typeof getAuthenticatedOrganizationContext>>, leadId: string | null) {
  if ("error" in auth || !leadId) return null;

  let query = auth.supabase
    .from("leads")
    .select("*")
    .eq("id", leadId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { data } = await query.maybeSingle();
  return (data as Lead | null) ?? null;
}

export async function createTask(input: TaskInput, options: { cancelOpenFollowups?: boolean } = {}) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  if (options.cancelOpenFollowups && input.type === "followup") {
    if (!input.lead_id) return { success: false, error: "Lead obrigatório para cancelar follow-ups" } satisfies ActionResult;

    let cancelQuery = auth.supabase
      .from("tasks")
      .update({ status: "canceled" })
      .eq("lead_id", input.lead_id)
      .eq("type", "followup")
      .eq("status", "open");

    cancelQuery = auth.organizationId ? cancelQuery.eq("organization_id", auth.organizationId) : cancelQuery.eq("user_id", auth.user.id);

    const { error: cancelError } = await cancelQuery;

    if (cancelError) return { success: false, error: cancelError.message } satisfies ActionResult;
  }

  const { data, error } = await auth.supabase
    .from("tasks")
    .insert(withOrganizationId({
      ...(input.id ? { id: input.id } : {}),
      lead_id: input.lead_id ?? null,
      user_id: auth.user.id,
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      status: "open",
    }, auth.organizationId))
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  const createdTask = data as Task;
  const lead = await getLeadForTask(auth, createdTask.lead_id);
  await syncTaskToGoogleCalendar({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    task: createdTask,
    lead,
  });

  if (input.type === "followup" && input.lead_id) {
    let leadQuery = auth.supabase
      .from("leads")
      .select("next_followup_at")
      .eq("id", input.lead_id);

    leadQuery = auth.organizationId ? leadQuery.eq("organization_id", auth.organizationId) : leadQuery.eq("user_id", auth.user.id);

    const { data: lead } = await leadQuery.single();

    const currentFollowupValue = (lead as { next_followup_at: string | null } | null)?.next_followup_at;
    const currentFollowup = currentFollowupValue ? new Date(currentFollowupValue).getTime() : null;
    const nextFollowup = new Date(input.due_at).getTime();

    if (!currentFollowup || nextFollowup <= currentFollowup) {
      let updateLeadQuery = auth.supabase
        .from("leads")
        .update({ next_followup_at: input.due_at })
        .eq("id", input.lead_id);

      updateLeadQuery = auth.organizationId ? updateLeadQuery.eq("organization_id", auth.organizationId) : updateLeadQuery.eq("user_id", auth.user.id);
      await updateLeadQuery;
    }
  }

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function completeTask(taskId: string, input: { leadId: string | null; clearLeadFollowup: boolean }) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  const now = new Date().toISOString();
  let query = auth.supabase
    .from("tasks")
    .update({ status: "completed", completed_at: now })
    .eq("id", taskId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  if (input.clearLeadFollowup && input.leadId) {
    let leadQuery = auth.supabase
      .from("leads")
      .update({ next_followup_at: null })
      .eq("id", input.leadId);

    leadQuery = auth.organizationId ? leadQuery.eq("organization_id", auth.organizationId) : leadQuery.eq("user_id", auth.user.id);
    await leadQuery;
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function updateTask(taskId: string, input: TaskInput) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  let query = auth.supabase
    .from("tasks")
    .update({
      lead_id: input.lead_id ?? null,
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { data, error } = await query.select().single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  const updatedTask = data as Task;
  const lead = await getLeadForTask(auth, updatedTask.lead_id);
  await syncTaskToGoogleCalendar({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    task: updatedTask,
    lead,
  });

  if (input.type === "followup" && input.lead_id) {
    let leadQuery = auth.supabase
      .from("leads")
      .update({ next_followup_at: input.due_at })
      .eq("id", input.lead_id);

    leadQuery = auth.organizationId ? leadQuery.eq("organization_id", auth.organizationId) : leadQuery.eq("user_id", auth.user.id);
    await leadQuery;
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function rescheduleTask(taskId: string, input: { leadId: string | null; dueAt: string; updateLeadFollowup: boolean }) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  let query = auth.supabase
    .from("tasks")
    .update({ due_at: input.dueAt, status: "open", completed_at: null })
    .eq("id", taskId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { data, error } = await query.select().single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  const updatedTask = data as Task;
  const lead = await getLeadForTask(auth, updatedTask.lead_id);
  await syncTaskToGoogleCalendar({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    task: updatedTask,
    lead,
  });

  if (input.updateLeadFollowup && input.leadId) {
    let leadQuery = auth.supabase
      .from("leads")
      .update({ next_followup_at: input.dueAt })
      .eq("id", input.leadId);

    leadQuery = auth.organizationId ? leadQuery.eq("organization_id", auth.organizationId) : leadQuery.eq("user_id", auth.user.id);
    await leadQuery;
  }

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function deleteTask(taskId: string, input: { leadId: string | null }) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  let currentTaskQuery = auth.supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId);

  currentTaskQuery = auth.organizationId ? currentTaskQuery.eq("organization_id", auth.organizationId) : currentTaskQuery.eq("user_id", auth.user.id);
  if (input.leadId) currentTaskQuery.eq("lead_id", input.leadId);
  else currentTaskQuery.is("lead_id", null);

  const { data: currentTask } = await currentTaskQuery.maybeSingle();

  if (currentTask) {
    await deleteTaskFromGoogleCalendar({
      supabase: auth.supabase,
      userId: auth.user.id,
      organizationId: auth.organizationId,
      task: currentTask as Task,
    });
  }

  let query = auth.supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  if (input.leadId) query.eq("lead_id", input.leadId);
  else query.is("lead_id", null);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
