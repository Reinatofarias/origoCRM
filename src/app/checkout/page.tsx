import type { Metadata } from "next";

import { CheckoutContent } from "@/components/marketing/checkout-content";

export const metadata: Metadata = {
  title: "Planos | OrigoCRM",
  description: "Escolha o plano OrigoCRM ideal para organizar leads, WhatsApp, tarefas, prospecção e campanhas.",
};

type CheckoutPageProps = {
  searchParams: Promise<{
    plan: string;
    period: string;
  }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;

  return <CheckoutContent initialPeriod={params.period} initialPlan={params.plan} />;
}
