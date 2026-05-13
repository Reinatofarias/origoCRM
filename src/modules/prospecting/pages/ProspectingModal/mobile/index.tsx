"use client";

import { Flame, X } from "lucide-react";

import type { CompanyByCnpj, ProspectBusiness, ProspectingSearchInput } from "../../../types";
import { BusinessCard, BusinessDetails, CnpjLookupCard, ProspectingSearchForm, ProspectingSkeleton } from "../components";

export function ProspectingMobile({
  addedLeadIds,
  approach,
  businesses,
  company,
  isLoading,
  metrics,
  onAddBusinessLead,
  onClose,
  onGenerateApproach,
  onLookupCnpj,
  onSearch,
  onSelectBusiness,
  selectedBusiness,
}: {
  addedLeadIds: Set<string>;
  approach: string;
  businesses: ProspectBusiness[];
  company: CompanyByCnpj | null;
  isLoading: boolean;
  metrics: { total: number; hot: number; withoutSite: number; weakProfiles: number };
  onAddBusinessLead: (business: ProspectBusiness) => void;
  onClose: () => void;
  onGenerateApproach: (business: ProspectBusiness) => void;
  onLookupCnpj: (cnpj: string) => void;
  onSearch: (input: ProspectingSearchInput) => void;
  onSelectBusiness: (business: ProspectBusiness) => void;
  selectedBusiness: ProspectBusiness | null;
}) {
  return (
    <div className="h-full overflow-y-auto p-4 xl:hidden">
      <section className="rounded-3xl border border-[#8B5CF6]/25 bg-[#111018]/85 p-4 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#A78BFA]">
              <Flame className="h-4 w-4" />
              Prospecção Inteligente
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Buscar empresas</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Google Maps, CNPJ e qualificação comercial em uma experiência única.</p>
          </div>
          <button
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Empresas" value={metrics.total} />
          <Metric label="Quentes" value={metrics.hot} />
          <Metric label="Sem site" value={metrics.withoutSite} />
          <Metric label="GMB fraco" value={metrics.weakProfiles} />
        </div>
      </section>
      <div className="mt-4 space-y-4">
        <ProspectingSearchForm isLoading={isLoading} onSearch={onSearch} />
        {isLoading && <ProspectingSkeleton />}
        {!isLoading && businesses.map((business) => (
          <BusinessCard
            business={business}
            isAdded={addedLeadIds.has(business.id)}
            key={business.id}
            onAddLead={() => onAddBusinessLead(business)}
            onGenerateApproach={() => onGenerateApproach(business)}
            onViewDetails={() => onSelectBusiness(business)}
          />
        ))}
        <BusinessDetails approach={approach} business={selectedBusiness} />
        <CnpjLookupCard company={company} isLoading={isLoading} onLookup={onLookupCnpj} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
