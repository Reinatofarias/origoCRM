import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGoogleCalendarAuthorizationUrl } from "@/lib/server/google-calendar";
import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/security";

export async function GET(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  const appUrl = process.env.APP_URL || "https://origocrm.vercel.app";

  if ("error" in auth) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=auth_error`, appUrl));
  }
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=forbidden`, appUrl));
  }
  const planError = await requireServerPlanFeature(auth, "googleCalendar");
  if (planError) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=plan_required`, appUrl));
  }
  const rateLimit = await enforceRateLimit({
    request,
    scope: "google.connect",
    identifier: auth.organizationId ?? auth.user.id,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.redirect(new URL(`/settings?googleCalendar=rate_limited`, appUrl));
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
