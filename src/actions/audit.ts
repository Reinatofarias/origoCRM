"use server";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { AuditLogInput } from "@/lib/types";

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

export async function recordAuditLog(input: AuditLogInput) {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const { data, error } = await auth.supabase
    .from("audit_logs")
    .insert({
      user_id: auth.user.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  return { success: true, data } satisfies ActionResult;
}
