"use client";

import { ArrowRight, Check, CreditCard, MessageCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { billingPeriods, formatCurrency, getBillingPeriod, getPlanSavings, pricingPlans, type BillingPeriod } from "./pricing-data";

function getInitialPeriod(value: string | null): BillingPeriod {
  if (value === "semiannual" || value === "annual" || value === "monthly") return value;
  return "annual";
}

export function CheckoutContent({
  initialPeriod = "annual",
  initialPlan = "prospecting",
}: {
  initialPeriod: string | null;
  initialPlan: string | null;
}) {
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>(() => getInitialPeriod(initialPeriod));
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || "prospecting");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const billing = getBillingPeriod(selectedPeriod);
  const selectedPlanData = useMemo(
    () => pricingPlans.find((plan) => plan.slug === selectedPlan) ?? pricingPlans[pricingPlans.length - 1],
    [selectedPlan],
  );
  const selectedPlanName = selectedPlanData?.name ?? "Origo Growth";

  async function startCheckout(planSlug: string) {
    setSelectedPlan(planSlug);
    setCheckoutError("");
    setLoadingPlan(planSlug);

    try {
      const response = await fetch("/api/billing/public-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingPeriod: selectedPeriod }),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setCheckoutError(data.error ?? "NÃ£o foi possÃ­vel iniciar o pagamento.");
        return;
      }

      window.location.assign(data.url);
    } catch {
      setCheckoutError("NÃ£o foi possÃ­vel iniciar o pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08080C] px-5 py-8 text-white">
      <div className="glow-breathe absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.32),transparent_45%),radial-gradient(ellipse_at_88%_18%,rgba(37,211,102,0.12),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
      <div className="relative mx-auto max-w-5xl">
        <header className="reveal-up flex items-center justify-between gap-4">
          <Link className="relative block h-12 w-44" href="/">
            <Image alt="OrigoCRM" className="object-contain object-left" fill priority sizes="176px" src="/origocrm-logo.png" />
          </Link>
        </header>

        <section className="reveal-up relative mt-14 overflow-hidden rounded-2xl border border-white/10 bg-[#111018]/90 p-6 shadow-2xl shadow-[#8B5CF6]/15 backdrop-blur-xl md:p-8" style={{ "--delay": "100ms" } as CSSProperties}>
          <div className="absolute -right-20 -top-24 h-72 w-72 opacity-[0.06]">
            <Image alt="" className="object-contain" fill sizes="288px" src="/origocrm-icon.png" />
          </div>
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.35),transparent)]" />
          <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[#DDD6FE]">
                <CreditCard className="h-3.5 w-3.5" />
                Escolha seu plano
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.02em]">Escolha o plano ideal para sua operaÃ§Ã£o.</h1>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Comece com o essencial para organizar seus leads e avance para WhatsApp, agenda, prospecÃ§Ã£o e campanhas conforme sua operaÃ§Ã£o crescer.
              </p>
              <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-3">
                <div className="text-sm font-semibold text-white">PerÃ­odo de contrataÃ§Ã£o</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {billingPeriods.map((period) => (
                    <button
                      className={`h-10 rounded-lg px-3 text-sm font-semibold transition ${selectedPeriod === period.key ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25" : "border border-white/10 text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
                      key={period.key}
                      onClick={() => setSelectedPeriod(period.key)}
                      type="button"
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {["Escolha o plano mais adequado", "Confirme mensal, semestral ou anual", "FaÃ§a o pagamento com seguranÃ§a", "Receba seu acesso apÃ³s a confirmaÃ§Ã£o"].map((step, index) => (
                  <div className="reveal-up flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-300" key={step} style={{ "--delay": `${180 + index * 80}ms` } as CSSProperties}>
                    <Check className="h-4 w-4 text-[#25D366]" />
                    {step}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {pricingPlans.map((plan, index) => {
                const monthlyPrice = plan.prices[selectedPeriod];
                const total = monthlyPrice * billing.months;
                const savings = getPlanSavings(plan, selectedPeriod);
                const active = plan.slug === selectedPlan;

                return (
                  <button
                    className={`group reveal-up relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${active ? "border-[#8B5CF6]/65 bg-[#8B5CF6]/12 shadow-xl shadow-[#8B5CF6]/10" : "border-white/10 bg-black/25 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/10"}`}
                    key={plan.slug}
                    onClick={() => void startCheckout(plan.slug)}
                    style={{ "--delay": `${160 + index * 90}ms` } as CSSProperties}
                    type="button"
                  >
                    <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.6),transparent)] opacity-0 transition group-hover:opacity-100" />
                    <div>
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="mt-1 text-sm text-zinc-500">{formatCurrency(monthlyPrice)} / usuÃ¡rio / mÃªs</div>
                      <div className="mt-1 text-xs text-zinc-600">Total {billing.shortLabel}: {formatCurrency(total)}</div>
                      {savings > 0 && <div className="mt-1 text-xs text-[#9AF0B8]">Economia de {formatCurrency(savings)} por usuÃ¡rio</div>}
                    </div>
                    <ArrowRight className={`h-4 w-4 text-zinc-500 transition group-hover:text-white ${loadingPlan === plan.slug ? "animate-pulse" : ""}`} />
                  </button>
                );
              })}

              <div className="reveal-up mt-3 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 p-4 shadow-xl shadow-[#25D366]/10" style={{ "--delay": "560ms" } as CSSProperties}>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#9AF0B8]">
                  <MessageCircle className="h-4 w-4" />
                  Como funciona a contrataÃ§Ã£o
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Plano selecionado: <span className="font-semibold text-white">{selectedPlanName}</span> no perÃ­odo <span className="font-semibold text-white">{billing.label}</span>. Clique no card para pagar com segurança pelo Stripe.
                </p>
              </div>
              {checkoutError && (
                <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
                  {checkoutError}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="reveal-up mt-6 flex items-center gap-2 text-sm text-zinc-500" style={{ "--delay": "220ms" } as CSSProperties}>
          <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
          Seu acesso Ã© individual e protegido para manter a operaÃ§Ã£o da equipe organizada.
        </div>
      </div>
    </main>
  );
}
