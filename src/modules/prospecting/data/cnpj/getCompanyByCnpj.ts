import type { CnpjLookupInput, CompanyByCnpj } from "../../types";

const MOCK_COMPANY_BY_CNPJ: CompanyByCnpj = {
  cnpj: "12.345.678/0001-90",
  legalName: "ORBITA SOLUCOES DIGITAIS LTDA",
  tradeName: "Orbita Growth",
  registrationStatus: "Ativa",
  cnae: "6201-5/01 - Desenvolvimento de programas de computador sob encomenda",
  openedAt: "18/04/2018",
  shareCapital: "R$ 250.000,00",
  partners: [
    { name: "Marina Albuquerque", role: "Sócia-administradora", since: "2018" },
    { name: "Eduardo Farias", role: "Sócio", since: "2021" },
  ],
  address: "Av. Paulista, 171 - Bela Vista, São Paulo - SP, 01311-000",
  phones: ["1198456-2201", "113022-7740"],
  emails: ["contato@orbitagrowth.com.br", "financeiro@orbitagrowth.com.br"],
  leadScore: 88,
  signals: [
    { id: "active", label: "Situação ativa", tone: "positive" },
    { id: "capital", label: "Capital social relevante", tone: "hot" },
    { id: "email", label: "Contato corporativo disponível", tone: "positive" },
  ],
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCompanyByCnpj(input: CnpjLookupInput): Promise<CompanyByCnpj> {
  await delay(820);

  const digits = input.cnpj.replace(/\D/g, "");
  return {
    ...MOCK_COMPANY_BY_CNPJ,
    cnpj: digits.length === 14
      ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : MOCK_COMPANY_BY_CNPJ.cnpj,
  };
}

export { MOCK_COMPANY_BY_CNPJ };
