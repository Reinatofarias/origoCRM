import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";
import { enforceRateLimit, isPayloadTooLarge, rateLimitJson } from "@/lib/server/security";
import { getAppUrl, getStripeClient } from "@/lib/server/stripe";
import { getBillingPeriod, getPlan, getPlanPriceCents, type BillingPeriod, type PlanSlug } from "@/lib/plans";

export async function POST(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return Response.json({ error: auth.error ?? "Não autenticado" }, { status: 401 });

  const permissionError = requireServerPermission(auth, "billing:manage");
  if (permissionError) return Response.json({ error: permissionError }, { status: 403 });
  if (!auth.organizationId) return Response.json({ error: "Base SaaS pendente." }, { status: 400 });
  const rateLimit = await enforceRateLimit({
    request,
    scope: "billing.checkout",
    identifier: auth.organizationId,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);
  if (isPayloadTooLarge(request, 10_000)) {
    return Response.json({ error: "Payload muito grande." }, { status: 413 });
  }

  const stripe = getStripeClient();
  if (!stripe) return Response.json({ error: "STRIPE_SECRET_KEY não configurada." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as {
    planSlug: PlanSlug;
    billingPeriod: BillingPeriod;
    seatCount?: number;
  } | null;
  const planSlug = body?.planSlug;
  const billingPeriod = body?.billingPeriod ?? "monthly";
  const parsedSeatCount = Number(body?.seatCount ?? 1);
  const seatCount = Math.min(50, Math.max(1, Number.isFinite(parsedSeatCount) ? Math.floor(parsedSeatCount) : 1));
  const plan = planSlug ? getPlan(planSlug) : null;

  if (!plan || !["monthly", "semiannual", "annual"].includes(billingPeriod)) {
    return Response.json({ error: "Plano ou período inválido." }, { status: 400 });
  }

  const billing = getBillingPeriod(billingPeriod);
  const appUrl = getAppUrl();
  const metadata = {
    organization_id: auth.organizationId,
    user_id: auth.user.id,
    plan_slug: plan.slug,
    billing_period: billing.key,
    seat_count: String(seatCount),
  };

  const { data: currentSubscription } = await auth.supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: typeof currentSubscription?.provider_customer_id === "string" ? currentSubscription.provider_customer_id : undefined,
    customer_email: currentSubscription?.provider_customer_id ? undefined : auth.user.email ?? undefined,
    client_reference_id: auth.organizationId,
    line_items: [
      {
        quantity: seatCount,
        price_data: {
          currency: "brl",
          unit_amount: getPlanPriceCents(plan.slug, billing.key),
          product_data: {
            name: plan.name,
            description: plan.description,
          },
          recurring: {
            interval: billing.interval,
            interval_count: billing.intervalCount,
          },
        },
      },
    ],
    metadata,
    subscription_data: { metadata },
    success_url: `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/settings?billing=canceled`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
}
