import { NextResponse } from "next/server";

import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";
import {
  decryptGoogleToken,
  revokeGoogleRefreshToken,
} from "@/lib/server/google-calendar";

function isMissingGoogleTable(message: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("google_calendar_connections") || normalized.includes("schema cache") || normalized.includes("relation");
}

export async function DELETE() {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 });
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  let selectQuery = auth.supabase
    .from("google_calendar_connections")
    .select("id,refresh_token_encrypted")
    .eq("user_id", auth.user.id)
    .limit(1);

  selectQuery = auth.organizationId ? selectQuery.eq("organization_id", auth.organizationId) : selectQuery.is("organization_id", null);

  const { data, error } = await selectQuery.maybeSingle();

  if (error && isMissingGoogleTable(error.message)) {
    return NextResponse.json({ error: "Aplique supabase/google_calendar_migration.sql" }, { status: 400 });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ disconnected: true });

  const refreshToken = (data as { refresh_token_encrypted: string | null }).refresh_token_encrypted;
  if (refreshToken) await revokeGoogleRefreshToken(decryptGoogleToken(refreshToken)).catch(() => undefined);

  let updateQuery = auth.supabase
    .from("google_calendar_connections")
    .update({
      status: "disconnected",
      refresh_token_encrypted: null,
      last_error: null,
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", (data as { id: string }).id)
    .eq("user_id", auth.user.id);

  updateQuery = auth.organizationId ? updateQuery.eq("organization_id", auth.organizationId) : updateQuery.is("organization_id", null);

  const { error: updateError } = await updateQuery;
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ disconnected: true });
}
