"use client";

import { useMutation } from "@tanstack/react-query";

import { searchGoogleBusinesses } from "../../data";
import type { ProspectingSearchInput } from "../../types";

export function useSearchGoogleBusinesses() {
  return useMutation({
    mutationKey: ["prospecting", "google-businesses"],
    mutationFn: (input: ProspectingSearchInput) => searchGoogleBusinesses(input),
  });
}
