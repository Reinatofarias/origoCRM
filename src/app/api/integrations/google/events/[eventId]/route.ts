import { NextResponse } from "next/server";

import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature } from "@/lib/server/auth";
import { deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from "@/lib/server/google-calendar";
import { enforceRateLimit, isPayloadTooLarge, rateLimitJson } from "@/lib/server/security";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const result = await updateGoogleCalendarEvent({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    eventId,
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

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, connected: false, deleted: false, error: auth.error }, { status: 401 });
  }
  const permissionError = requireServerPermission(auth, "task:manage");
  if (permissionError) return NextResponse.json({ configured: true, connected: false, deleted: false, error: permissionError }, { status: 403 });
  const planError = await requireServerPlanFeature(auth, "googleCalendar");
  if (planError) return NextResponse.json({ configured: true, connected: false, deleted: false, error: planError }, { status: 402 });
  const rateLimit = await enforceRateLimit({
    request,
    scope: "google.events.write",
    identifier: auth.organizationId ?? auth.user.id,
    limit: 30,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);

  const { eventId } = await context.params;
  const result = await deleteGoogleCalendarEvent({
    supabase: auth.supabase,
    userId: auth.user.id,
    organizationId: auth.organizationId,
    eventId,
  });

  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
