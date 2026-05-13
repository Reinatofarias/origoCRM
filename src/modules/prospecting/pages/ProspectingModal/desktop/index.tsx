"use client";

import { BarChart3, Database, Flame, Globe2, X } from "lucide-react";
import type { ComponentType } from "react";

import type { CompanyByCnpj, ProspectBusiness, ProspectingSearchInput } from "../../../types";
import { BusinessCard, BusinessDetails, CnpjLookupCard, ProspectingSearchForm, ProspectingSkeleton } from "../components";

export function ProspectingDesktop({
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
    <div className="hidden h-full min-h-0 grid-cols-[minmax(0,1fr)_25rem] gap-5 p-5 xl:grid">
      <section className="min-h-0 overflow-hidden rounded-3xl border border-[#8B5CF6]/25 bg-[#111018]/80 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-2xl">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#A78BFA]">
                <Flame className="h-4 w-4" />
                Prospecção Inteligente
              </div>
              <h2 className="mt-2 text-3xl font-semibold text-white">Encontre empresas e transforme em leads</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Integração server-side preparada para Outscraper agora, com espaço para Apify e Google Places em próximas fontes.
              </p>
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric icon={Database} label="Empresas" value={metrics.total} />
            <Metric icon={Flame} label="Quentes" value={metrics.hot} />
            <Metric icon={Globe2} label="Sem site" value={metrics.withoutSite} />
            <Metric icon={BarChart3} label="GMB fraco" value={metrics.weakProfiles} />
          </div>
        </div>
        <div className="grid h-[calc(100%-13rem)] min-h-0 grid-rows-[auto_1fr] gap-5 p-5">
          <ProspectingSearchForm isLoading={isLoading} onSearch={onSearch} />
          <div className="min-h-0 overflow-y-auto pr-1">
            {isLoading && <ProspectingSkeleton />}
            {!isLoading && businesses.length === 0 && (
              <div className="flex h-full min-h-80 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-sm text-zinc-500">
                Configure OUTSCRAPER_API_KEY na Vercel e faça uma busca por nicho e cidade para iniciar a prospecção real.
              </div>
            )}
            {!isLoading && businesses.length > 0 && (
              <div className="grid gap-4 2xl:grid-cols-2">
                {businesses.map((business) => (
                  <BusinessCard
                    business={business}
                    isAdded={addedLeadIds.has(business.id)}
                    key={business.id}
                    onAddLead={() => onAddBusinessLead(business)}
                    onGenerateApproach={() => onGenerateApproach(business)}
                    onViewDetails={() => onSelectBusiness(business)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="min-h-0 space-y-5 overflow-y-auto">
        <BusinessDetails approach={approach} business={selectedBusiness} />
        <CnpjLookupCard company={company} isLoading={isLoading} onLookup={onLookupCnpj} />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
      <Icon className="h-4 w-4 text-[#A78BFA]" />
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
