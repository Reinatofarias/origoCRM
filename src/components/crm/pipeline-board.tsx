"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock3, Edit3, ExternalLink, MessageCircle, Trash2, UserRound } from "lucide-react";
import type { MouseEvent } from "react";
import { useMemo } from "react";

import { PipelineBulkActions } from "@/components/crm/pipeline-controls";
import { PipelineOverview } from "@/components/crm/pipeline-overview";
import { getDefaultPipelineStages, type PipelineStage } from "@/components/crm/pipeline-state";
import {
  formatCurrency,
  formatPhoneCompact,
  getColumnHealth,
  getFollowupLabel,
  getLastContactLabel,
  getLeadInitials,
  getPipelineColumnStats,
  getSlaLabel,
  getSourceLabel,
  getTemperatureLabel,
  isLeadClosed,
  sortPipelineLeadsByUrgency,
} from "@/components/crm/lead-helpers";
import { calculateLeadScore } from "@/lib/lead-scoring";
import type { Lead, LeadStatus, Tag as CrmTag } from "@/lib/types";
const pipelineMeta: Record<string, { accent: string; description: string; empty: string }> = {
  novo: {
    accent: "bg-sky-400",
    description: "Entradas recentes para qualificar",
    empty: "Nenhum lead novo",
  },
  contatado: {
    accent: "bg-[#8B5CF6]",
    description: "Contato iniciado e aguardando retorno",
    empty: "Nenhum contato em andamento",
  },
  respondeu: {
    accent: "bg-[#25D366]",
    description: "Leads que já responderam",
    empty: "Nenhuma resposta registrada",
  },
  proposta: {
    accent: "bg-amber-400",
    description: "Negociações com proposta enviada",
    empty: "Nenhuma proposta ativa",
  },
  fechado: {
    accent: "bg-zinc-300",
    description: "Oportunidades concluídas",
    empty: "Nenhum lead fechado",
  },
};

function getPipelineMeta(id: LeadStatus, title: string) {
  return pipelineMeta[id] ?? {
    accent: "bg-zinc-400",
    description: "Etapa personalizada",
    empty: `Nenhum lead em ${title.toLowerCase()}`,
  };
}

export function Pipeline({
  leads,
  leadTags,
  dispatchCountsByLeadId,
  columns,
  recentLeadId,
  selectedLeadIds,
  bulkOwnerName,
  canDeleteLeads,
  canMoveLeads,
  onLeadClick,
  onLeadDelete,
  onStatusChange,
  onToggleLeadSelection,
  onClearSelection,
  onBulkMove,
  onBulkSchedule,
  onBulkArchive,
  onBulkOwnerNameChange,
  onBulkAssignOwner,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  leads: Lead[];
  leadTags: Map<string, CrmTag[]>;
  dispatchCountsByLeadId: Map<string, number>;
  columns: PipelineStage[];
  recentLeadId: string | null;
  selectedLeadIds: Set<string>;
  bulkOwnerName: string;
  canDeleteLeads: boolean;
  canMoveLeads: boolean;
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (lead: Lead) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onToggleLeadSelection: (id: string) => void;
  onClearSelection: () => void;
  onBulkMove: (status: LeadStatus) => void;
  onBulkSchedule: (days: number) => void;
  onBulkArchive: () => void;
  onBulkOwnerNameChange: (value: string) => void;
  onBulkAssignOwner: () => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
}) {
  const closedStageIds = useMemo(
    () => new Set(columns.filter((column) => column.kind === "closed").map((column) => column.id)),
    [columns],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeLead = leads.find((lead) => lead.id === active.id);
    if (!activeLead) return;

    const overId = String(over.id);
    const column = columns.find((item) => item.id === overId);
    const overLead = leads.find((lead) => lead.id === overId);
    const nextStatus = (column?.id ?? overLead?.status) as LeadStatus | undefined;

    if (nextStatus && nextStatus !== activeLead.status) onStatusChange(activeLead.id, nextStatus);
  }

  const selectedCount = leads.filter((lead) => selectedLeadIds.has(lead.id)).length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <PipelineOverview closedStageIds={closedStageIds} leads={leads} />
        <PipelineBulkActions
          bulkOwnerName={bulkOwnerName}
          canDeleteLeads={canDeleteLeads}
          canMoveLeads={canMoveLeads}
          columns={columns}
          onArchive={onBulkArchive}
          onAssignOwner={onBulkAssignOwner}
          onClear={onClearSelection}
          onMove={onBulkMove}
          onOwnerNameChange={onBulkOwnerNameChange}
          onSchedule={onBulkSchedule}
          selectedCount={selectedCount}
        />
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnLeads = sortPipelineLeadsByUrgency(
              leads.filter((lead) => lead.status === column.id),
              closedStageIds,
            );
            return (
              <PipelineColumn
                key={column.id}
                id={column.id}
                dispatchCountsByLeadId={dispatchCountsByLeadId}
                leads={columnLeads}
                leadTags={leadTags}
                onLeadClick={onLeadClick}
                onLeadDelete={onLeadDelete}
                onQuickSchedule={onQuickSchedule}
                onQuickWhatsApp={onQuickWhatsApp}
                columns={columns}
                closedStageIds={closedStageIds}
                onStatusChange={onStatusChange}
                onToggleLeadSelection={onToggleLeadSelection}
                recentLeadId={recentLeadId}
                selectedLeadIds={selectedLeadIds}
                title={column.title}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

function PipelineColumn({
  id,
  title,
  leads,
  dispatchCountsByLeadId,
  leadTags,
  columns,
  closedStageIds,
  recentLeadId,
  selectedLeadIds,
  onLeadClick,
  onLeadDelete,
  onQuickWhatsApp,
  onQuickSchedule,
  onStatusChange,
  onToggleLeadSelection,
}: {
  id: LeadStatus;
  title: string;
  leads: Lead[];
  dispatchCountsByLeadId: Map<string, number>;
  leadTags: Map<string, CrmTag[]>;
  columns: PipelineStage[];
  closedStageIds: Set<LeadStatus>;
  recentLeadId: string | null;
  selectedLeadIds: Set<string>;
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (lead: Lead) => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onToggleLeadSelection: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const meta = getPipelineMeta(id, title);
  const stats = getPipelineColumnStats(leads, closedStageIds);
  const riskCount = stats.overdue + stats.noAction;
  const dispatchCount = leads.reduce((total, lead) => total + (dispatchCountsByLeadId.get(lead.id) ?? 0), 0);

  return (
    <div
      className={`crm-pipeline-column w-[300px] shrink-0 overflow-hidden rounded-xl border transition ${
        isOver ? "border-[#8B5CF6] bg-[#8B5CF6]/10" : "border-white/10 bg-white/[0.025]"
      }`}
      ref={setNodeRef}
    >
      <div className="border-b border-white/10 px-3 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${meta.accent}`} />
            <h2 className="truncate text-sm font-semibold text-zinc-100">{title}</h2>
          </div>
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-xs text-zinc-300">
            {leads.length}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span className="truncate">{meta.description}</span>
          <span className="shrink-0">{getColumnHealth(leads, closedStageIds)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-zinc-300">
            {formatCurrency(stats.value) ?? "R$ 0"}
          </span>
          <span
            className={`rounded-full border px-2 py-1 ${
              riskCount > 0
                ? "border-red-400/25 bg-red-500/10 text-red-200"
                : "border-white/10 bg-black/25 text-zinc-500"
            }`}
          >
            {riskCount > 0 ? `${riskCount} riscos` : "Sem risco"}
          </span>
          {stats.overdue > 0 && (
            <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2 py-1 text-red-200">
              {stats.overdue} vencidos
            </span>
          )}
          {stats.hot > 0 && (
            <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-amber-100">
              {stats.hot} quentes
            </span>
          )}
          <span className="rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-2 py-1 text-[#9AF0B8]">
            {dispatchCount} disparos
          </span>
        </div>
      </div>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[320px] space-y-3 p-3">
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              highlighted={recentLeadId === lead.id}
              lead={lead}
              dispatchCount={dispatchCountsByLeadId.get(lead.id) ?? 0}
              leadTags={leadTags.get(lead.id) ?? []}
              onClick={() => onLeadClick(lead)}
              onDelete={() => onLeadDelete(lead)}
              onQuickSchedule={() => onQuickSchedule(lead)}
              onQuickWhatsApp={() => onQuickWhatsApp(lead)}
              columns={columns}
              closedStageIds={closedStageIds}
              onStatusChange={(status) => onStatusChange(lead.id, status)}
              onToggleSelection={() => onToggleLeadSelection(lead.id)}
              selected={selectedLeadIds.has(lead.id)}
            />
          ))}
          {leads.length === 0 && (
            <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-white/10 bg-black/10 p-4 text-center text-sm text-zinc-500">
              {meta.empty}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableLeadCard({
  lead,
  dispatchCount,
  leadTags,
  columns,
  closedStageIds,
  highlighted,
  selected,
  onClick,
  onDelete,
  onQuickWhatsApp,
  onQuickSchedule,
  onStatusChange,
  onToggleSelection,
}: {
  lead: Lead;
  dispatchCount: number;
  leadTags: CrmTag[];
  columns: PipelineStage[];
  closedStageIds: Set<LeadStatus>;
  highlighted: boolean;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onQuickWhatsApp: () => void;
  onQuickSchedule: () => void;
  onStatusChange: (status: LeadStatus) => void;
  onToggleSelection: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <LeadCard
        dragging={isDragging}
        columns={columns}
        closedStageIds={closedStageIds}
        highlighted={highlighted}
        lead={lead}
        dispatchCount={dispatchCount}
        leadTags={leadTags}
        onClick={onClick}
        onDelete={onDelete}
        onQuickSchedule={onQuickSchedule}
        onQuickWhatsApp={onQuickWhatsApp}
        onStatusChange={onStatusChange}
        onToggleSelection={onToggleSelection}
        selected={selected}
        showQuickActions
      />
    </div>
  );
}

function LeadCard({
  lead,
  dispatchCount = 0,
  leadTags = [],
  columns,
  closedStageIds,
  onClick,
  onDelete,
  selected = false,
  dragging = false,
  highlighted = false,
  showQuickActions = false,
  onStatusChange,
  onToggleSelection,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  dispatchCount: number;
  leadTags: CrmTag[];
  columns: PipelineStage[];
  closedStageIds: Set<LeadStatus>;
  onClick: () => void;
  onDelete: () => void;
  selected: boolean;
  dragging: boolean;
  highlighted: boolean;
  showQuickActions: boolean;
  onStatusChange: (status: LeadStatus) => void;
  onToggleSelection: () => void;
  onQuickWhatsApp: () => void;
  onQuickSchedule: () => void;
}) {
  const temperature = getTemperatureLabel(lead.temperature);
  const value = formatCurrency(lead.estimated_value);
  const sla = getSlaLabel(lead, closedStageIds);
  const followup = getFollowupLabel(lead, closedStageIds);
  const isOverdue = followup.text === "Follow-up atrasado";
  const isClosed = isLeadClosed(lead, closedStageIds);
  const leadScore = calculateLeadScore(lead);

  function quick(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  return (
    <div
      className={`crm-lead-card group relative w-full rounded-xl border bg-[#121119] p-3 text-left shadow-lg shadow-black/10 transition hover:border-[#8B5CF6]/60 ${
        highlighted
          ? "border-[#8B5CF6] shadow-[#8B5CF6]/30"
          : isOverdue
            ? "border-red-400/35"
            : "border-white/10"
      } ${dragging ? "opacity-60" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-xl bg-white/10">
        <div
          className={`h-full rounded-t-xl ${
            isClosed
              ? "bg-zinc-400"
              : isOverdue
                ? "bg-red-400"
                : (lead.temperature ?? "morno") === "quente"
                  ? "bg-amber-300"
                  : "bg-[#8B5CF6]"
          }`}
        />
      </div>
      <div className="flex items-start gap-3 pt-1">
        {onToggleSelection && (
          <input
            aria-label={`Selecionar ${lead.name}`}
            checked={selected}
            className="mt-2.5 h-4 w-4 shrink-0 accent-[#8B5CF6]"
            onChange={onToggleSelection}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            type="checkbox"
          />
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-200">
          {getLeadInitials(lead) || <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">{lead.name}</div>
          <div className="mt-1 truncate text-xs text-zinc-500">
            {lead.company || "Sem empresa"} / {lead.owner_name || "Sem responsável"}
          </div>
        </div>
      </div>

      {onStatusChange && (
        <div
          className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="shrink-0 text-[10px] uppercase text-zinc-500">Etapa</span>
          <select
            aria-label={`Alterar etapa de ${lead.name}`}
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-300 outline-none"
            onChange={(event) => onStatusChange(event.target.value as LeadStatus)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            value={lead.status}
          >
            {(columns ?? getDefaultPipelineStages()).map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-1 text-[11px] ${leadScore.tone}`}>
          Score {leadScore.score}
        </span>
        <span className={`rounded-full border px-2 py-1 text-[11px] ${temperature.tone}`}>
          {temperature.text}
        </span>
        {value && (
          <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-1 text-[11px] text-[#9AF0B8]">
            {value}
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400">
          {getSourceLabel(lead.source)}
        </span>
        {leadTags.slice(0, 3).map((tag) => (
          <span
            className="rounded-full border px-2 py-1 text-[11px]"
            key={tag.id}
            style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}18`, color: tag.color }}
          >
            {tag.name}
          </span>
        ))}
        {leadTags.length > 3 && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-500">
            +{leadTags.length - 3}
          </span>
        )}
        <span className="rounded-full border border-[#25D366]/20 bg-[#25D366]/10 px-2 py-1 text-[11px] text-[#9AF0B8]">
          {dispatchCount} disparo{dispatchCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 grid gap-1.5 text-xs">
        <div className={`flex items-center justify-between gap-3 ${followup.tone}`}>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {followup.text}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-zinc-500">
          <span>{formatPhoneCompact(lead.phone)}</span>
          {sla && <span className={sla.tone}>{sla.text}</span>}
        </div>
        <div className="text-zinc-500">{getLastContactLabel(lead)}</div>
      </div>
      {showQuickActions && (
        <div className="mt-4 grid grid-cols-4 gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button
            className="flex h-8 items-center justify-center rounded-md bg-[#25D366] text-black"
            onClick={(event) => quick(event, onQuickWhatsApp)}
            title="WhatsApp"
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-zinc-200"
            onClick={(event) => quick(event, onClick)}
            title="Abrir lead"
            type="button"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-zinc-200"
            onClick={(event) => quick(event, onQuickSchedule)}
            title="Agendar follow-up"
            type="button"
          >
            <Clock3 className="h-4 w-4" />
          </button>
          {onDelete && (
            <button
              className="flex h-8 items-center justify-center rounded-md border border-red-400/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
              onClick={(event) => quick(event, onDelete)}
              title="Excluir lead"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadList({
  leads,
  leadTags,
  onOpen,
  onEdit,
  onDelete,
}: {
  leads: Lead[];
  leadTags: Map<string, CrmTag[]>;
  onOpen: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {leads.map((lead) => (
        <div
          className="grid gap-3 border-b border-white/10 bg-white/[0.025] p-4 last:border-b-0 md:grid-cols-[1fr_1fr_140px_96px_44px]"
          key={lead.id}
        >
          <button className="text-left" onClick={() => onOpen(lead)}>
            <div className="font-medium">{lead.name}</div>
            <div className="text-sm text-zinc-500">{lead.phone}</div>
          </button>
          <div>
            <div className="text-sm text-zinc-300">{lead.company || "Sem empresa"}</div>
            <div className="text-sm text-zinc-500">{lead.source || "Sem origem"}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(leadTags.get(lead.id) ?? []).slice(0, 4).map((tag) => (
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px]"
                  key={tag.id}
                  style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}18`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
          <div className="text-sm capitalize text-zinc-400">{lead.status}</div>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={() => onEdit(lead)}
          >
            <Edit3 className="h-4 w-4" />
            Editar
          </button>
          <button
            className="flex h-10 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
            onClick={() => onDelete(lead)}
            title="Excluir lead"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}


