"use client";

import { useMutation } from "@tanstack/react-query";

import { enrichGoogleBusiness } from "../../data";
import type { ProspectBusiness } from "../../types";

export function useEnrichCompany() {
  return useMutation({
    mutationKey: ["prospecting", "enrich-company"],
    mutationFn: async (input: { business: ProspectBusiness }) => {
      if (input.business) return enrichGoogleBusiness(input.business);
      throw new Error("Empresa obrigatoria para enriquecimento");
    },
  });
}
