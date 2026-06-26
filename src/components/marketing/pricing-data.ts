import {
  billingPeriods as appBillingPeriods,
  plans as appPlans,
  type BillingPeriod,
} from "@/lib/plans";

export type { BillingPeriod };

export const billingPeriods: Array<{
  key: BillingPeriod;
  label: string;
  shortLabel: string;
  months: number;
  note: string;
}> = appBillingPeriods.map((period) => ({
  key: period.key,
  label: period.label,
  shortLabel: period.shortLabel,
  months: period.months,
  note:
    period.key === "monthly"
      ? "Flexibilidade mensal"
      : period.key === "semiannual"
        ? "Melhor para começar com consistência"
        : "Melhor custo por usuário",
}));

const marketingDescriptions: Record<string, string> = {
  base: "Para organizar leads, tarefas e WhatsApp sem planilhas.",
  pro: "Para prospectar, conversar e acompanhar oportunidades.",
  prospecting: "Para crescer com mais volume, campanhas e controle comercial.",
};

const marketingFeatures: Record<string, string[]> = {
  base: ["CRM com funil comercial", "Visão completa do lead", "WhatsApp conectado", "Tarefas e follow-ups", "Mensagens prontas"],
  pro: ["Tudo do Start", "Prospecção no Google", "Campanhas WhatsApp", "Agenda Google", "Painel de prioridades"],
  prospecting: ["Tudo do Pro", "Limites maiores de prospecção", "Mais contatos por campanha", "Controle de envios", "Histórico de campanhas"],
};

export const pricingPlans = appPlans.map((plan) => ({
  name: plan.name,
  slug: plan.slug,
  description: marketingDescriptions[plan.slug] ?? plan.description,
  prices: {
    monthly: plan.prices.monthly / 100,
    semiannual: plan.prices.semiannual / 100,
    annual: plan.prices.annual / 100,
  },
  features: marketingFeatures[plan.slug] ?? plan.highlights,
  highlight: Boolean(plan.featured),
}));

export function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

export function getBillingPeriod(period: BillingPeriod) {
  return billingPeriods.find((item) => item.key === period) ?? billingPeriods[0];
}

export function getPlanSavings(plan: (typeof pricingPlans)[number], period: BillingPeriod) {
  const billing = getBillingPeriod(period);
  return plan.prices.monthly * billing.months - plan.prices[period] * billing.months;
}
