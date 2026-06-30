"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { PipelineStage } from "@/components/crm/pipeline-state";
import { Modal } from "@/components/crm/ui";
import type { Lead, LeadStatus } from "@/lib/types";

export function PipelineBulkActions({
  selectedCount,
  columns,
  bulkOwnerName,
  canDeleteLeads,
  canMoveLeads,
  onOwnerNameChange,
  onAssignOwner,
  onMove,
  onSchedule,
  onArchive,
  onClear,
}: {
  selectedCount: number;
  columns: PipelineStage[];
  bulkOwnerName: string;
  canDeleteLeads: boolean;
  canMoveLeads: boolean;
  onOwnerNameChange: (value: string) => void;
  onAssignOwner: () => void;
  onMove: (status: LeadStatus) => void;
  onSchedule: (days: number) => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  const disabled = selectedCount === 0;

  return (
    <section className="crm-pipeline-actions rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-100">{selectedCount}</span> selecionados
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <select
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6] disabled:opacity-50"
            defaultValue=""
            disabled={disabled || !canMoveLeads}
            onChange={(event) => {
              if (!event.target.value) return;
              onMove(event.target.value as LeadStatus);
              event.target.value = "";
            }}
          >
            <option value="">Mover etapa</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
          <button
            className="h-10 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-50"
            disabled={disabled}
            onClick={() => onSchedule(1)}
            type="button"
          >
            Follow-up amanhã
          </button>
          <div className="flex min-w-0 gap-2">
            <input
              className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6] disabled:opacity-50"
              disabled={disabled}
              onChange={(event) => onOwnerNameChange(event.target.value)}
              placeholder="Responsável"
              value={bulkOwnerName}
            />
            <button
              className="h-10 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-50"
              disabled={disabled || !bulkOwnerName.trim()}
              onClick={onAssignOwner}
              type="button"
            >
              Atribuir
            </button>
          </div>
          <button
            className="h-10 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            disabled={disabled || !canDeleteLeads}
            onClick={onArchive}
            title={canDeleteLeads ? "Excluir selecionados" : "Sem permissão para excluir leads"}
            type="button"
          >
            Excluir
          </button>
          <button
            className="h-10 rounded-lg border border-white/10 px-3 text-sm text-zinc-500 transition hover:bg-white/[0.06] disabled:opacity-50"
            disabled={disabled}
            onClick={onClear}
            type="button"
          >
            Limpar
          </button>
        </div>
      </div>
    </section>
  );
}

export function PipelineStagesModal({
  stages,
  leads,
  onClose,
  onAddStage,
  onMoveStage,
  onRenameStage,
  onRemoveStage,
  onUpdateStageKind,
}: {
  stages: PipelineStage[];
  leads: Lead[];
  onClose: () => void;
  onAddStage: (title: string) => void;
  onMoveStage: (id: LeadStatus, direction: -1 | 1) => void;
  onRenameStage: (id: LeadStatus, title: string) => void;
  onRemoveStage: (id: LeadStatus) => void;
  onUpdateStageKind: (id: LeadStatus, kind: NonNullable<PipelineStage["kind"]>) => void;
}) {
  const [newStageTitle, setNewStageTitle] = useState("");

  function leadCount(stageId: LeadStatus) {
    return leads.filter((lead) => lead.status === stageId).length;
  }

  return (
    <Modal onClose={onClose} title="Editar funil">
      <div className="space-y-4">
        <div className="space-y-3">
          {stages.map((stage) => {
            const count = leadCount(stage.id);
            const canRemove = count === 0 && stages.length > 1;
            const stageIndex = stages.findIndex((item) => item.id === stage.id);

            return (
              <div
                className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 lg:grid-cols-[auto_minmax(0,1fr)_132px_64px_44px] lg:items-center"
                key={stage.id}
              >
                <div className="flex gap-2">
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40"
                    disabled={stageIndex === 0}
                    onClick={() => onMoveStage(stage.id, -1)}
                    title="Subir etapa"
                    type="button"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40"
                    disabled={stageIndex === stages.length - 1}
                    onClick={() => onMoveStage(stage.id, 1)}
                    title="Descer etapa"
                    type="button"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => onRenameStage(stage.id, event.target.value)}
                  value={stage.title}
                />
                <select
                  className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => onUpdateStageKind(stage.id, event.target.value as NonNullable<PipelineStage["kind"]>)}
                  value={stage.kind ?? "open"}
                >
                  <option value="open">Em aberto</option>
                  <option value="closed">Conclusão</option>
                </select>
                <span className="flex h-10 w-16 items-center justify-center rounded-full border border-white/10 text-center text-xs leading-tight text-zinc-500">
                  {count}
                  <br />
                  leads
                </span>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                  disabled={!canRemove}
                  onClick={() => onRemoveStage(stage.id)}
                  title="Remover etapa"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remover</span>
                </button>
              </div>
            );
          })}
        </div>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onAddStage(newStageTitle);
            setNewStageTitle("");
          }}
        >
          <input
            className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
            onChange={(event) => setNewStageTitle(event.target.value)}
            placeholder="Nome da nova etapa"
            value={newStageTitle}
          />
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium transition hover:bg-[#7C3AED]"
            type="submit"
          >
            <Plus className="h-4 w-4" />
            Adicionar etapa
          </button>
        </form>
      </div>
    </Modal>
  );
}
