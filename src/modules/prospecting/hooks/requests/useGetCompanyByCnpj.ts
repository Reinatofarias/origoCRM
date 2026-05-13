"use client";

import { useMutation } from "@tanstack/react-query";

import { getCompanyByCnpj } from "../../data";
import type { CnpjLookupInput } from "../../types";

export function useGetCompanyByCnpj() {
  return useMutation({
    mutationKey: ["prospecting", "cnpj"],
    mutationFn: (input: CnpjLookupInput) => getCompanyByCnpj(input),
  });
}
