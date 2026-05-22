import { NextResponse } from "next/server";

import { getAuthenticatedOrganizationContext } from "@/lib/server/auth";
import { getGoogleCalendarConfig } from "@/lib/server/google-calendar";

function isMissingGoogleTable(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("google_calendar_connections") || normalized.includes("schema cache") || normalized.includes("relation");
}

export async function GET() {
  const auth = await getAuthenticatedOrganizationContext();
  const configured = Boolean(getGoogleCalendarConfig());

  if ("error" in auth) {
    return NextResponse.json({ configured, connected: false, error: auth.error }, { status: 401 });
  }

  let query = auth.supabase
    .from("google_calendar_connections")
    .select("id,account_email,calendar_id,status,last_error,last_synced_at,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .limit(1);

  query = auth.organizationId ? query.eq("organization_id", auth.organizationId) : query.is("organization_id", null);

  const { data, error } = await query.maybeSingle();

  if (error && isMissingGoogleTable(error.message)) {
    return NextResponse.json({
      configured,
      migrated: false,
      connected: false,
      error: "Aplique supabase/google_calendar_migration.sql",
    });
  }

  if (error) {
    return NextResponse.json({ configured, migrated: true, connected: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    configured,
    migrated: true,
    connected: data?.status === "connected",
    connection: data ?? null,
  });
}
