"use client";

import { Download, Flame, X } from "lucide-react";

import type { MessageTemplate } from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

import type { ProspectBusiness, ProspectingDispatchState, ProspectingSearchInput } from "../../../types";
import { BusinessCard, BusinessDetails, CampaignPanel, ProspectingSearchForm, ProspectingSkeleton } from "../components";

export function ProspectingMobile({
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
  onGenerateApproach,
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
  onGenerateApproach: (business: ProspectBusiness) => void;
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
    <div className="h-full overflow-y-auto p-4 xl:hidden">
      <section className="rounded-3xl border border-[#8B5CF6]/25 bg-[#111018]/85 p-4 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#A78BFA]">
              <Flame className="h-4 w-4" />
              Prospecção Inteligente
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Buscar empresas</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Google Maps, seleção e campanha WhatsApp em uma experiência única.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 disabled:opacity-50"
              disabled={businesses.length === 0}
              onClick={onExportBusinesses}
              type="button"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
        {isLoading && <ProspectingSkeleton />}
        {!isLoading && businesses.map((business) => {
          const normalizedPhone = normalizePhone(business.phone ?? "");
          const unavailable = !normalizedPhone || existingLeadPhones.has(normalizedPhone) || addedLeadIds.has(business.id);
          const dispatchStatus = dispatchStates[business.id]?.status;

          return (
            <div className="space-y-2" key={business.id}>
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300">
                <span>{dispatchStatus ? `Status: ${dispatchStatus}` : "Selecionar para campanha"}</span>
                <input
                  checked={selectedBusinessIds.has(business.id)}
                  className="h-4 w-4 rounded border-white/20 bg-black accent-[#8B5CF6]"
                  disabled={unavailable}
                  onChange={() => onToggleBusiness(business)}
                  type="checkbox"
                />
              </label>
              <BusinessCard
                business={business}
                isAdded={addedLeadIds.has(business.id)}
                onAddLead={() => onAddBusinessLead(business)}
                onGenerateApproach={() => onGenerateApproach(business)}
                onViewDetails={() => onSelectBusiness(business)}
              />
            </div>
          );
        })}
        <BusinessDetails approach={approach} business={selectedBusiness} />
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
