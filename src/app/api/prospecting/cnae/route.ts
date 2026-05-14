import { NextRequest, NextResponse } from "next/server";

import type { CnaeCompanySearchResult, ProspectBusiness, ProspectBusinessSignal } from "@/modules/prospecting";

export const dynamic = "force-dynamic";

type CnpjWsCompany = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  estabelecimento?: {
    nome_fantasia?: string | null;
    ddd1?: string | null;
    telefone1?: string | null;
    ddd2?: string | null;
    telefone2?: string | null;
    email?: string | null;
    estado?: { sigla?: string | null; nome?: string | null } | null;
    cidade?: { nome?: string | null } | null;
    tipo_logradouro?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    atividade_principal?: { id?: string | number; descricao?: string | null } | null;
  };
  atividade_principal?: { id?: string | number; descricao?: string | null } | null;
};

export async function GET(request: NextRequest) {
  const cnae = request.nextUrl.searchParams.get("cnae")?.replace(/\D/g, "") ?? "";
  const state = request.nextUrl.searchParams.get("state")?.trim().toUpperCase() ?? "";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1), 100);

  if (!cnae || !state) {
    return NextResponse.json({ error: "Informe CNAE e estado" }, { status: 400 });
  }

  const token = process.env.CNPJ_WS_API_TOKEN;
  const endpoint = process.env.CNPJ_WS_SEARCH_ENDPOINT ?? "https://comercial.cnpj.ws/v2/pesquisa";

  if (!token) {
    return NextResponse.json(
      {
        error: "CNPJ_WS_API_TOKEN nao configurada. Busca por CNAE exige API comercial com filtro por CNAE/UF.",
        query: `${cnae} em ${state}`,
        provider: "cnpj_ws",
        hasNextPage: false,
        businesses: [],
      } satisfies CnaeCompanySearchResult & { error: string },
      { status: 503 },
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set("cnae", cnae);
  url.searchParams.set("uf", state);
  url.searchParams.set("limite", String(limit));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { error: extractError(payload) ?? "Nao foi possivel pesquisar CNAE no provedor configurado" },
      { status: response.status },
    );
  }

  const companies = extractCompanies(payload);

  return NextResponse.json({
    query: `${cnae} em ${state}`,
    provider: "cnpj_ws",
    hasNextPage: Boolean((payload as Record<string, unknown> | null)?.proximo_cursor),
    businesses: companies.map((company, index) => mapCompanyToBusiness(company, index, state)),
  } satisfies CnaeCompanySearchResult);
}

function extractCompanies(payload: unknown): CnpjWsCompany[] {
  if (Array.isArray(payload)) return payload as CnpjWsCompany[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const data = record.data ?? record.empresas ?? record.estabelecimentos ?? record.resultados;
  return Array.isArray(data) ? (data as CnpjWsCompany[]) : [];
}

function mapCompanyToBusiness(company: CnpjWsCompany, index: number, fallbackState: string): ProspectBusiness {
  const establishment = company.estabelecimento;
  const phone = normalizePhone(establishment?.ddd1, establishment?.telefone1) || normalizePhone(establishment?.ddd2, establishment?.telefone2);
  const state = establishment?.estado?.sigla ?? fallbackState;
  const city = establishment?.cidade?.nome ?? "";
  const category = establishment?.atividade_principal?.descricao ?? company.atividade_principal?.descricao ?? "Empresa por CNAE";
  const name = establishment?.nome_fantasia || company.nome_fantasia || company.razao_social || "Empresa sem nome";
  const leadScore = calculateCnaeLeadScore({ phone, state });

  return {
    id: company.cnpj ?? `cnae-${index}`,
    name,
    category,
    phone,
    website: "",
    address: [establishment?.tipo_logradouro, establishment?.logradouro, establishment?.numero, establishment?.bairro].filter(Boolean).join(" "),
    city,
    state,
    rating: undefined,
    reviewsCount: 0,
    businessStatus: "operational",
    googleMapsUrl: undefined,
    leadScore,
    signals: buildCnaeSignals({ phone, leadScore }),
    sourceProvider: "cnpj_ws",
  };
}

function normalizePhone(ddd?: string | null, phone?: string | null) {
  const value = `${ddd ?? ""}${phone ?? ""}`.replace(/\D/g, "");
  return value || "";
}

function calculateCnaeLeadScore(input: { phone: string; state: string }) {
  let score = 62;
  if (input.phone) score += 18;
  if (input.state) score += 8;
  return Math.min(100, score);
}

function buildCnaeSignals(input: { phone: string; leadScore: number }): ProspectBusinessSignal[] {
  const signals: ProspectBusinessSignal[] = [];
  if (input.leadScore >= 80) signals.push({ id: "hot", label: "Lead Quente", tone: "hot" });
  if (input.phone) signals.push({ id: "phone", label: "Telefone capturado", tone: "positive" });
  else signals.push({ id: "no-phone", label: "Telefone ausente", tone: "warning" });
  signals.push({ id: "cnae", label: "Origem CNAE", tone: "neutral" });
  return signals;
}

function extractError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return String(record.error ?? record.message ?? record.detalhes ?? "") || null;
}
