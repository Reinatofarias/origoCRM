import { NextRequest, NextResponse } from "next/server";

import type { CompanyByCnpj, CompanyPartner, ProspectBusinessSignal } from "@/modules/prospecting";

export const dynamic = "force-dynamic";

type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string;
  cnae_fiscal_descricao?: string;
  cnae_fiscal?: number;
  data_inicio_atividade?: string;
  capital_social?: number | string;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
    data_entrada_sociedade?: string;
  }>;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  email?: string | null;
  logradouro?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  message?: string;
};

export async function GET(request: NextRequest) {
  const cnpj = request.nextUrl.searchParams.get("cnpj")?.replace(/\D/g, "") ?? "";

  if (cnpj.length !== 14) {
    return NextResponse.json({ error: "CNPJ deve conter 14 digitos" }, { status: 400 });
  }

  const endpoint = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as BrasilApiCnpjResponse | null;

  if (!response.ok || !payload) {
    return NextResponse.json(
      { error: payload?.message ?? "Nao foi possivel consultar CNPJ na BrasilAPI" },
      { status: response.status || 502 },
    );
  }

  return NextResponse.json(mapBrasilApiCompany(payload));
}

function mapBrasilApiCompany(company: BrasilApiCnpjResponse): CompanyByCnpj {
  const phones = [company.ddd_telefone_1, company.ddd_telefone_2].filter((item): item is string => Boolean(item));
  const emails = [company.email].filter((item): item is string => Boolean(item));
  const registrationStatus = company.descricao_situacao_cadastral ?? "Nao informado";
  const shareCapital = formatCurrency(company.capital_social);
  const leadScore = calculateCompanyScore({ registrationStatus, phones, emails, shareCapital: company.capital_social });

  return {
    cnpj: formatCnpj(company.cnpj ?? ""),
    legalName: company.razao_social ?? "Razao social nao informada",
    tradeName: company.nome_fantasia || company.razao_social || "Nome fantasia nao informado",
    registrationStatus,
    cnae: company.cnae_fiscal_descricao ?? String(company.cnae_fiscal ?? "CNAE nao informado"),
    openedAt: formatDate(company.data_inicio_atividade),
    shareCapital,
    partners: mapPartners(company.qsa),
    address: formatAddress(company),
    phones,
    emails,
    leadScore,
    signals: buildCompanySignals({ registrationStatus, phones, emails, leadScore }),
  };
}

function mapPartners(partners?: BrasilApiCnpjResponse["qsa"]): CompanyPartner[] {
  return (partners ?? []).map((partner) => ({
    name: partner.nome_socio ?? "Socio nao informado",
    role: partner.qualificacao_socio ?? "Qualificacao nao informada",
    since: formatDate(partner.data_entrada_sociedade),
  }));
}

function calculateCompanyScore(input: {
  registrationStatus: string;
  phones: string[];
  emails: string[];
  shareCapital?: number | string;
}) {
  let score = 50;
  if (input.registrationStatus.toLowerCase().includes("ativa")) score += 20;
  if (input.phones.length > 0) score += 10;
  if (input.emails.length > 0) score += 10;
  const capital = Number(input.shareCapital ?? 0);
  if (Number.isFinite(capital) && capital >= 100000) score += 10;
  return Math.max(0, Math.min(100, score));
}

function buildCompanySignals(input: {
  registrationStatus: string;
  phones: string[];
  emails: string[];
  leadScore: number;
}): ProspectBusinessSignal[] {
  const signals: ProspectBusinessSignal[] = [];
  if (input.registrationStatus.toLowerCase().includes("ativa")) {
    signals.push({ id: "active", label: "Situação ativa", tone: "positive" });
  }
  if (input.leadScore >= 85) signals.push({ id: "hot", label: "Lead Quente", tone: "hot" });
  if (input.phones.length === 0) signals.push({ id: "no-phone", label: "Telefone ausente", tone: "warning" });
  if (input.emails.length === 0) signals.push({ id: "no-email", label: "Email ausente", tone: "warning" });
  return signals.length ? signals : [{ id: "checked", label: "Dados oficiais consultados", tone: "neutral" }];
}

function formatAddress(company: BrasilApiCnpjResponse) {
  return [
    company.logradouro,
    company.numero,
    company.complemento,
    company.bairro,
    company.municipio,
    company.uf,
    company.cep,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCurrency(value?: number | string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "Nao informado";
  return amount.toLocaleString("pt-BR", { currency: "BRL", style: "currency" });
}

function formatDate(value?: string | null) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}
