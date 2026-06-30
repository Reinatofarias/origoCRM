"use client";

import { formatCurrency } from "@/components/crm/lead-helpers";
import { DashboardEmpty, DashboardMiniLegend } from "@/components/crm/dashboard-widgets";
import type { LeadScore } from "@/lib/lead-scoring";
import type { Lead, LeadStatus } from "@/lib/types";

export type DashboardActivityDay = {
  key: string;
  label: string;
  created: number;
  replies: number;
  contacts: number;
};

type DashboardStageStat = {
  id: LeadStatus;
  title: string;
  count: number;
  value: number;
  hot: number;
};

export function DashboardTaskChart({
  stats,
  total,
}: {
  stats: { open: number; completed: number; overdue: number; commercial: number; operational: number };
  total: number;
}) {
  const active = Math.max(0, stats.open - stats.overdue);
  const segments = [
    { label: "Em execução", value: active, tone: "bg-[#8B5CF6]" },
    { label: "Atrasadas", value: stats.overdue, tone: "bg-red-400" },
    { label: "Concluídas", value: stats.completed, tone: "bg-[#25D366]" },
  ];
  const safeTotal = Math.max(1, total);
  const typeTotal = Math.max(1, stats.commercial + stats.operational);

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">Execução de tarefas</div>
          <div className="mt-1 text-xs text-zinc-500">Status atual e origem da demanda.</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>{stats.commercial} comerciais</div>
          <div>{stats.operational} operacionais</div>
        </div>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
        {segments.map((segment) => (
          <div
            className={segment.tone}
            key={segment.label}
            style={{ width: `${segment.value === 0 ? 0 : Math.max(4, (segment.value / safeTotal) * 100)}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <DashboardMiniLegend key={segment.label} label={segment.label} tone={segment.tone} value={segment.value} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[#25D366]/20 bg-[#25D366]/10 p-3">
          <div className="text-xs text-[#9AF0B8]">Comerciais</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
            <div className="h-full bg-[#25D366]" style={{ width: `${(stats.commercial / typeTotal) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-3">
          <div className="text-xs text-[#DDD6FE]">Operacionais</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
            <div className="h-full bg-[#8B5CF6]" style={{ width: `${(stats.operational / typeTotal) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardStageChart({
  stages,
  maxCount,
}: {
  stages: DashboardStageStat[];
  maxCount: number;
}) {
  const safeMax = Math.max(1, maxCount);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-zinc-100">Leads por etapa</div>
          <div className="mt-1 text-xs text-zinc-500">Volume, valor aberto e temperatura.</div>
        </div>
      </div>
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {stages.map((stage) => (
          <div key={stage.id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-zinc-300">{stage.title}</span>
              <span className="shrink-0 text-zinc-500">
                {stage.count} - {formatCurrency(stage.value) ?? "R$ 0"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#8B5CF6]"
                style={{ width: `${Math.max(stage.count ? 8 : 0, (stage.count / safeMax) * 100)}%` }}
              />
            </div>
            {stage.hot > 0 && <div className="mt-1 text-[11px] text-amber-200">{stage.hot} quente(s)</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardActivityChart({
  days,
  maxTotal,
}: {
  days: DashboardActivityDay[];
  maxTotal: number;
}) {
  const safeMax = Math.max(1, maxTotal);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-medium text-zinc-100">Atividade dos últimos 7 dias</div>
      <div className="mt-1 text-xs text-zinc-500">Leads criados, respostas e contatos feitos.</div>
      <div className="mt-5 grid h-36 grid-cols-7 items-end gap-2">
        {days.map((day) => {
          const total = day.created + day.replies + day.contacts;

          return (
            <div className="flex h-full flex-col items-center justify-end gap-2" key={day.key}>
              <div className="flex h-28 items-end gap-0.5">
                <div
                  className="w-2 rounded-t bg-sky-400"
                  style={{ height: `${day.created ? Math.max(6, (day.created / safeMax) * 112) : 2}px` }}
                  title={`Leads criados: ${day.created}`}
                />
                <div
                  className="w-2 rounded-t bg-[#25D366]"
                  style={{ height: `${day.replies ? Math.max(6, (day.replies / safeMax) * 112) : 2}px` }}
                  title={`Respostas: ${day.replies}`}
                />
                <div
                  className="w-2 rounded-t bg-[#8B5CF6]"
                  style={{ height: `${day.contacts ? Math.max(6, (day.contacts / safeMax) * 112) : 2}px` }}
                  title={`Contatos: ${day.contacts}`}
                />
              </div>
              <div className="text-[11px] text-zinc-500">{day.label}</div>
              <span className="sr-only">{total} atividades</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
        <DashboardMiniLegend label="Leads" tone="bg-sky-400" value={days.reduce((total, day) => total + day.created, 0)} />
        <DashboardMiniLegend label="Respostas" tone="bg-[#25D366]" value={days.reduce((total, day) => total + day.replies, 0)} />
        <DashboardMiniLegend label="Contatos" tone="bg-[#8B5CF6]" value={days.reduce((total, day) => total + day.contacts, 0)} />
      </div>
    </div>
  );
}

export function DashboardScoreChart({
  stats,
  total,
  scorePriorityLeads,
  onOpen,
}: {
  stats: Array<{ label: string; value: number; tone: string }>;
  total: number;
  scorePriorityLeads: Array<{ lead: Lead; score: LeadScore }>;
  onOpen: (lead: Lead) => void;
}) {
  const safeTotal = Math.max(1, total);

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-100">Lead scoring</div>
          <div className="mt-1 text-xs text-zinc-500">Prioridade comercial calculada pela qualidade e urgência dos leads.</div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">
          {total} lead{total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
        {stats.map((item) => (
          <div
            className={item.tone}
            key={item.label}
            style={{ width: `${item.value === 0 ? 0 : Math.max(3, (item.value / safeTotal) * 100)}%` }}
            title={`${item.label}: ${item.value}`}
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {stats.map((item) => (
          <DashboardMiniLegend key={item.label} label={item.label} tone={item.tone} value={item.value} />
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {scorePriorityLeads.length === 0 && <DashboardEmpty text="Nenhum lead ativo para pontuar neste filtro." />}
        {scorePriorityLeads.map(({ lead, score }) => (
          <button
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left transition hover:border-[#8B5CF6]/40 hover:bg-white/[0.06]"
            key={lead.id}
            onClick={() => onOpen(lead)}
            type="button"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-100">{lead.name}</div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">{score.action}</div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${score.tone}`}>
              {score.score}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardFunnelChart({
  stages,
  maxCount,
}: {
  stages: DashboardStageStat[];
  maxCount: number;
}) {
  const safeMax = Math.max(1, maxCount);

  return (
    <div className="mt-4 space-y-3">
      {stages.map((stage, index) => (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3" key={stage.id}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-zinc-400">
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium text-zinc-100">{stage.title}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-100">{stage.count}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#25D366]"
              style={{ width: `${Math.max(stage.count ? 10 : 0, (stage.count / safeMax) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {stages.length === 0 && <DashboardEmpty text="Nenhuma etapa configurada." />}
    </div>
  );
}
