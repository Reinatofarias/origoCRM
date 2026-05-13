import type { CnpjLookupInput, CompanyByCnpj } from "../../types";

export async function getCompanyByCnpj(input: CnpjLookupInput): Promise<CompanyByCnpj> {
  const response = await fetch(`/api/prospecting/cnpj?cnpj=${encodeURIComponent(input.cnpj)}`, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const payload = (await response.json()) as CompanyByCnpj & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Nao foi possivel consultar o CNPJ");
  }

  return payload;
}
