import { NextResponse } from "next/server";

import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature } from "@/lib/server/auth";
import { createGoogleCalendarEvent, listGoogleCalendarEvents } from "@/lib/server/google-calendar";
import { enforceRateLimit, isPayloadTooLarge, rateLimitJson } from "@/lib/server/security";

export async function GET() {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, connected: false, events: [], error: auth.error }, { status: 401 });
  }
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return NextResponse.json({ configured: true, connected: false, events: [], error: permissionError }, { status: 403 });
  const planError = await requireServerPlanFeature(auth, "googleCalendar");
  if (planError) return NextResponse.json({ configured: true, connected: false, events: [], error: planError }, { status: 402 });

  const result = await listGoogleCalendarEvents({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    maxResults: 20,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, connected: false, event: null, error: auth.error }, { status: 401 });
  }
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return NextResponse.json({ configured: true, connected: false, event: null, error: permissionError }, { status: 403 });
  const planError = await requireServerPlanFeature(auth, "googleCalendar");
  if (planError) return NextResponse.json({ configured: true, connected: false, event: null, error: planError }, { status: 402 });
  const rateLimit = await enforceRateLimit({
    request,
    scope: "google.events.write",
    identifier: auth.organizationId ?? auth.user.id,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);
  if (isPayloadTooLarge(request, 40_000)) {
    return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  const result = await createGoogleCalendarEvent({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    event: {
      title: String(body.title ?? ""),
      description: body.description ? String(body.description) : null,
      startsAt: String(body.startsAt ?? ""),
      endsAt: body.endsAt ? String(body.endsAt) : null,
      durationMinutes: Number(body.durationMinutes ?? 30),
      attendees: Array.isArray(body.attendees) ? body.attendees.map(String) : [],
      createMeet: Boolean(body.createMeet),
      location: body.location ? String(body.location) : null,
    },
  });

  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
