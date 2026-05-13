import type { CompanyByCnpj } from "../../types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichCompanyPhones(company: CompanyByCnpj): Promise<CompanyByCnpj> {
  await delay(520);

  const extraPhones = ["1197000-4318", "1193322-6002"];

  return {
    ...company,
    phones: Array.from(new Set([...company.phones, ...extraPhones])),
    signals: [
      ...company.signals,
      { id: "phones-enriched", label: "Telefones enriquecidos", tone: "positive" },
    ],
  };
}
