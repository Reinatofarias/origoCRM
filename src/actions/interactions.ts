"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/server/supabase";

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

export async function createInteraction(leadId: string, note: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("interactions")
    .insert({
      lead_id: leadId,
      user_id: auth.user.id,
      note,
      message: note,
      type: "note",
      channel: "whatsapp",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data };
}

export async function deleteInteraction(interactionId: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("interactions")
    .delete()
    .eq("id", interactionId)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true };
}
