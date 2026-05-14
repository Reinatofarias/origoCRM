"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { LeadInput } from "@/lib/types";

import { useProspecting } from "../../hooks";
import type { ProspectBusiness, ProspectingSearchInput } from "../../types";
import { ProspectingDesktop } from "./desktop";
import { ProspectingMobile } from "./mobile";

export function ProspectingModal({
  onAddLead,
  onClose,
}: {
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ProspectingModalContent onAddLead={onAddLead} onClose={onClose} />
    </QueryClientProvider>
  );
}

function ProspectingModalContent({
  onAddLead,
  onClose,
}: {
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
}) {
  const prospecting = useProspecting();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function search(input: ProspectingSearchInput) {
    prospecting.searchBusinesses.mutate(input, {
      onSuccess: (result) => {
        prospecting.setSelectedBusiness(result.businesses[0] ?? null);
      },
    });
  }

  async function addBusinessLead(business: ProspectBusiness) {
    await onAddLead({
      name: business.name,
      phone: business.phone ?? "",
      company: business.name,
      source: "Prospecção Inteligente",
      status: "novo",
      estimated_value: business.leadScore && business.leadScore >= 85 ? 4500 : 2200,
      owner_name: "",
      temperature: business.leadScore && business.leadScore >= 85 ? "quente" : "morno",
      outcome_reason: "",
      sla_hours: 24,
    });
    prospecting.markLeadAdded(business.id);
  }

  function generateApproach(business: ProspectBusiness) {
    prospecting.setSelectedBusiness(business);
    prospecting.enrichCompany.mutate({ business });
  }

  function exportBusinessesCsv() {
    const rows = prospecting.businesses.map((business) => ({
      nome: business.name,
      estado: business.state ?? "",
      telefone: business.phone ?? "",
      cidade: business.city ?? "",
      categoria: business.category,
      website: business.website ?? "",
      google_maps: business.googleMapsUrl ?? "",
    }));

    downloadProspectingCsv("origocrm-prospeccao.csv", rows);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black/70 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,211,102,0.12),transparent_28%)]" />
      <div className="relative h-dvh">
        <ProspectingDesktop
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          isLoading={prospecting.isLoading}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClose={onClose}
          onGenerateApproach={generateApproach}
          onExportBusinesses={exportBusinessesCsv}
          onSearch={search}
          onSelectBusiness={prospecting.setSelectedBusiness}
          selectedBusiness={prospecting.selectedBusiness}
        />
        <ProspectingMobile
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          isLoading={prospecting.isLoading}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClose={onClose}
          onGenerateApproach={generateApproach}
          onExportBusinesses={exportBusinessesCsv}
          onSearch={search}
          onSelectBusiness={prospecting.setSelectedBusiness}
          selectedBusiness={prospecting.selectedBusiness}
        />
      </div>
    </div>
  );
}

function downloadProspectingCsv(filename: string, rows: Record<string, string>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default ProspectingModal;
