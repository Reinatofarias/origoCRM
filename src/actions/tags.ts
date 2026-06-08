"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrganizationContext, requireServerPermission, withOrganizationId } from "@/lib/server/auth";

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createTag(input: { name: string; color: string }) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "lead:update");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nome da tag obrigatório" } satisfies ActionResult;

  const { data, error } = await auth.supabase
    .from("tags")
    .insert(withOrganizationId({
      user_id: auth.user.id,
      name,
      color: input.color ?? "#8B5CF6",
    }, auth.organizationId))
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function assignLeadTag(leadId: string, tagId: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "lead:update");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  const { error } = await auth.supabase.from("lead_tags").upsert(
    withOrganizationId({
      user_id: auth.user.id,
      lead_id: leadId,
      tag_id: tagId,
    }, auth.organizationId),
    { onConflict: "lead_id,tag_id" },
  );

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function removeLeadTag(leadId: string, tagId: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "lead:update");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;

  let query = auth.supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
