import { describe, expect, it } from "vitest";

import { shouldRetryStripeWebhookEvent } from "../src/lib/stripe-webhook-events";

const now = new Date("2026-06-29T12:00:00.000Z").getTime();

describe("idempotência do webhook Stripe", () => {
  it("ignora eventos já concluídos", () => {
    expect(shouldRetryStripeWebhookEvent({ status: "completed", updatedAt: "2026-06-29T11:00:00.000Z" }, now)).toBe(false);
  });

  it("ignora processamento concorrente recente", () => {
    expect(shouldRetryStripeWebhookEvent({ status: "processing", updatedAt: "2026-06-29T11:58:00.000Z" }, now)).toBe(false);
  });

  it("retoma evento falho ou processamento travado", () => {
    expect(shouldRetryStripeWebhookEvent({ status: "failed", updatedAt: "2026-06-29T11:59:00.000Z" }, now)).toBe(true);
    expect(shouldRetryStripeWebhookEvent({ status: "processing", updatedAt: "2026-06-29T11:50:00.000Z" }, now)).toBe(true);
  });
});
