"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrganizationContext, withOrganizationId } from "@/lib/server/auth";

export async function createInteraction(leadId: string, note: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("interactions")
    .insert(withOrganizationId({
      lead_id: leadId,
      user_id: auth.user.id,
      note,
      message: note,
      type: "note",
      channel: "whatsapp",
    }, auth.organizationId))
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data };
}

export async function deleteInteraction(interactionId: string) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error };

  let query = auth.supabase
    .from("interactions")
    .delete()
    .eq("id", interactionId);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.eq("user_id", auth.user.id);

  const { error } = await query;

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true };
}
