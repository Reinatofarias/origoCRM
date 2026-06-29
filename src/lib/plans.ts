import type { Subscription } from "./types";

export type PlanSlug = Subscription["plan_slug"];
export type BillingPeriod = Subscription["billing_period"];

export type PlanFeature =
  | "crm"
  | "conversations"
  | "tasks"
  | "templates"
  | "prospecting"
  | "campaigns"
  | "googleCalendar"
  | "team"
  | "advancedDashboard";

export type PlanDefinition = {
  slug: Exclude<PlanSlug, "manual">;
  name: string;
  description: string;
  monthlyPrice: number;
  prices: Record<BillingPeriod, number>;
  includedSeats: number;
  limits: {
    whatsappInstances: number;
    prospectingSearchLimit: number;
    campaignBatchLimit: number;
  };
  features: PlanFeature[];
  highlights: string[];
  featured?: boolean;
};

export type BillingPeriodDefinition = {
  key: BillingPeriod;
  label: string;
  shortLabel: string;
  months: number;
  interval: "month" | "year";
  intervalCount: number;
  discountPercent: number;
};

export const billingPeriods: BillingPeriodDefinition[] = [
  {
    key: "monthly",
    label: "Mensal",
    shortLabel: "mês",
    months: 1,
    interval: "month",
    intervalCount: 1,
    discountPercent: 0,
  },
  {
    key: "semiannual",
    label: "Semestral",
    shortLabel: "6 meses",
    months: 6,
    interval: "month",
    intervalCount: 6,
    discountPercent: 16,
  },
  {
    key: "annual",
    label: "Anual",
    shortLabel: "12 meses",
    months: 12,
    interval: "year",
    intervalCount: 1,
    discountPercent: 25,
  },
];

export const plans: PlanDefinition[] = [
  {
    slug: "base",
    name: "Origo Start",
    description: "CRM essencial com funil, tarefas e WhatsApp conectado.",
    monthlyPrice: 6700,
    prices: {
      monthly: 6700,
      semiannual: 5700,
      annual: 4700,
    },
    includedSeats: 1,
    limits: {
      whatsappInstances: 1,
      prospectingSearchLimit: 0,
      campaignBatchLimit: 0,
    },
    features: ["crm", "conversations", "tasks", "templates"],
    highlights: ["Funil comercial", "Lead 360", "WhatsApp conectado", "Tarefas do dia"],
  },
  {
    slug: "pro",
    name: "Origo Pro",
    description: "WhatsApp, agenda, prospecção e campanhas para operar vendas.",
    monthlyPrice: 9700,
    prices: {
      monthly: 9700,
      semiannual: 8200,
      annual: 6700,
    },
    includedSeats: 1,
    limits: {
      whatsappInstances: 1,
      prospectingSearchLimit: 60,
      campaignBatchLimit: 20,
    },
    features: ["crm", "conversations", "tasks", "templates", "prospecting", "campaigns", "googleCalendar", "advancedDashboard"],
    highlights: ["Inbox WhatsApp", "Prospecção Google", "Campanhas WhatsApp", "Google Calendar"],
  },
  {
    slug: "prospecting",
    name: "Origo Growth",
    description: "CRM completo com prospecção, campanhas e limites maiores por usuário.",
    monthlyPrice: 14700,
    prices: {
      monthly: 14700,
      semiannual: 12700,
      annual: 9700,
    },
    includedSeats: 1,
    limits: {
      whatsappInstances: 1,
      prospectingSearchLimit: 120,
      campaignBatchLimit: 50,
    },
    features: ["crm", "conversations", "tasks", "templates", "prospecting", "campaigns", "googleCalendar", "advancedDashboard"],
    highlights: ["Limites maiores", "Prospecção Google", "Campanhas WhatsApp", "Validação de contatos"],
    featured: true,
  },
];

export function getBillingPeriod(period: BillingPeriod) {
  return billingPeriods.find((item) => item.key === period) ?? billingPeriods[0];
}

export function getPlan(slug: PlanSlug) {
  if (slug === "manual") return null;
  return plans.find((plan) => plan.slug === slug) ?? null;
}

export function getPlanPriceCents(planSlug: PlanSlug, period: BillingPeriod) {
  const plan = getPlan(planSlug);
  const billing = getBillingPeriod(period);
  if (!plan) return 0;
  return Math.round(plan.prices[period] * billing.months);
}

export function getPlanMonthlyEquivalentCents(planSlug: PlanSlug, period: BillingPeriod) {
  const billing = getBillingPeriod(period);
  return Math.round(getPlanPriceCents(planSlug, period) / billing.months);
}

export function formatMoneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function planHasFeature(planSlug: PlanSlug | null | undefined, feature: PlanFeature) {
  if (planSlug === "manual") return true;
  const plan = getPlan(planSlug ?? "base");
  return Boolean(plan?.features.includes(feature));
}

export function isSubscriptionOperational(
  status: string | null | undefined,
  provider: string | null | undefined,
) {
  if (provider === "manual") return true;
  return status === "active" || status === "trialing";
}

export function getPlanUserLimit(planSlug: PlanSlug | null | undefined, seatCount?: number | null) {
  if (planSlug === "manual") return 999;
  const paidSeats = Number.isFinite(Number(seatCount)) ? Number(seatCount) : null;
  return Math.max(1, paidSeats ?? getPlan(planSlug ?? "base")?.includedSeats ?? 1);
}

export function getPlanLimits(planSlug: PlanSlug | null | undefined) {
  if (planSlug === "manual") {
    return {
      whatsappInstances: 99,
      prospectingSearchLimit: 500,
      campaignBatchLimit: 200,
    };
  }

  return getPlan(planSlug ?? "base")?.limits ?? plans[0].limits;
}
