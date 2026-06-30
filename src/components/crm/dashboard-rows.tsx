"use client";

import { CheckCheck } from "lucide-react";

import {
  getDueAtLabel,
  getTaskRepeat,
  stripTaskMetadata,
  taskRepeatLabel,
  taskTypeLabel,
} from "@/components/crm/lead-helpers";
import type { Lead, Task } from "@/lib/types";

export function DashboardLeadRow({
  lead,
  dueAt,
  title,
  onCompleteTask,
  onOpen,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  dueAt: string;
  title: string;
  onCompleteTask?: () => void;
  onOpen: () => void;
  onQuickWhatsApp: () => void;
  onQuickSchedule: () => void;
}) {
  const followup = getDueAtLabel(dueAt);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button className="min-w-0 text-left" onClick={onOpen} type="button">
          <div className="font-medium text-white">{lead.name}</div>
          <div className="mt-1 text-sm text-zinc-500">{lead.company || "Sem empresa"}</div>
          <div className="mt-2 text-sm text-zinc-300">{title}</div>
          <div className={`mt-2 text-xs ${followup.tone}`}>{followup.text}</div>
        </button>
        <div className="flex flex-wrap gap-2">
          {onCompleteTask && (
            <button
              className="flex h-9 items-center gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
              onClick={onCompleteTask}
              type="button"
            >
              <CheckCheck className="h-4 w-4" />
              Concluir
            </button>
          )}
          <button
            className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onOpen}
            type="button"
          >
            Abrir
          </button>
          <button
            className="h-9 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
            onClick={onQuickWhatsApp}
            type="button"
          >
            WhatsApp
          </button>
          <button
            className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
            onClick={onQuickSchedule}
            type="button"
          >
            Reagendar
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardOperationalTaskRow({
  task,
  dueAt,
  title,
  onCompleteTask,
}: {
  task: Task | null;
  dueAt: string;
  title: string;
  onCompleteTask?: () => void;
}) {
  const due = getDueAtLabel(dueAt);
  const repeat = task ? getTaskRepeat(task) : "none";
  const visibleNotes = task ? stripTaskMetadata(task.notes) : "";

  return (
    <div className="rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/[0.06] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2 py-0.5 text-[11px] text-[#DDD6FE]">
              Operacional
            </span>
            {task && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                {taskTypeLabel(task.type)}
              </span>
            )}
            {repeat !== "none" && (
              <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                Repete {taskRepeatLabel(repeat).toLowerCase()}
              </span>
            )}
          </div>
          <div className="mt-2 font-medium text-white">{title}</div>
          <div className={`mt-2 text-xs ${due.tone}`}>{due.text}</div>
          {visibleNotes && <div className="mt-2 line-clamp-2 text-xs text-zinc-500">{visibleNotes}</div>}
        </div>
        {onCompleteTask && (
          <button
            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
            onClick={onCompleteTask}
            type="button"
          >
            <CheckCheck className="h-4 w-4" />
            Concluir
          </button>
        )}
      </div>
    </div>
  );
}

export function DashboardRiskLeadRow({
  lead,
  reason,
  onOpen,
  onQuickSchedule,
}: {
  lead: Lead;
  reason: string;
  onOpen: () => void;
  onQuickSchedule: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button className="min-w-0 text-left" onClick={onOpen} type="button">
          <div className="truncate text-sm font-medium text-zinc-100">{lead.name}</div>
          <div className="mt-1 truncate text-xs text-zinc-500">{reason} - {lead.company || "Sem empresa"}</div>
        </button>
        <div className="flex gap-2">
          <button
            className="h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onOpen}
            type="button"
          >
            Abrir
          </button>
          <button
            className="h-8 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
            onClick={onQuickSchedule}
            type="button"
          >
            Reagendar
          </button>
        </div>
      </div>
    </div>
  );
}
