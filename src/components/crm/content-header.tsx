"use client";

import { Plus, Search } from "lucide-react";

import type { PipelineStage, SavedPipelineFilter } from "@/components/crm/pipeline-state";
import type { View } from "@/lib/navigation";
import { getViewSubtitle, viewTitles } from "@/lib/navigation";
import type { Lead, LeadStatus, Tag as CrmTag } from "@/lib/types";

export type CrmViewMode = "kanban" | "list";

export function CrmContentHeader({
  view,
  crmViewMode,
  query,
  statusFilter,
  temperatureFilter,
  dateFilter,
  tagFilter,
  tags,
  visiblePipelineStages,
  savedFilterPresets,
  canCreateLead,
  canUpdatePipeline,
  onCrmViewModeChange,
  onQueryChange,
  onStatusFilterChange,
  onTemperatureFilterChange,
  onDateFilterChange,
  onTagFilterChange,
  onApplyFilterPreset,
  onSaveFilterPreset,
  onOpenPipelineStages,
  onExportLeads,
  onCreateLead,
}: {
  view: View;
  crmViewMode: CrmViewMode;
  query: string;
  statusFilter: LeadStatus | "all";
  temperatureFilter: Lead["temperature"] | "all";
  dateFilter: "all" | "today" | "overdue";
  tagFilter: string | "all";
  tags: CrmTag[];
  visiblePipelineStages: PipelineStage[];
  savedFilterPresets: SavedPipelineFilter[];
  canCreateLead: boolean;
  canUpdatePipeline: boolean;
  onCrmViewModeChange: (mode: CrmViewMode) => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: LeadStatus | "all") => void;
  onTemperatureFilterChange: (value: Lead["temperature"] | "all") => void;
  onDateFilterChange: (value: "all" | "today" | "overdue") => void;
  onTagFilterChange: (value: string) => void;
  onApplyFilterPreset: (id: string) => void;
  onSaveFilterPreset: () => void;
  onOpenPipelineStages: () => void;
  onExportLeads: () => void;
  onCreateLead: () => void;
}) {
  const showLeadHeaderControls = view === "pipeline";

  return (
    <header className="crm-content-header relative flex flex-col gap-4 border-b border-white/10 bg-black/20 px-5 py-4 shadow-xl shadow-black/10 backdrop-blur-xl xl:flex-row xl:items-center xl:justify-between">
      <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.55),rgba(37,211,102,0.18),transparent)]" />
      <div>
        <h1 className="text-2xl font-semibold">{viewTitles[view]}</h1>
        <p className="mt-1 text-sm text-zinc-500">{getViewSubtitle(view)}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {showLeadHeaderControls && (
          <>
            <div className="grid h-11 shrink-0 grid-cols-2 rounded-lg border border-white/10 bg-white/[0.04] p-1">
              {[
                ["kanban", "Funil"],
                ["list", "Lista"],
              ].map(([mode, label]) => (
                <button
                  className={`rounded-md px-3 text-sm font-medium transition ${
                    crmViewMode === mode
                      ? "bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                  key={mode}
                  onClick={() => onCrmViewModeChange(mode as CrmViewMode)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6] sm:w-72"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Buscar lead"
                value={query}
              />
            </div>
            <select
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => onStatusFilterChange(event.target.value as LeadStatus | "all")}
              value={statusFilter}
            >
              <option value="all">Todas etapas</option>
              {visiblePipelineStages.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) =>
                onTemperatureFilterChange(event.target.value as Lead["temperature"] | "all")
              }
              value={temperatureFilter ?? "all"}
            >
              <option value="all">Temperatura</option>
              <option value="frio">Frio</option>
              <option value="morno">Morno</option>
              <option value="quente">Quente</option>
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => onDateFilterChange(event.target.value as "all" | "today" | "overdue")}
              value={dateFilter}
            >
              <option value="all">Todas datas</option>
              <option value="today">Criados hoje</option>
              <option value="overdue">Follow-up atrasado</option>
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => onTagFilterChange(event.target.value)}
              value={tagFilter}
            >
              <option value="all">Todas tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                onApplyFilterPreset(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Filtros salvos</option>
              {savedFilterPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button
              className="h-11 rounded-lg border border-[#8B5CF6]/30 px-4 text-sm text-[#DDD6FE] transition hover:bg-[#8B5CF6]/10"
              onClick={onSaveFilterPreset}
              type="button"
            >
              Salvar filtro
            </button>
            <button
              className="h-11 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canUpdatePipeline}
              onClick={onOpenPipelineStages}
              title={canUpdatePipeline ? "Editar funil" : "Sem permissão para alterar o funil"}
              type="button"
            >
              Editar funil
            </button>
            <button
              className="h-11 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
              onClick={onExportLeads}
              type="button"
            >
              Exportar CSV
            </button>
            <button
              className="shine-cta flex h-11 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium shadow-lg shadow-[#8B5CF6]/20 transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canCreateLead}
              onClick={onCreateLead}
              title={canCreateLead ? "Novo lead" : "Sem permissão para criar leads"}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Novo lead
            </button>
          </>
        )}
      </div>
    </header>
  );
}
