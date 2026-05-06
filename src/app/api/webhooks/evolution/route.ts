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
  switch (eventType) {
    case "messages.upsert":
      await handleMessageUpsert(data);
      break;
    case "messages.update":
      await handleMessageUpdate(data);
      break;
    case "messages.delete":
    case "connection.update":
    case "qr.update":
    case "presence.update":
      break;
    default:
      await logWhatsAppEvent("webhook.unhandled_event", { eventType, data });
  }

  await logWhatsAppEvent(eventType, { data });
}

async function handleMessageUpsert(data: unknown): Promise<void> {
  const message = data as EvolutionIncomingMessage;
  await recordIncomingWhatsAppMessage(message);
}

async function handleMessageUpdate(data: unknown): Promise<void> {
  const update = data as EvolutionMessageUpdate;

  await updateStoredWhatsAppMessageStatus(
    update.key.id,
    update.status as "sent" | "delivered" | "read" | "failed",
  );
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
      "presence.update",
    ],
  });
}
