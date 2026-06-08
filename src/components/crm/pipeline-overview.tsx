"use client";

import { formatCurrency, isFollowupDue, isLeadClosed } from "@/components/crm/lead-helpers";
import type { Lead, LeadStatus } from "@/lib/types";

export function PipelineOverview({ leads, closedStageIds }: { leads: Lead[]; closedStageIds: Set<LeadStatus> }) {
  const pendingFollowups = leads.filter((lead) => isFollowupDue(lead, closedStageIds)).length;
  const activeDeals = leads.filter((lead) => !isLeadClosed(lead, closedStageIds)).length;
  const replied = leads.filter((lead) => lead.status === "respondeu").length;
  const closed = leads.filter((lead) => isLeadClosed(lead, closedStageIds)).length;
  const closeRate = leads.length ? Math.round((closed / leads.length) * 100) : 0;
  const openValue = leads
    .filter((lead) => !isLeadClosed(lead, closedStageIds))
    .reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);

  return (
    <div className="grid gap-3 md:grid-cols-5">
      <PipelineStat label="Leads ativos" value={activeDeals.toString()} tone="border-[#8B5CF6]/30" />
      <PipelineStat label="Follow-up hoje" value={pendingFollowups.toString()} tone="border-amber-400/30" />
      <PipelineStat label="Responderam" value={replied.toString()} tone="border-[#25D366]/30" />
      <PipelineStat label="Taxa de fechamento" value={`${closeRate}%`} tone="border-white/10" />
      <PipelineStat label="Valor aberto" value={formatCurrency(openValue) ?? "R$ 0"} tone="border-[#25D366]/30" />
    </div>
  );
}

function PipelineStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`crm-pipeline-metric rounded-xl border ${tone} bg-white/[0.035] p-4`}>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
