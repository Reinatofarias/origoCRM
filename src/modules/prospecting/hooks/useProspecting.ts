"use client";

import { useMemo, useState } from "react";

import { useEnrichCompany, useGetCompanyByCnpj, useSearchCompaniesByCnae, useSearchGoogleBusinesses } from "./requests";
import type { CompanyByCnpj, ProspectBusiness } from "../types";

export function useProspecting() {
  const [selectedBusiness, setSelectedBusiness] = useState<ProspectBusiness | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyByCnpj | null>(null);
  const [addedLeadIds, setAddedLeadIds] = useState<Set<string>>(() => new Set());
  const searchBusinesses = useSearchGoogleBusinesses();
  const getCompanyByCnpj = useGetCompanyByCnpj();
  const searchCompaniesByCnae = useSearchCompaniesByCnae();
  const enrichCompany = useEnrichCompany();

  const businesses = useMemo(
    () => [...(searchBusinesses.data?.businesses ?? []), ...(searchCompaniesByCnae.data?.businesses ?? [])],
    [searchBusinesses.data?.businesses, searchCompaniesByCnae.data?.businesses],
  );
  const isLoading = searchBusinesses.isPending || getCompanyByCnpj.isPending || searchCompaniesByCnae.isPending || enrichCompany.isPending;
  const generatedApproach = enrichCompany.data && "approach" in enrichCompany.data ? enrichCompany.data.approach : "";

  const metrics = useMemo(() => {
    const hot = businesses.filter((business) => (business.leadScore ?? 0) >= 85).length;
    const withoutSite = businesses.filter((business) => !business.website).length;
    const weakProfiles = businesses.filter((business) =>
      business.signals.some((signal) => signal.id === "gmb" || signal.id === "low-reviews"),
    ).length;

    return {
      total: businesses.length,
      hot,
      withoutSite,
      weakProfiles,
    };
  }, [businesses]);

  function markLeadAdded(id: string) {
    setAddedLeadIds((current) => new Set(current).add(id));
  }

  return {
    addedLeadIds,
    businesses,
    enrichCompany,
    generatedApproach,
    getCompanyByCnpj,
    isLoading,
    markLeadAdded,
    metrics,
    searchCompaniesByCnae,
    searchBusinesses,
    selectedBusiness,
    selectedCompany,
    setSelectedBusiness,
    setSelectedCompany,
  };
}
