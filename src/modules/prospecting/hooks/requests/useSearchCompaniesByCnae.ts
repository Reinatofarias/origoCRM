"use client";

import { useMutation } from "@tanstack/react-query";

import { searchCompaniesByCnae } from "../../data";
import type { CnaeLookupInput } from "../../types";

export function useSearchCompaniesByCnae() {
  return useMutation({
    mutationKey: ["prospecting", "cnae"],
    mutationFn: (input: CnaeLookupInput) => searchCompaniesByCnae(input),
  });
}
