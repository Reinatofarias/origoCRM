import type { Metadata } from "next";

import { CheckoutContent } from "@/components/marketing/checkout-content";

export const metadata: Metadata = {
  title: "Cadastro | OrigoCRM",
  description: "Escolha um plano OrigoCRM e solicite liberacao de acesso.",
};

type CheckoutPageProps = {
  searchParams?: Promise<{
    plan?: string;
    period?: string;
  }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;

  return <CheckoutContent initialPeriod={params?.period} initialPlan={params?.plan} />;
}
