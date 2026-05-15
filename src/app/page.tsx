import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "OrigoCRM | CRM com WhatsApp e prospeccao",
  description: "CRM com WhatsApp, tarefas, campanhas e prospeccao inteligente para negocios locais.",
};

export default function HomePage() {
  return <LandingPage />;
}
