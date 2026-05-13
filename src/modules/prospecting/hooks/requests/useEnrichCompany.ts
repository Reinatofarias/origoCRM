"use client";

import { useMutation } from "@tanstack/react-query";

import { enrichCompanyPhones, enrichGoogleBusiness } from "../../data";
import type { CompanyByCnpj, ProspectBusiness } from "../../types";

export function useEnrichCompany() {
  return useMutation({
    mutationKey: ["prospecting", "enrich-company"],
    mutationFn: async (input: { business?: ProspectBusiness; company?: CompanyByCnpj }) => {
      if (input.business) return enrichGoogleBusiness(input.business);
      if (input.company) return enrichCompanyPhones(input.company);
      throw new Error("Empresa obrigatoria para enriquecimento");
    },
  });
}
