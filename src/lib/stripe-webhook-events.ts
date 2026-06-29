export type StripeWebhookProcessingState = {
  status: "processing" | "completed" | "failed";
  updatedAt: string;
};

export function shouldRetryStripeWebhookEvent(
  event: StripeWebhookProcessingState,
  now = Date.now(),
) {
  if (event.status === "completed") return false;
  if (event.status === "failed") return true;

  const updatedAt = new Date(event.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return true;
  return now - updatedAt >= 5 * 60_000;
}
