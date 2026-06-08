import type { Lead, LeadStatus } from "@/lib/types";

export type LeadScore = {
  action: string;
  label: "Baixo" | "Médio" | "Alto" | "Crítico";
  reasons: string[];
  score: number;
  tone: string;
};

const defaultClosedStageIds = new Set<LeadStatus>(["fechado"]);

export function calculateLeadScore(
  lead: Lead,
  closedStageIds: Set<LeadStatus> = defaultClosedStageIds,
): LeadScore {
  if (typeof lead.lead_score === "number" && lead.lead_score >= 0) {
    const score = clampScore(lead.lead_score);
    const persistedReasons = Array.isArray(lead.lead_score_reasons)
      ? lead.lead_score_reasons.filter(Boolean)
      : [];
    return buildLeadScoreResult(
      score,
      persistedReasons.length > 0 ? persistedReasons : ["Score salvo no CRM"],
      lead,
    );
  }

  const reasons: string[] = [];
  let score = 42;
  const temperature = lead.temperature ?? "morno";
  const hasNextAction = Boolean(lead.next_followup_at);
  const status = String(lead.status || "").toLowerCase();

  if (temperature === "quente") {
    score += 18;
    reasons.push("Temperatura quente");
  } else if (temperature === "morno") {
    score += 8;
    reasons.push("Temperatura morna");
  } else {
    score -= 8;
    reasons.push("Temperatura fria");
  }

  if ((lead.estimated_value ?? 0) > 0) {
    score += 12;
    reasons.push("Valor estimado informado");
  }

  if (lead.phone.trim()) {
    score += 8;
    reasons.push("Telefone disponível");
  }

  if (lead.company.trim()) {
    score += 6;
    reasons.push("Empresa identificada");
  }

  if (/whatsapp|prospec|google|maps/i.test(lead.source ?? "")) {
    score += 6;
    reasons.push("Origem comercial rastreável");
  }

  if (status.includes("respondeu") || status.includes("proposta") || status.includes("reuni")) {
    score += 12;
    reasons.push("Avançou no funil");
  }

  if (hasNextAction) {
    score += 8;
    reasons.push("Próxima ação definida");
  } else if (!isLeadClosed(lead, closedStageIds) && status !== "novo") {
    score -= 12;
    reasons.push("Sem próxima ação");
  }

  if (isFollowupOverdue(lead, closedStageIds)) {
    score += 6;
    reasons.push("Follow-up vencido exige prioridade");
  }

  if (!lead.owner_name?.trim()) {
    score -= 6;
    reasons.push("Sem responsável definido");
  }

  return buildLeadScoreResult(score, reasons, lead);
}

function buildLeadScoreResult(rawScore: number, reasons: string[], lead: Lead): LeadScore {
  const score = clampScore(rawScore);
  const hasCriticalRisk = !lead.next_followup_at && (lead.temperature ?? "morno") === "quente";

  if (score >= 82 || hasCriticalRisk) {
    return {
      action: hasCriticalRisk ? "Definir próxima ação agora" : "Priorizar contato comercial",
      label: "Crítico",
      reasons: reasons.slice(0, 4),
      score,
      tone: "border-red-400/35 bg-red-500/10 text-red-200",
    };
  }

  if (score >= 68) {
    return {
      action: "Manter cadência ativa",
      label: "Alto",
      reasons: reasons.slice(0, 4),
      score,
      tone: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (score >= 45) {
    return {
      action: "Qualificar antes de avançar",
      label: "Médio",
      reasons: reasons.slice(0, 4),
      score,
      tone: "border-amber-400/35 bg-amber-500/10 text-amber-100",
    };
  }

  return {
    action: "Revisar dados ou nutrir",
    label: "Baixo",
    reasons: reasons.slice(0, 4),
    score,
    tone: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  };
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isLeadClosed(lead: Lead, closedStageIds: Set<LeadStatus>) {
  return closedStageIds.has(lead.status);
}

function isFollowupOverdue(lead: Lead, closedStageIds: Set<LeadStatus>) {
  if (!lead.next_followup_at || isLeadClosed(lead, closedStageIds)) return false;
  return new Date(lead.next_followup_at).getTime() < startOfDay(new Date()).getTime();
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
