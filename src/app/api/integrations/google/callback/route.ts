import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedOrganizationContext } from "@/lib/server/auth";
import {
  encryptGoogleToken,
  exchangeGoogleAuthorizationCode,
  getGoogleCalendarConfig,
} from "@/lib/server/google-calendar";

export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL || "https://origocrm.vercel.app";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("origocrm_google_oauth_state")?.value;
  cookieStore.delete("origocrm_google_oauth_state");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=${encodeURIComponent(error)}`, appUrl));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/settings?googleCalendar=invalid_state", appUrl));
  }

  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.redirect(new URL("/settings?googleCalendar=auth_error", appUrl));
  }

  try {
    const config = getGoogleCalendarConfig();
    if (!config) throw new Error("Google Calendar nao configurado");

    const token = await exchangeGoogleAuthorizationCode(code);
    if (!token.refresh_token) {
      throw new Error("Google nao retornou refresh token. Revogue o acesso e conecte novamente.");
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;
    const scopes = (token.scope || config.scopes).split(" ").filter(Boolean);

    const payload = {
      organization_id: auth.organizationId,
      user_id: auth.user.id,
      account_email: auth.user.email ?? null,
      calendar_id: "primary",
      refresh_token_encrypted: encryptGoogleToken(token.refresh_token),
      scopes,
      token_expires_at: expiresAt,
      status: "connected",
      last_error: null,
      disconnected_at: null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await auth.supabase
      .from("google_calendar_connections")
      .upsert(payload, { onConflict: "organization_id,user_id" });

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.redirect(new URL("/settings?googleCalendar=connected", appUrl));
  } catch (connectError) {
    const message = connectError instanceof Error ? connectError.message : "Erro ao conectar Google Calendar";
    return NextResponse.redirect(new URL(`/settings?googleCalendarError=${encodeURIComponent(message)}`, appUrl));
  }
}
