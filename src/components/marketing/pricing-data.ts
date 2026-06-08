export type BillingPeriod = "monthly" | "semiannual" | "annual";

export const billingPeriods: Array<{
  key: BillingPeriod;
  label: string;
  shortLabel: string;
  months: number;
  note: string;
}> = [
  {
    key: "monthly",
    label: "Mensal",
    shortLabel: "mes",
    months: 1,
    note: "Flexibilidade mensal",
  },
  {
    key: "semiannual",
    label: "Semestral",
    shortLabel: "6 meses",
    months: 6,
    note: "Melhor para começar com consistência",
  },
  {
    key: "annual",
    label: "Anual",
    shortLabel: "12 meses",
    months: 12,
    note: "Melhor custo por usuário",
  },
];

export const pricingPlans = [
  {
    name: "Origo Start",
    slug: "base",
    description: "Para organizar a operação comercial sem planilha.",
    prices: {
      monthly: 67,
      semiannual: 57,
      annual: 47,
    },
    features: ["CRM com funil comercial", "Visão completa do lead", "Tarefas e follow-ups", "Mensagens prontas", "Tags e segmentação"],
    highlight: false,
  },
  {
    name: "Origo Pro",
    slug: "pro",
    description: "Para vender pelo WhatsApp com contexto e rotina.",
    prices: {
      monthly: 97,
      semiannual: 82,
      annual: 67,
    },
    features: ["Tudo do Start", "Conversas WhatsApp", "Agenda Google", "Painel de prioridades", "Controle de acesso da equipe"],
    highlight: false,
  },
  {
    name: "Origo Growth",
    slug: "prospecting",
    description: "Para prospectar empresas e transformar listas em conversas.",
    prices: {
      monthly: 147,
      semiannual: 127,
      annual: 97,
    },
    features: ["Tudo do Pro", "Prospecção no Google", "Campanhas WhatsApp", "Controle de envios", "Histórico de campanhas"],
    highlight: true,
  },
];

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
