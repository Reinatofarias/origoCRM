"use client";

import { BarChart3, Database, Download, Flame, Globe2, X } from "lucide-react";
import type { ComponentType } from "react";

import type { MessageTemplate } from "@/lib/types";

import type { ProspectBusiness, ProspectingDispatchState, ProspectingSearchInput } from "../../../types";
import { BusinessDetails, BusinessTable, CampaignPanel, ProspectingSearchForm, ProspectingSkeleton } from "../components";

export function ProspectingDesktop({
  addedLeadIds,
  approach,
  businesses,
  dispatchStates,
  existingLeadPhones,
  intervalSeconds,
  isLoading,
  isSendingCampaign,
  metrics,
  onAddBusinessLead,
  onClearSelection,
  onClose,
  onIgnoreSelected,
  onExportBusinesses,
  onIntervalChange,
  onSearch,
  onSelectPhoneProspects,
  onSelectBusiness,
  onStartCampaign,
  onTemplateChange,
  onToggleBusiness,
  previewMessage,
  selectedBusinessIds,
  selectedTemplateId,
  selectedBusiness,
  sendableCount,
  templates,
}: {
  addedLeadIds: Set<string>;
  approach: string;
  businesses: ProspectBusiness[];
  dispatchStates: Record<string, ProspectingDispatchState>;
  existingLeadPhones: Set<string>;
  intervalSeconds: number;
  isLoading: boolean;
  isSendingCampaign: boolean;
  metrics: { total: number; hot: number; withoutSite: number; weakProfiles: number };
  onAddBusinessLead: (business: ProspectBusiness) => void;
  onClearSelection: () => void;
  onClose: () => void;
  onIgnoreSelected: () => void;
  onExportBusinesses: () => void;
  onIntervalChange: (value: number) => void;
  onSearch: (input: ProspectingSearchInput) => void;
  onSelectPhoneProspects: () => void;
  onSelectBusiness: (business: ProspectBusiness) => void;
  onStartCampaign: () => void;
  onTemplateChange: (templateId: string) => void;
  onToggleBusiness: (business: ProspectBusiness) => void;
  previewMessage: string;
  selectedBusinessIds: Set<string>;
  selectedTemplateId: string;
  selectedBusiness: ProspectBusiness | null;
  sendableCount: number;
  templates: MessageTemplate[];
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
              <h2 className="mt-2 text-3xl font-semibold text-white">Encontre empresas e inicie conversas</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Prospecção via SerpAPI Google Maps com seleção, mensagem pronta e campanha WhatsApp sem poluir o CRM.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                disabled={businesses.length === 0}
                onClick={onExportBusinesses}
                type="button"
              >
                <Download className="h-4 w-4" />
                Baixar lista
              </button>
              <button
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                onClick={onClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
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
                Configure SERPAPI_API_KEY na Vercel e busque por tipo de empresa/profissional e estado.
              </div>
            )}
            {!isLoading && businesses.length > 0 && (
              <BusinessTable
                addedLeadIds={addedLeadIds}
                businesses={businesses}
                dispatchStates={dispatchStates}
                existingLeadPhones={existingLeadPhones}
                onAddLead={onAddBusinessLead}
                onSelectBusiness={onSelectBusiness}
                onToggleBusiness={onToggleBusiness}
                selectedIds={selectedBusinessIds}
              />
            )}
          </div>
        </div>
      </section>
      <div className="min-h-0 space-y-5 overflow-y-auto">
        <CampaignPanel
          dispatchStates={dispatchStates}
          intervalSeconds={intervalSeconds}
          isRunning={isSendingCampaign}
          onClearSelection={onClearSelection}
          onIgnoreSelected={onIgnoreSelected}
          onIntervalChange={onIntervalChange}
          onSelectPhoneProspects={onSelectPhoneProspects}
          onStartCampaign={onStartCampaign}
          onTemplateChange={onTemplateChange}
          previewMessage={previewMessage}
          selectedCount={selectedBusinessIds.size}
          selectedTemplateId={selectedTemplateId}
          sendableCount={sendableCount}
          templates={templates}
        />
        <BusinessDetails approach={approach} business={selectedBusiness} />
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
