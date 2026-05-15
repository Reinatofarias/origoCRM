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
    note: "Melhor para validar a operacao",
  },
  {
    key: "annual",
    label: "Anual",
    shortLabel: "12 meses",
    months: 12,
    note: "Melhor custo por usuario",
  },
];

export const pricingPlans = [
  {
    name: "CRM Base",
    slug: "base",
    description: "Pare de perder leads por falta de organizacao.",
    prices: {
      monthly: 197,
      semiannual: 167,
      annual: 147,
    },
    features: ["Funil de vendas", "Visao completa do cliente", "Tarefas do dia", "Segmentacao por interesse", "Mensagens prontas"],
    highlight: false,
  },
  {
    name: "CRM Pro",
    slug: "pro",
    description: "Transforme conversas do WhatsApp em rotina comercial.",
    prices: {
      monthly: 297,
      semiannual: 247,
      annual: 217,
    },
    features: ["Atendimento pelo WhatsApp", "Historico do cliente", "Indicadores de venda", "Relatorios para decisao", "Registro de atividades"],
    highlight: false,
  },
  {
    name: "CRM + Prospeccao",
    slug: "prospecting",
    description: "Encontre empresas, valide contatos e inicie conversas.",
    prices: {
      monthly: 497,
      semiannual: 417,
      annual: 367,
    },
    features: ["Busca no Google", "Contatos com WhatsApp", "Envios em lote", "Acompanhamento de respostas", "Segmentacao automatica"],
    highlight: true,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "Para operacoes que precisam de volume, controle e acompanhamento.",
    prices: {
      monthly: 797,
      semiannual: 667,
      annual: 597,
    },
    features: ["Mais volume", "Suporte prioritario", "Onboarding guiado", "Campanhas avancadas", "Diagnostico WhatsApp"],
    highlight: false,
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
