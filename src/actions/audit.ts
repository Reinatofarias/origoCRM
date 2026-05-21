"use server";

import { getAuthenticatedOrganizationContext, withOrganizationId } from "@/lib/server/auth";
import type { AuditLogInput } from "@/lib/types";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function recordAuditLog(input: AuditLogInput) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error } satisfies ActionResult;

  const { data, error } = await auth.supabase
    .from("audit_logs")
    .insert(withOrganizationId({
      user_id: auth.user.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? {},
    }, auth.organizationId))
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  return { success: true, data } satisfies ActionResult;
}
