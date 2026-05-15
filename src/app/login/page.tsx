import type { Metadata } from "next";

import { CrmApp } from "@/components/crm-app";

export const metadata: Metadata = {
  title: "Entrar | OrigoCRM",
  description: "Acesse sua conta OrigoCRM.",
};

export default function LoginPage() {
  return <CrmApp initialView="dashboard" />;
}
