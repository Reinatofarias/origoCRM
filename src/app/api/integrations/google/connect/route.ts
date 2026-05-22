import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGoogleCalendarAuthorizationUrl } from "@/lib/server/google-calendar";
import { getAuthenticatedOrganizationContext } from "@/lib/server/auth";

export async function GET() {
  const auth = await getAuthenticatedOrganizationContext();
  const appUrl = process.env.APP_URL || "https://origocrm.vercel.app";

  if ("error" in auth) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=auth_error`, appUrl));
  }

  const state = crypto.randomUUID();
  const authorizationUrl = buildGoogleCalendarAuthorizationUrl(state);

  if (!authorizationUrl) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=missing_config`, appUrl));
  }

  const cookieStore = await cookies();
  cookieStore.set("origocrm_google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(authorizationUrl);
}
