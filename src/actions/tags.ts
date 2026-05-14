"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/server/supabase";

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

export async function createTag(input: { name: string; color?: string }) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nome da tag obrigatorio" } satisfies ActionResult;

  const { data, error } = await auth.supabase
    .from("tags")
    .insert({
      user_id: auth.user.id,
      name,
      color: input.color ?? "#8B5CF6",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true, data } satisfies ActionResult;
}

export async function assignLeadTag(leadId: string, tagId: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const { error } = await auth.supabase.from("lead_tags").upsert(
    {
      user_id: auth.user.id,
      lead_id: leadId,
      tag_id: tagId,
    },
    { onConflict: "lead_id,tag_id" },
  );

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}

export async function removeLeadTag(leadId: string, tagId: string) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const { error } = await auth.supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId)
    .eq("user_id", auth.user.id);

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  revalidatePath("/");
  return { success: true } satisfies ActionResult;
}
