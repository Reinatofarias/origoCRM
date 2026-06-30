import Stripe from "stripe";
import crypto from "node:crypto";

import { createSupabaseServiceRoleClient } from "@/lib/server/supabase";
import { isPayloadTooLarge } from "@/lib/server/security";
import { getAppUrl, getStripeClient } from "@/lib/server/stripe";
import { ensureWhatsAppInstanceForOrganization } from "@/lib/server/evolution";
import { shouldRetryStripeWebhookEvent } from "@/lib/stripe-webhook-events";
import type { BillingPeriod, PlanSlug } from "@/lib/plans";

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
};

type StripeWebhookEventRow = {
  status: "processing" | "completed" | "failed";
  attempts: number;
  updated_at: string;
};

function isMissingWebhookEventsTable(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("stripe_webhook_events") && (
    normalized.includes("relation") || normalized.includes("schema cache") || normalized.includes("does not exist")
  );
}

async function beginWebhookEvent(event: Stripe.Event) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    event_type: event.type,
    status: "processing",
    attempts: 1,
    updated_at: now,
  });

  if (!insertError) return { shouldProcess: true, trackingEnabled: true };
  if (isMissingWebhookEventsTable(insertError.message)) {
    console.warn("[stripe] idempotency table missing; processing without persistence", { eventId: event.id });
    return { shouldProcess: true, trackingEnabled: false };
  }
  if (insertError.code !== "23505") throw new Error(insertError.message);

  const { data, error } = await supabase
    .from("stripe_webhook_events")
    .select("status,attempts,updated_at")
    .eq("id", event.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const existing = data as StripeWebhookEventRow | null;
  if (!existing) throw new Error("Evento Stripe duplicado sem registro de controle.");
  if (!shouldRetryStripeWebhookEvent({ status: existing.status, updatedAt: existing.updated_at })) {
    return { shouldProcess: false, trackingEnabled: true };
  }

  const { error: retryError } = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempts: existing.attempts + 1,
      error_message: null,
      updated_at: now,
    })
    .eq("id", event.id);

  if (retryError) throw new Error(retryError.message);
  return { shouldProcess: true, trackingEnabled: true };
}

async function finishWebhookEvent(eventId: string, status: "completed" | "failed", errorMessage?: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return;

  await supabase
    .from("stripe_webhook_events")
    .update({
      status,
      error_message: errorMessage ?? null,
      processed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

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
  const seatCount = Math.max(
    1,
    Number(metadata.seat_count ?? subscription.items.data[0]?.quantity ?? 1) || 1,
  );

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
        seat_count: seatCount,
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

async function ensurePublicCheckoutOrganization(
  session: Stripe.Checkout.Session,
  subscription: StripeSubscriptionWithPeriods,
) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) throw new Error("Checkout público sem email do cliente.");

  const normalizedEmail = email.trim().toLowerCase();
  const userId = await findOrInviteUserByEmail(normalizedEmail);
  const organizationName =
    session.customer_details?.name?.trim() ||
    normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) ||
    "OrigoCRM";

  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  let organizationId = typeof existingMember?.organization_id === "string" ? existingMember.organization_id : null;

  if (!organizationId) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: organizationName,
        slug: await makeOrganizationSlug(organizationName),
        owner_user_id: userId,
        status: "active",
      })
      .select("id")
      .single();

    if (organizationError) throw new Error(organizationError.message);
    organizationId = String(organization.id);

    const { error: memberError } = await supabase
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role: "owner",
          status: "active",
        },
        { onConflict: "organization_id,user_id" },
      );

    if (memberError) throw new Error(memberError.message);
  }

  await getStripeClient()?.subscriptions.update(subscription.id, {
    metadata: {
      ...subscription.metadata,
      organization_id: organizationId,
      user_id: userId,
      plan_slug: session.metadata?.plan_slug ?? subscription.metadata.plan_slug,
      billing_period: session.metadata?.billing_period ?? subscription.metadata.billing_period,
      seat_count: session.metadata?.seat_count ?? String(subscription.items.data[0]?.quantity ?? 1),
      source: "public_checkout",
    },
  });

  try {
    await ensureWhatsAppInstanceForOrganization({ organizationId, userId });
  } catch {
    // WhatsApp provisioning must not block paid access. Settings can retry QR/status later.
  }

  return { organizationId, userId };
}

async function findOrInviteUserByEmail(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

  const existingUserId = await findUserIdByEmail(email);
  if (existingUserId) return existingUserId;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getAppUrl()}/login?checkout=success`,
  });

  if (!error && data.user?.id) return data.user.id;
  const afterInviteUserId = await findUserIdByEmail(email);
  if (afterInviteUserId) return afterInviteUserId;

  throw new Error(error?.message ?? "Não foi possível criar o usuário após pagamento.");
}

async function findUserIdByEmail(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return null;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user?.id) return user.id;
    if (data.users.length < 100) break;
  }

  return null;
}

async function makeOrganizationSlug(name: string) {
  const supabase = createSupabaseServiceRoleClient();
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42) || "organizacao";

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const slug = `${base}${suffix}`;
    const { data } = await supabase!
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
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

  let trackingEnabled = false;

  try {
    const eventControl = await beginWebhookEvent(event);
    trackingEnabled = eventControl.trackingEnabled;
    if (!eventControl.shouldProcess) {
      return Response.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string" ? session.subscription : session.subscription.id,
        );
        const publicCheckout =
          session.metadata?.source === "public_checkout" && !session.metadata?.organization_id;
        const publicContext = publicCheckout
          ? await ensurePublicCheckoutOrganization(session, subscription as unknown as StripeSubscriptionWithPeriods)
          : null;

        await upsertSubscriptionFromStripe(subscription as unknown as StripeSubscriptionWithPeriods, {
          organization_id: session.metadata?.organization_id ?? publicContext?.organizationId,
          plan_slug: session.metadata?.plan_slug,
          billing_period: session.metadata?.billing_period,
          seat_count: session.metadata?.seat_count,
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

    if (trackingEnabled) await finishWebhookEvent(event.id, "completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar webhook.";
    if (trackingEnabled) await finishWebhookEvent(event.id, "failed", message);
    return Response.json({ error: message }, { status: 500 });
  }

  return Response.json({ received: true });
}
