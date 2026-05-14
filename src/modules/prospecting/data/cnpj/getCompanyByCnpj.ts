import type { CnaeCompanySearchResult, CnaeLookupInput, CnpjLookupInput, CompanyByCnpj } from "../../types";

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

export async function searchCompaniesByCnae(input: CnaeLookupInput): Promise<CnaeCompanySearchResult> {
  const params = new URLSearchParams({
    cnae: input.cnae,
    state: input.state,
    limit: String(input.limit ?? 50),
  });
  const response = await fetch(`/api/prospecting/cnae?${params.toString()}`, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  const payload = (await response.json()) as CnaeCompanySearchResult & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Nao foi possivel pesquisar empresas por CNAE");
  }

  return payload;
}
