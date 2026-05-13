import type { CompanyByCnpj } from "../../types";

export async function enrichCompanyPhones(company: CompanyByCnpj): Promise<CompanyByCnpj> {
  return {
    ...company,
    phones: Array.from(new Set(company.phones)),
    signals: [
      ...company.signals,
      { id: "cnpj-checked", label: "Dados oficiais consultados", tone: "positive" },
    ],
  };
}
