import { type NextRequest, NextResponse } from "next/server";

import {
  extractEvolutionInstanceName,
  getWhatsAppInstanceByName,
  logWhatsAppEvent,
  recordIncomingWhatsAppMessage,
  updateStoredWhatsAppMessageStatus,
  validateEvolutionWebhook,
} from "@/lib/server/evolution";
import { isPayloadTooLarge } from "@/lib/server/security";
import type {
  EvolutionIncomingMessage,
  EvolutionMessageUpdate,
  EvolutionWebhookEvent,
  EvolutionWebhookPayload,
} from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (isPayloadTooLarge(request, 1_000_000)) {
      await logWhatsAppEvent("webhook.payload_too_large", {
        contentLength: request.headers.get("content-length"),
        timestamp: new Date().toISOString(),
      }, null, null);
      return NextResponse.json({ status: "received" });
    }

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
      }, null, null);
      return NextResponse.json({ status: "received" });
    }

    await handleWebhookEvent(payload.event, payload.data, extractEvolutionInstanceName(payload));
    return NextResponse.json({ status: "received" });
  } catch (error) {
    await logWhatsAppEvent("webhook.error", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, null, null);

    return NextResponse.json({ status: "error", message: "Processing error" });
  }
}

async function handleWebhookEvent(
  eventType: EvolutionWebhookEvent,
  data: unknown,
  instanceName: string | null,
): Promise<void> {
  const normalizedEvent = normalizeWebhookEvent(eventType);
  const { instance } = instanceName ? await getWhatsAppInstanceByName(instanceName) : { instance: null };

  switch (normalizedEvent) {
    case "messages.upsert":
      await handleMessageUpsert(data, instanceName);
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
      await logWhatsAppEvent("webhook.unhandled_event", { eventType, normalizedEvent, data, instanceName }, null, instance?.organization_id ?? null, instance?.id ?? null);
  }

  await logWhatsAppEvent(normalizedEvent, { data, instanceName }, null, instance?.organization_id ?? null, instance?.id ?? null);
}

function normalizeWebhookEvent(eventType: string) {
  const normalized = eventType.toLowerCase().replaceAll("_", ".");
  if (normalized === "qrcode.updated") return "qr.update";
  return normalized;
}

async function handleMessageUpsert(data: unknown, instanceName: string | null): Promise<void> {
  for (const message of extractWebhookItems<EvolutionIncomingMessage>(data)) {
    await recordIncomingWhatsAppMessage(message, { instanceName });
  }
}

async function handleMessageUpdate(data: unknown): Promise<void> {
  for (const update of extractWebhookItems<EvolutionMessageUpdate>(data)) {
    const messageId = getMessageUpdateId(update);
    if (!messageId) {
      await logWhatsAppEvent("messages.update.ignored", { update, reason: "missing_message_id" }, null, null);
      continue;
    }

    await updateStoredWhatsAppMessageStatus(messageId, normalizeMessageUpdateStatus(update.status));
  }
}

function getMessageUpdateId(update: unknown) {
  if (!update || typeof update !== "object") return null;
  const record = update as Record<string, unknown>;
  const key = record.key as Record<string, unknown> | undefined;
  const id = key?.id ?? record.id ?? record.messageId;
  return typeof id === "string" && id.trim() ? id : null;
}

function normalizeMessageUpdateStatus(status: unknown): "sent" | "delivered" | "read" | "failed" {
  if (typeof status !== "string") return "sent";
  const normalized = status.toLowerCase();
  if (["sent", "delivered", "read", "failed"].includes(normalized)) {
    return normalized as "sent" | "delivered" | "read" | "failed";
  }
  if (normalized.includes("read")) return "read";
  if (normalized.includes("delivery") || normalized.includes("delivered")) return "delivered";
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  return "sent";
}

function extractWebhookItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  if ("messages" in data && Array.isArray((data as { messages: unknown }).messages)) {
    return (data as { messages: T[] }).messages;
  }
  const record = data as Record<string, unknown>;
  const nestedMessage = record.message;
  const hasEnvelopeFields = "key" in record || "remoteJid" in record || "jid" in record;
  if (
    !hasEnvelopeFields &&
    nestedMessage &&
    typeof nestedMessage === "object" &&
    ("key" in nestedMessage || "remoteJid" in nestedMessage || "jid" in nestedMessage)
  ) {
    return [nestedMessage as T];
  }
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
