import { pipelineColumns as defaultPipelineColumns } from "@/lib/constants";
import type { Lead, LeadInput, LeadStatus, LeadTag, Tag as CrmTag } from "@/lib/types";

export type SavedPipelineFilter = {
  id: string;
  name: string;
  filters: {
    query: string;
    statusFilter: LeadStatus | "all";
    temperatureFilter: Lead["temperature"] | "all";
    dateFilter: "all" | "today" | "overdue";
    tagFilter: string | "all";
  };
};

export type PipelineStage = {
  id: LeadStatus;
  title: string;
  kind: "open" | "closed";
};

export const defaultClosedStageIds = new Set<LeadStatus>(["fechado"]);

const defaultPipelineStageIds = new Set<LeadStatus>(defaultPipelineColumns.map((column) => column.id));
const canonicalStageAliases: Record<string, LeadStatus> = {
  novo_lead: "novo",
  novos_leads: "novo",
  primeiro_contato: "contatado",
  primeiro_contacto: "contatado",
  contato_inicial: "contatado",
  follow_up: "respondeu",
  followup: "respondeu",
  acompanhamento: "respondeu",
  reuniao_agendada: "proposta",
  reuniao: "proposta",
  proposta_enviada: "proposta",
  fechado: "fechado",
  fechados: "fechado",
  ganho: "fechado",
};

export const emptyLead: LeadInput = {
  name: "",
  phone: "",
  company: "",
  source: "",
  status: "novo",
  estimated_value: null,
  owner_name: "",
  temperature: "morno",
  outcome_reason: "",
  sla_hours: 24,
};

function normalizeStageKey(value: string) {
  return value
    .replace(/^custom[_-]/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCanonicalStageId(value: string) {
  const key = normalizeStageKey(value);
  return canonicalStageAliases[key];
}

export function resolvePipelineStageId(id: string, title: string) {
  if (defaultPipelineStageIds.has(id)) return id;
  return getCanonicalStageId(title) ?? getCanonicalStageId(id) ?? id;
}

export function readSavedPipelineFilters() {
  const defaults = {
    statusFilter: "all" as LeadStatus | "all",
    temperatureFilter: "all" as Lead["temperature"] | "all",
    dateFilter: "all" as "all" | "today" | "overdue",
    tagFilter: "all",
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem("origocrm:pipeline-filters");
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as {
      statusFilter: LeadStatus | "all";
      temperatureFilter: Lead["temperature"] | "all";
      dateFilter: "all" | "today" | "overdue";
      tagFilter: string | "all";
    };
    const statusFilter =
      parsed.statusFilter && parsed.statusFilter !== "all"
        ? resolvePipelineStageId(parsed.statusFilter, parsed.statusFilter)
        : "all";

    return {
      statusFilter,
      temperatureFilter: parsed.temperatureFilter ?? "all",
      dateFilter: parsed.dateFilter ?? "all",
      tagFilter: parsed.tagFilter ?? "all",
    };
  } catch {
    return defaults;
  }
}

export function readSavedPipelineFilterPresets(): SavedPipelineFilter[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem("origocrm:pipeline-filter-presets");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPipelineFilter[]) : [];
  } catch {
    return [];
  }
}

export function getDefaultPipelineStages(): PipelineStage[] {
  return defaultPipelineColumns.map((column) => ({
    id: column.id,
    title: column.title,
    kind: column.id === "fechado" ? "closed" : "open",
  }));
}

export function normalizePipelineStages(input: unknown): PipelineStage[] {
  const defaults = getDefaultPipelineStages();
  if (!Array.isArray(input)) return defaults;

  const stages = input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const stage = item as Partial<PipelineStage>;
      if (!stage.id || !stage.title) return null;
      const title = String(stage.title).trim() || String(stage.id);
      return {
        id: resolvePipelineStageId(String(stage.id), title),
        title,
        kind: (stage.kind === "closed" ? "closed" : "open") as NonNullable<PipelineStage["kind"]>,
      };
    })
    .filter((stage): stage is PipelineStage => Boolean(stage));

  const unique = stages.filter(
    (stage, index, all) => all.findIndex((item) => item.id === stage.id) === index,
  );
  return unique.length ? unique : defaults;
}

export function readPipelineStages(): PipelineStage[] {
  if (typeof window === "undefined") return getDefaultPipelineStages();

  try {
    const raw = window.localStorage.getItem("origocrm:pipeline-stages");
    return normalizePipelineStages(raw ? JSON.parse(raw) : null);
  } catch {
    return getDefaultPipelineStages();
  }
}

export function createPipelineStageId(title: string, existingStages: PipelineStage[]) {
  const canonicalId = getCanonicalStageId(title);
  const existingIds = new Set(existingStages.map((stage) => stage.id));
  if (canonicalId && !existingIds.has(canonicalId)) return canonicalId;

  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "etapa";
  let next = `custom_${base}`;
  let suffix = 2;

  while (existingIds.has(next)) {
    next = `custom_${base}_${suffix}`;
    suffix += 1;
  }

  return next;
}

export function groupLeadTagsByLead(leadTags: LeadTag[], tags: CrmTag[]) {
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const grouped = new Map<string, CrmTag[]>();

  for (const relation of leadTags) {
    const tag = tagsById.get(relation.tag_id);
    if (!tag) continue;
    grouped.set(relation.lead_id, [...(grouped.get(relation.lead_id) ?? []), tag]);
  }

  return grouped;
}

export function pickTagColor(name: string) {
  const colors = ["#8B5CF6", "#25D366", "#F59E0B", "#0EA5E9", "#F43F5E", "#A78BFA"];
  const index = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}
