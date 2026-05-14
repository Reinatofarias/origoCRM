import type { ProspectBusiness, ProspectingSearchInput, ProspectingSearchResult } from "../../types";

export async function searchGoogleBusinesses(input: ProspectingSearchInput): Promise<ProspectingSearchResult> {
  const response = await fetch("/api/prospecting/google-businesses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as ProspectingSearchResult & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Nao foi possivel buscar empresas");
  }

  return {
    ...payload,
    businesses: payload.businesses.map((business) => normalizeProspectBusiness(business)),
  };
}

function normalizeProspectBusiness(business: ProspectBusiness): ProspectBusiness {
  return {
    ...business,
    signals: business.signals ?? [],
    sourceProvider: business.sourceProvider ?? "serpapi",
  };
}
