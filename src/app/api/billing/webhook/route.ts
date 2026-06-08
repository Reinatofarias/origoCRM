import Stripe from "stripe";

import { createSupabaseServiceRoleClient } from "@/lib/server/supabase";
import { isPayloadTooLarge } from "@/lib/server/security";
import { getStripeClient } from "@/lib/server/stripe";
import type { BillingPeriod, PlanSlug } from "@/lib/plans";

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
};

function fromUnixTimestamp(timestamp: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "paused") return status;
  return "canceled";
}

async function upsertSubscriptionFromStripe(subscription: StripeSubscriptionWithPeriods, fallback: Record<string, string | null | undefined> = {}) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

  const metadata = { ...fallback, ...subscription.metadata };
  const organizationId = metadata.organization_id;
  const planSlug = metadata.plan_slug as PlanSlug | undefined;
  const billingPeriod = metadata.billing_period as BillingPeriod | undefined;

  if (!organizationId || !planSlug || !billingPeriod) {
    if (metadata.source === "public_checkout") return;
    throw new Error("Metadados de assinatura incompletos.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        organization_id: organizationId,
        plan_slug: planSlug,
        billing_period: billingPeriod,
        status: mapSubscriptionStatus(subscription.status),
        provider: "stripe",
        provider_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        provider_subscription_id: subscription.id,
        current_period_start: fromUnixTimestamp(subscription.current_period_start),
        current_period_end: fromUnixTimestamp(subscription.current_period_end),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );

  if (error) throw new Error(error.message);
}

async function markSubscriptionStatus(providerSubscriptionId: string, status: "past_due" | "canceled") {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

  const { error } = await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("provider_subscription_id", providerSubscriptionId);

  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return Response.json({ error: "Stripe webhook não configurado." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Assinatura ausente." }, { status: 400 });
  if (isPayloadTooLarge(request, 500_000)) {
    return Response.json({ error: "Payload muito grande." }, { status: 413 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook inválido.";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );

        await upsertSubscriptionFromStripe(subscription as unknown as StripeSubscriptionWithPeriods, {
          organization_id: session.metadata?.organization_id,
          plan_slug: session.metadata?.plan_slug,
          billing_period: session.metadata?.billing_period,
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await upsertSubscriptionFromStripe(event.data.object as unknown as StripeSubscriptionWithPeriods);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & { subscription: string | Stripe.Subscription | null };
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) await markSubscriptionStatus(subscriptionId, "past_due");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar webhook.";
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true });
}
