"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { billingPeriods, formatCurrency, getBillingPeriod, getPlanSavings, pricingPlans, type BillingPeriod } from "./pricing-data";

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  const billing = getBillingPeriod(period);

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 md:flex-row md:items-center md:justify-between">
        <div className="px-2">
          <div className="text-sm font-semibold text-white">Escolha a forma de contratacao</div>
          <p className="mt-1 text-sm text-zinc-500">Os valores abaixo sao por usuario, calculados por mes dentro do periodo escolhido.</p>
        </div>
        <div className="grid gap-2 rounded-xl border border-white/10 bg-black/25 p-1 sm:grid-cols-3">
          {billingPeriods.map((item) => (
            <button
              className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${period === item.key ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
              key={item.key}
              onClick={() => setPeriod(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-10 grid gap-4 lg:grid-cols-4">
        {pricingPlans.map((plan) => {
          const monthlyPrice = plan.prices[period];
          const total = monthlyPrice * billing.months;
          const savings = getPlanSavings(plan, period);

          return (
            <article
              className={`relative overflow-hidden rounded-xl border p-5 transition hover:-translate-y-0.5 ${plan.highlight ? "border-[#8B5CF6]/65 bg-[linear-gradient(180deg,rgba(139,92,246,0.18),rgba(139,92,246,0.07))] shadow-2xl shadow-[#8B5CF6]/20" : "border-white/10 bg-white/[0.035] hover:border-white/20"}`}
              key={plan.slug}
            >
              {plan.highlight && <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.9),rgba(37,211,102,0.45),transparent)]" />}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{plan.description}</p>
                </div>
                {plan.highlight && <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/15 px-2 py-1 text-xs text-[#9AF0B8]">Mais vendido</span>}
              </div>
              <div className="mt-5">
                <span className="text-3xl font-semibold">{formatCurrency(monthlyPrice)}</span>
                <span className="text-sm text-zinc-500"> / usuario / mes</span>
              </div>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-zinc-400">
                {billing.note}. Total do periodo: <span className="font-semibold text-zinc-200">{formatCurrency(total)}</span>
                {savings > 0 && <span className="block text-[#9AF0B8]">Economia de {formatCurrency(savings)} por usuario.</span>}
              </div>
              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li className="flex items-center gap-2 text-sm text-zinc-300" key={feature}>
                    <Check className="h-4 w-4 text-[#25D366]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                className={`mt-6 flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition ${plan.highlight ? "shine-cta bg-[#8B5CF6] text-white hover:bg-[#7C3AED]" : "border border-white/10 text-zinc-200 hover:bg-white/[0.06]"}`}
                href={`/checkout?plan=${plan.slug}&period=${period}`}
              >
                Escolher {billing.label}
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
