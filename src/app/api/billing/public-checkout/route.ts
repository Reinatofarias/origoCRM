import { getAppUrl, getStripeClient } from "@/lib/server/stripe";
import { getBillingPeriod, getPlan, getPlanPriceCents, type BillingPeriod, type PlanSlug } from "@/lib/plans";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) return Response.json({ error: "Stripe não configurado." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as { planSlug?: PlanSlug; billingPeriod?: BillingPeriod } | null;
  const planSlug = body?.planSlug;
  const billingPeriod = body?.billingPeriod ?? "monthly";
  const plan = planSlug ? getPlan(planSlug) : null;

  if (!plan || !["monthly", "semiannual", "annual"].includes(billingPeriod)) {
    return Response.json({ error: "Plano ou período inválido." }, { status: 400 });
  }

  const billing = getBillingPeriod(billingPeriod);
  const appUrl = getAppUrl();
  const metadata = {
    plan_slug: plan.slug,
    billing_period: billing.key,
    seat_count: "1",
    source: "public_checkout",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
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
    success_url: `${appUrl}/login?checkout=success&plan=${plan.slug}&period=${billing.key}`,
    cancel_url: `${appUrl}/checkout?checkout=canceled&plan=${plan.slug}&period=${billing.key}`,
    allow_promotion_codes: true,
  });

  return Response.json({ url: session.url });
}
