import { type NextRequest, NextResponse } from "next/server";

import {
  logWhatsAppEvent,
  recordIncomingWhatsAppMessage,
  updateStoredWhatsAppMessageStatus,
  validateEvolutionWebhook,
} from "@/lib/server/evolution";
import type {
  EvolutionIncomingMessage,
  EvolutionMessageUpdate,
  EvolutionWebhookEvent,
  EvolutionWebhookPayload,
} from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as EvolutionWebhookPayload;
    const signature =
      request.nextUrl.searchParams.get("token") ??
      request.headers.get("x-evolution-signature") ??
      request.headers.get("x-webhook-signature") ??
      request.headers.get("authorization") ??
      "";

    if (!validateEvolutionWebhook(signature)) {
      await logWhatsAppEvent("webhook.invalid_signature", {
        event: payload.event,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ status: "received" });
    }

    await handleWebhookEvent(payload.event, payload.data);
    return NextResponse.json({ status: "received" });
  } catch (error) {
    await logWhatsAppEvent("webhook.error", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ status: "error", message: "Processing error" });
  }
}

async function handleWebhookEvent(
  eventType: EvolutionWebhookEvent,
  data: unknown,
): Promise<void> {
  const normalizedEvent = normalizeWebhookEvent(eventType);

  switch (normalizedEvent) {
    case "messages.upsert":
      await handleMessageUpsert(data);
      break;
    case "messages.update":
      await handleMessageUpdate(data);
      break;
    case "messages.delete":
    case "connection.update":
    case "qr.update":
    case "qrcode.updated":
    case "presence.update":
      break;
    default:
      await logWhatsAppEvent("webhook.unhandled_event", { eventType, normalizedEvent, data });
  }

  await logWhatsAppEvent(normalizedEvent, { data });
}

function normalizeWebhookEvent(eventType: string) {
  const normalized = eventType.toLowerCase().replaceAll("_", ".");
  if (normalized === "qrcode.updated") return "qr.update";
  return normalized;
}

async function handleMessageUpsert(data: unknown): Promise<void> {
  for (const message of extractWebhookItems<EvolutionIncomingMessage>(data)) {
    await recordIncomingWhatsAppMessage(message);
  }
}

async function handleMessageUpdate(data: unknown): Promise<void> {
  for (const update of extractWebhookItems<EvolutionMessageUpdate>(data)) {
    await updateStoredWhatsAppMessageStatus(
      update.key.id,
      update.status as "sent" | "delivered" | "read" | "failed",
    );
  }
}

function extractWebhookItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  return [data as T];
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    webhook: "/api/webhooks/evolution",
    events: [
      "messages.upsert",
      "messages.update",
      "messages.delete",
      "connection.update",
      "qr.update",
      "qrcode.updated",
      "presence.update",
    ],
  });
}
