import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";
import { enforceRateLimit, rateLimitJson } from "@/lib/server/security";
import { getAppUrl, getStripeClient } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return Response.json({ error: auth.error ?? "Não autenticado" }, { status: 401 });

  const permissionError = requireServerPermission(auth, "billing:manage");
  if (permissionError) return Response.json({ error: permissionError }, { status: 403 });
  if (!auth.organizationId) return Response.json({ error: "Base SaaS pendente." }, { status: 400 });
  const rateLimit = await enforceRateLimit({
    request,
    scope: "billing.portal",
    identifier: auth.organizationId,
    limit: 8,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);

  const stripe = getStripeClient();
  if (!stripe) return Response.json({ error: "STRIPE_SECRET_KEY não configurada." }, { status: 500 });

  const { data: subscription, error } = await auth.supabase
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subscription?.provider_customer_id || typeof subscription.provider_customer_id !== "string") {
    return Response.json({ error: "Nenhum cliente Stripe encontrado para esta organização." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.provider_customer_id,
    return_url: `${getAppUrl()}/settings?tab=data`,
  });

  return Response.json({ url: session.url });
}
