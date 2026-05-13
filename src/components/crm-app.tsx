"use client";

import {
  DndContext,
  DragEndEvent,
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
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  Copy,
  Database,
  Edit3,
  Eye,
  ExternalLink,
  FileDown,
  Archive,
  Loader2,
  Link2,
  LogOut,
  MessageCircle,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { recordAuditLog as recordAuditLogAction } from "@/actions/audit";
import {
  createLead as createLeadAction,
  deleteLead as deleteLeadAction,
  unarchiveLead as unarchiveLeadAction,
  updateLead as updateLeadAction,
} from "@/actions/leads";
import { moveLeadStage } from "@/actions/pipeline";
import {
  completeTask as completeTaskAction,
  createTask as createTaskAction,
  rescheduleTask as rescheduleTaskAction,
} from "@/actions/tasks";
import {
  saveWhatsAppConversationAsLead,
  sendWhatsAppConversationMessage,
  sendWhatsAppMessage,
  updateWhatsAppConversationStatus,
} from "@/actions/whatsapp";
import { pipelineColumns as defaultPipelineColumns } from "@/lib/constants";
import { createSupabaseClient, isSupabaseConfigured } from "@/lib/db";
import type {
  AuditLog,
  Interaction,
  Lead,
  LeadInput,
  LeadStatus,
  MessageTemplate,
  Task,
  WhatsAppLog,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/lib/types";
import { getViewSubtitle, pathViews, type View, viewPaths, viewTitles } from "@/lib/navigation";
import {
  newId,
  normalizePhone,
  addDays,
  renderTemplate,
  pickTemplate,
  getPriorityLeads,
} from "@/lib/utils";
import {
  makeInteraction,
  getNextLeadAfterSend,
} from "@/lib/services/leads";

type AuthUser = { id: string; email?: string };
type Toast = { id: string; text: string };
type DashboardAgendaItem = {
  lead: Lead;
  dueAt: string;
  title: string;
  task?: Task;
};
type InteractionInput = {
  note: string;
  type: NonNullable<Interaction["type"]>;
  channel: Interaction["channel"];
};
type TaskInput = {
  type: Task["type"];
  title: string;
  notes?: string | null;
  due_at: string;
};
type TaskScope = "open" | "overdue" | "today" | "upcoming" | "completed";
type MigrationCheck = {
  label: string;
  status: "checking" | "ok" | "missing";
  detail: string;
};
type AuditLogInput = {
  entity_type: AuditLog["entity_type"];
  entity_id?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
};
type SavedPipelineFilter = {
  id: string;
  name: string;
  filters: {
    query?: string;
    statusFilter: LeadStatus | "all";
    temperatureFilter: Lead["temperature"] | "all";
    dateFilter: "all" | "today" | "overdue";
  };
};
type PipelineStage = {
  id: LeadStatus;
  title: string;
  kind: "open" | "closed";
};

const defaultClosedStageIds = new Set<LeadStatus>(["fechado"]);
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

function resolvePipelineStageId(id: string, title: string) {
  if (defaultPipelineStageIds.has(id)) return id;
  return getCanonicalStageId(title) ?? getCanonicalStageId(id) ?? id;
}

const emptyLead: LeadInput = {
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

function readSavedPipelineFilters() {
  if (typeof window === "undefined") {
    return {
      statusFilter: "all" as LeadStatus | "all",
      temperatureFilter: "all" as Lead["temperature"] | "all",
      dateFilter: "all" as "all" | "today" | "overdue",
    };
  }

  try {
    const raw = window.localStorage.getItem("origocrm:pipeline-filters");
    if (!raw) {
      return {
        statusFilter: "all" as LeadStatus | "all",
        temperatureFilter: "all" as Lead["temperature"] | "all",
        dateFilter: "all" as "all" | "today" | "overdue",
      };
    }
    const parsed = JSON.parse(raw) as {
      statusFilter?: LeadStatus | "all";
      temperatureFilter?: Lead["temperature"] | "all";
      dateFilter?: "all" | "today" | "overdue";
    };
    const statusFilter =
      parsed.statusFilter && parsed.statusFilter !== "all"
        ? resolvePipelineStageId(parsed.statusFilter, parsed.statusFilter)
        : "all";

    return {
      statusFilter,
      temperatureFilter: parsed.temperatureFilter ?? "all",
      dateFilter: parsed.dateFilter ?? "all",
    };
  } catch {
    return {
      statusFilter: "all" as LeadStatus | "all",
      temperatureFilter: "all" as Lead["temperature"] | "all",
      dateFilter: "all" as "all" | "today" | "overdue",
    };
  }
}

function readSavedPipelineFilterPresets(): SavedPipelineFilter[] {
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

function getDefaultPipelineStages(): PipelineStage[] {
  return defaultPipelineColumns.map((column) => ({
    id: column.id,
    title: column.title,
    kind: column.id === "fechado" ? "closed" : "open",
  }));
}

function normalizePipelineStages(input: unknown): PipelineStage[] {
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

function readPipelineStages(): PipelineStage[] {
  if (typeof window === "undefined") return getDefaultPipelineStages();

  try {
    const raw = window.localStorage.getItem("origocrm:pipeline-stages");
    return normalizePipelineStages(raw ? JSON.parse(raw) : null);
  } catch {
    return getDefaultPipelineStages();
  }
}

function createPipelineStageId(title: string, existingStages: PipelineStage[]) {
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

function BrandLogo({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        alt="OrigoCRM"
        className="object-contain"
        fill
        preload={!compact}
        sizes={compact ? "220px" : "(max-width: 768px) 92vw, 640px"}
        src="/origocrm-logo.png"
      />
    </div>
  );
}

export function CrmApp({
  initialView = "dashboard",
  initialSettingsTab,
}: {
  initialView?: View;
  initialSettingsTab?: SettingsTab;
} = {}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null,
      );
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090D] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
      </main>
    );
  }

  if (!supabase) return <MissingSupabaseConfig />;

  if (!user) return <AuthScreen />;

  return (
    <Workspace
      initialSettingsTab={initialSettingsTab}
      initialView={initialView}
      user={user}
      onLogout={() => setUser(null)}
    />
  );
}

function MissingSupabaseConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090D] px-5 text-white">
      <section className="w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <BrandLogo className="mb-5 aspect-[3.13/1] w-full" />
        <h1 className="text-2xl font-semibold">Supabase nao configurado</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Configure as variaveis `NEXT_PUBLIC_SUPABASE_URL` e
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` na Vercel para ativar login e banco real.
        </p>
      </section>
    </main>
  );
}

function AuthScreen() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
  }

  return (
    <main className="min-h-screen bg-[#09090D] px-5 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <section className="flex justify-center lg:justify-start">
          <BrandLogo className="aspect-[3.13/1] w-[min(92vw,640px)]" />
        </section>

        <section className="rounded-2xl border border-[#8B5CF6]/20 bg-white/[0.04] p-6 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Acesse com seu usuario autorizado.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleAuth}>
            <label className="block text-sm text-zinc-300">
              Email
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Senha
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-white outline-none ring-[#8B5CF6]/50 transition focus:border-[#8B5CF6] focus:ring-4"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimo 6 caracteres"
                required
                type="password"
                value={password}
              />
            </label>
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 font-medium transition hover:bg-[#8B5CF6] disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Entrar
            </button>
          </form>
          {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}

function Workspace({
  user,
  onLogout,
  initialView,
  initialSettingsTab,
}: {
  user: AuthUser;
  onLogout: () => void;
  initialView: View;
  initialSettingsTab?: SettingsTab;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const routedView = pathViews[pathname] ?? initialView;
  const view = routedView === "whatsapp" || routedView === "templates" ? "settings" : routedView;
  const settingsInitialTab =
    routedView === "whatsapp" ? "whatsapp" : routedView === "templates" ? "templates" : initialSettingsTab;
  const savedFilters = useMemo(() => readSavedPipelineFilters(), []);
  const initialFilterPresets = useMemo(() => readSavedPipelineFilterPresets(), []);
  const initialPipelineStages = useMemo(() => readPipelineStages(), []);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">(savedFilters.statusFilter);
  const [temperatureFilter, setTemperatureFilter] = useState<Lead["temperature"] | "all">(savedFilters.temperatureFilter);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "overdue">(savedFilters.dateFilter);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadPendingDelete, setLeadPendingDelete] = useState<Lead | null>(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState<MessageTemplate | null>(null);
  const [pipelineStagesOpen, setPipelineStagesOpen] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(initialPipelineStages);
  const [selectedPipelineLeadIds, setSelectedPipelineLeadIds] = useState<Set<string>>(() => new Set());
  const [bulkOwnerName, setBulkOwnerName] = useState("");
  const [savedFilterPresets, setSavedFilterPresets] = useState<SavedPipelineFilter[]>(initialFilterPresets);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recentLeadId, setRecentLeadId] = useState<string | null>(null);
  const [remoteLeads, setRemoteLeads] = useState<Lead[]>([]);
  const [remoteArchivedLeads, setRemoteArchivedLeads] = useState<Lead[]>([]);
  const [remoteTemplates, setRemoteTemplates] = useState<MessageTemplate[]>([]);
  const [remoteInteractions, setRemoteInteractions] = useState<Interaction[]>([]);
  const [remoteTasks, setRemoteTasks] = useState<Task[]>([]);
  const [remoteWhatsAppMessages, setRemoteWhatsAppMessages] = useState<WhatsAppMessage[]>([]);
  const [remoteWhatsAppLogs, setRemoteWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [remoteAuditLogs, setRemoteAuditLogs] = useState<AuditLog[]>([]);
  const leads = remoteLeads;
  const archivedLeads = remoteArchivedLeads;
  const templates = remoteTemplates;
  const interactions = remoteInteractions;
  const tasks = remoteTasks;
  const whatsappMessages = remoteWhatsAppMessages;
  const whatsappLogs = remoteWhatsAppLogs;
  const auditLogs = remoteAuditLogs;
  const priorityLeads = useMemo(() => getPriorityLeads(leads), [leads]);

  useEffect(() => {
    async function loadRemoteData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [
        leadResult,
        templateResult,
        interactionResult,
        taskResult,
        whatsappMessageResult,
        whatsappLogResult,
        auditLogResult,
      ] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("message_templates").select("*").order("created_at", { ascending: true }),
        supabase.from("interactions").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_at", { ascending: true }).limit(200),
        supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("whatsapp_logs").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(80),
      ]);

      if (
        leadResult.error ||
        templateResult.error ||
        interactionResult.error ||
        whatsappMessageResult.error ||
        whatsappLogResult.error
      ) {
        setToast({
          id: newId("toast"),
          text: "Nao foi possivel carregar os dados do Supabase",
        });
      }

      const loadedLeads = (leadResult.data as Lead[] | null) ?? [];
      setRemoteLeads(loadedLeads.filter((lead) => !lead.archived_at));
      setRemoteArchivedLeads(loadedLeads.filter((lead) => Boolean(lead.archived_at)));
      setRemoteTemplates((templateResult.data as MessageTemplate[] | null) ?? []);
      setRemoteInteractions((interactionResult.data as Interaction[] | null) ?? []);
      setRemoteTasks((taskResult.data as Task[] | null) ?? []);
      setRemoteWhatsAppMessages((whatsappMessageResult.data as WhatsAppMessage[] | null) ?? []);
      setRemoteWhatsAppLogs((whatsappLogResult.data as WhatsAppLog[] | null) ?? []);
      setRemoteAuditLogs((auditLogResult.data as AuditLog[] | null) ?? []);
      setLoading(false);
    }

    loadRemoteData();
  }, [supabase, user.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.localStorage.setItem(
      "origocrm:pipeline-filters",
      JSON.stringify({ statusFilter, temperatureFilter, dateFilter }),
    );
  }, [dateFilter, statusFilter, temperatureFilter]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:pipeline-filter-presets", JSON.stringify(savedFilterPresets));
  }, [savedFilterPresets]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:pipeline-stages", JSON.stringify(pipelineStages));
  }, [pipelineStages]);

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    return leads.filter((lead) =>
      (!search ||
        [lead.name, lead.phone, lead.company, lead.source, lead.owner_name ?? ""].some((value) =>
          value.toLowerCase().includes(search),
        )) &&
      (statusFilter === "all" || lead.status === statusFilter) &&
      (temperatureFilter === "all" || (lead.temperature ?? "morno") === temperatureFilter) &&
      (dateFilter === "all" ||
        (dateFilter === "today" && isLeadCreatedToday(lead)) ||
        (dateFilter === "overdue" && isFollowupOverdue(lead))),
    );
  }, [dateFilter, leads, query, statusFilter, temperatureFilter]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedPipelineLeads = filteredLeads.filter((lead) => selectedPipelineLeadIds.has(lead.id));
  const visiblePipelineStages = useMemo(() => {
    const stageIds = new Set(pipelineStages.map((stage) => stage.id));
    const missingStages = leads
      .map((lead) => lead.status)
      .filter((status, index, all) => !stageIds.has(status) && all.indexOf(status) === index)
      .map((status) => ({ id: status, title: status, kind: "open" as const }));

    return [...pipelineStages, ...missingStages];
  }, [leads, pipelineStages]);
  function showToast(text: string) {
    setToast({ id: newId("toast"), text });
  }

  function exportFilteredLeads() {
    const rows = filteredLeads.map((lead) => ({
      nome: lead.name,
      telefone: lead.phone,
      empresa: lead.company,
      origem: lead.source,
      status: lead.status,
      temperatura: lead.temperature ?? "morno",
      valor_estimado: lead.estimated_value ?? "",
      responsavel: lead.owner_name ?? "",
      proximo_followup: lead.next_followup_at ?? "",
      motivo: lead.outcome_reason ?? "",
    }));
    const header = Object.keys(rows[0] ?? {
      nome: "",
      telefone: "",
      empresa: "",
      origem: "",
      status: "",
      temperatura: "",
      valor_estimado: "",
      responsavel: "",
      proximo_followup: "",
      motivo: "",
    });
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((key) => `"${String(row[key as keyof typeof row] ?? "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `origo-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function navigateView(nextView: View) {
    const nextPath = viewPaths[nextView];
    if (pathname !== nextPath) router.push(nextPath);
  }

  function saveCurrentFilterPreset() {
    const name = window.prompt("Nome para este filtro:");
    if (!name?.trim()) return;

    const preset: SavedPipelineFilter = {
      id: newId("filter"),
      name: name.trim(),
      filters: { query, statusFilter, temperatureFilter, dateFilter },
    };
    setSavedFilterPresets((items) => [preset, ...items.filter((item) => item.name !== preset.name)].slice(0, 12));
    showToast("Filtro salvo");
  }

  function applyFilterPreset(id: string) {
    const preset = savedFilterPresets.find((item) => item.id === id);
    if (!preset) return;
    setQuery(preset.filters.query ?? "");
    setStatusFilter(
      preset.filters.statusFilter === "all"
        ? "all"
        : resolvePipelineStageId(preset.filters.statusFilter, preset.filters.statusFilter),
    );
    setTemperatureFilter(preset.filters.temperatureFilter);
    setDateFilter(preset.filters.dateFilter);
    showToast(`Filtro aplicado: ${preset.name}`);
  }

  function addPipelineStage(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;

    setPipelineStages((items) => [
      ...items,
      { id: createPipelineStageId(trimmed, items), title: trimmed, kind: "open" },
    ]);
    showToast("Etapa adicionada");
  }

  function renamePipelineStage(id: LeadStatus, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setPipelineStages((items) =>
      items.map((stage) => (stage.id === id ? { ...stage, title: trimmed } : stage)),
    );
  }

  function removePipelineStage(id: LeadStatus) {
    const hasLeads = leads.some((lead) => lead.status === id);
    if (hasLeads) {
      showToast("Mova os leads desta etapa antes de remover");
      return;
    }
    if (pipelineStages.length <= 1) {
      showToast("Mantenha pelo menos uma etapa no funil");
      return;
    }

    setPipelineStages((items) => items.filter((stage) => stage.id !== id));
    if (statusFilter === id) setStatusFilter("all");
    showToast("Etapa removida");
  }

  function movePipelineStage(id: LeadStatus, direction: -1 | 1) {
    setPipelineStages((items) => {
      const index = items.findIndex((stage) => stage.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return items;

      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updatePipelineStageKind(id: LeadStatus, kind: NonNullable<PipelineStage["kind"]>) {
    setPipelineStages((items) =>
      items.map((stage) => (stage.id === id ? { ...stage, kind } : stage)),
    );
  }

  function patchLeadOptimistic(id: string, patch: Partial<Lead>) {
    setRemoteLeads((items) => items.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
    setRecentLeadId(id);
    window.setTimeout(() => setRecentLeadId((current) => (current === id ? null : current)), 1400);
  }

  function addInteractionOptimistic(interaction: Interaction) {
    setRemoteInteractions((items) => [interaction, ...items]);
  }

  async function recordAuditLog(input: AuditLogInput) {
    const auditLog: AuditLog = {
      id: newId("audit"),
      user_id: user.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? {},
      created_at: new Date().toISOString(),
    };

    setRemoteAuditLogs((items) => [auditLog, ...items].slice(0, 80));

    const result = await recordAuditLogAction({
      entity_type: auditLog.entity_type,
      entity_id: auditLog.entity_id,
      action: auditLog.action,
      summary: auditLog.summary,
      metadata: auditLog.metadata,
    });

    if (!result.success) {
      setRemoteAuditLogs((items) => items.filter((item) => item.id !== auditLog.id));
    }
  }

  async function saveLead(input: LeadInput, id?: string) {
    const timestamp = new Date().toISOString();

    if (id) {
      const previous = remoteLeads;
      patchLeadOptimistic(id, { ...input, updated_at: timestamp });
      const result = await updateLeadAction(id, input);
      if (!result.success) {
        setRemoteLeads(previous);
        showToast(result.error ?? "Erro ao atualizar lead");
        return;
      }
      await recordAuditLog({
        entity_type: "lead",
        entity_id: id,
        action: "lead.updated",
        summary: `Lead atualizado: ${input.name}`,
        metadata: { status: input.status, temperature: input.temperature, owner_name: input.owner_name },
      });
      return;
    }

    const result = await createLeadAction(input);

    if (!result.success) {
      showToast(result.error ?? "Erro ao criar lead");
      return;
    }

    if (result.data) {
      const createdLead = result.data as Lead;
      setRemoteLeads((items) => [createdLead, ...items]);
      await recordAuditLog({
        entity_type: "lead",
        entity_id: createdLead.id,
        action: "lead.created",
        summary: `Lead criado: ${createdLead.name}`,
        metadata: { status: createdLead.status, source: createdLead.source },
      });
    }
  }

  async function deleteLead(lead: Lead) {
    const previousLeads = remoteLeads;
    const previousArchivedLeads = remoteArchivedLeads;
    const previousTasks = remoteTasks;
    const previousInteractions = remoteInteractions;
    const previousWhatsAppMessages = remoteWhatsAppMessages;

    setSelectedLeadId((current) => (current === lead.id ? null : current));
    setLeadPendingDelete(null);
    setRemoteLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteArchivedLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteTasks((items) => items.filter((item) => item.lead_id !== lead.id));
    setRemoteInteractions((items) => items.filter((item) => item.lead_id !== lead.id));
    setRemoteWhatsAppMessages((items) =>
      items.map((message) => (message.lead_id === lead.id ? { ...message, lead_id: null } : message)),
    );
    setSelectedPipelineLeadIds((current) => {
      const next = new Set(current);
      next.delete(lead.id);
      return next;
    });
    showToast("Lead excluido");

    const result = await deleteLeadAction(lead.id);

    if (!result.success) {
      setRemoteLeads(previousLeads);
      setRemoteArchivedLeads(previousArchivedLeads);
      setRemoteTasks(previousTasks);
      setRemoteInteractions(previousInteractions);
      setRemoteWhatsAppMessages(previousWhatsAppMessages);
      showToast(result.error ?? "Erro ao excluir lead");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead.deleted",
      summary: `Lead excluido: ${lead.name}`,
      metadata: { phone: lead.phone, company: lead.company, status: lead.status },
    });
  }

  async function unarchiveLead(lead: Lead) {
    const previousLeads = remoteLeads;
    const previousArchivedLeads = remoteArchivedLeads;

    setRemoteArchivedLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteLeads((items) => [{ ...lead, archived_at: null, updated_at: new Date().toISOString() }, ...items]);
    showToast("Lead desarquivado");

    const result = await unarchiveLeadAction(lead.id);

    if (!result.success) {
      setRemoteLeads(previousLeads);
      setRemoteArchivedLeads(previousArchivedLeads);
      showToast(result.error ?? "Erro ao desarquivar lead");
      return;
    }

    if (result.data) {
      const restoredLead = result.data as Lead;
      setRemoteLeads((items) => items.map((item) => (item.id === restoredLead.id ? restoredLead : item)));
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead.unarchived",
      summary: `Lead desarquivado: ${lead.name}`,
      metadata: { phone: lead.phone, company: lead.company, status: lead.status },
    });
  }

  function requestLeadStatusChange(id: string, status: LeadStatus) {
    const before = leads.find((lead) => lead.id === id);
    if (!before) return;

    void updateLeadStatus(id, status, before.outcome_reason ?? null);
  }

  async function updateLeadStatus(id: string, status: LeadStatus, outcomeReason?: string | null) {
    const before = leads.find((lead) => lead.id === id);
    if (!before) return;

    const previousInteractions = remoteInteractions;
    const reason = outcomeReason?.trim() ?? before.outcome_reason?.trim() ?? "";

    patchLeadOptimistic(id, {
      status,
      ...(reason ? { outcome_reason: reason } : {}),
      updated_at: new Date().toISOString(),
    });
    if (before && before.status !== status) {
      const interaction = makeInteraction(id, `Status alterado para ${status}`, "status_changed");
      addInteractionOptimistic(interaction);
    }

    const result = await moveLeadStage(id, status, reason);

    if (!result.success) {
      if (before) patchLeadOptimistic(id, before);
      setRemoteInteractions(previousInteractions);
      showToast(result.error ?? "Erro ao atualizar status");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: id,
      action: "lead.status_changed",
      summary: `Status alterado para ${status}`,
      metadata: { previous_status: before?.status, next_status: status },
    });
  }

  function togglePipelineLeadSelection(id: string) {
    setSelectedPipelineLeadIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkArchiveSelectedLeads() {
    const selected = selectedPipelineLeads;
    if (selected.length === 0) return;

    for (const lead of selected) {
      await deleteLead(lead);
    }
    setSelectedPipelineLeadIds(new Set());
  }

  async function bulkAssignOwner() {
    const ownerName = bulkOwnerName.trim();
    const selected = selectedPipelineLeads;
    if (!ownerName || selected.length === 0) return;

    const previousLeads = remoteLeads;
    const now = new Date().toISOString();
    const selectedIds = new Set(selected.map((lead) => lead.id));

    setRemoteLeads((items) =>
      items.map((lead) =>
        selectedIds.has(lead.id) ? { ...lead, owner_name: ownerName, updated_at: now } : lead,
      ),
    );

    const results = await Promise.all(selected.map((lead) => updateLeadAction(lead.id, { owner_name: ownerName })));
    const failed = results.find((result) => !result.success);

    if (failed) {
      setRemoteLeads(previousLeads);
      showToast(failed.error ?? "Erro ao atribuir responsavel");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: null,
      action: "lead.bulk_owner_assigned",
      summary: `Responsavel atribuido a ${selected.length} leads`,
      metadata: { lead_ids: Array.from(selectedIds), owner_name: ownerName },
    });
    setBulkOwnerName("");
    setSelectedPipelineLeadIds(new Set());
    showToast("Responsavel atribuido");
  }

  async function bulkMoveSelectedLeads(status: LeadStatus) {
    const selected = selectedPipelineLeads.filter((lead) => lead.status !== status);
    if (selected.length === 0) return;

    for (const lead of selected) {
      await updateLeadStatus(lead.id, status, lead.outcome_reason ?? null);
    }
    setSelectedPipelineLeadIds(new Set());
  }

  async function bulkScheduleSelectedLeads(days: number) {
    const selected = selectedPipelineLeads;
    if (selected.length === 0) return;

    for (const lead of selected) {
      await scheduleFollowup(lead, addDays(days));
    }
    setSelectedPipelineLeadIds(new Set());
  }

  async function scheduleFollowup(lead: Lead, nextFollowupAt: string) {
    const now = new Date().toISOString();
    const task: Task = {
      id: newId("task"),
      lead_id: lead.id,
      user_id: user.id,
      type: "followup",
      title: `Follow-up com ${lead.name}`,
      notes: null,
      due_at: nextFollowupAt,
      status: "open",
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    const shouldUpdateLeadFollowup =
      !lead.next_followup_at ||
      new Date(nextFollowupAt).getTime() <= new Date(lead.next_followup_at).getTime();
    if (shouldUpdateLeadFollowup) {
      patchLeadOptimistic(lead.id, {
        next_followup_at: nextFollowupAt,
        updated_at: now,
      });
    }
    const interaction = makeInteraction(
      lead.id,
      `Follow-up criado para ${new Date(nextFollowupAt).toLocaleString("pt-BR")}`,
      "followup_created",
    );
    addInteractionOptimistic(interaction);
    setRemoteTasks((items) => [task, ...items]);
    showToast("Follow-up agendado");

    if (supabase) {
      const [taskResult, { error: interactionError }] = await Promise.all([
        createTaskAction(
          {
            id: task.id,
            lead_id: lead.id,
            type: task.type,
            title: task.title,
            notes: task.notes,
            due_at: task.due_at,
          },
          { cancelOpenFollowups: false },
        ),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);
      if (interactionError) showToast("Erro ao salvar follow-up");
      if (!taskResult.success) showToast("Follow-up salvo; aplique a migracao de tarefas no Supabase");
      if (taskResult.success && !interactionError) {
        await recordAuditLog({
          entity_type: "task",
          entity_id: task.id,
          action: "task.followup_scheduled",
          summary: `Follow-up agendado para ${lead.name}`,
          metadata: { lead_id: lead.id, due_at: nextFollowupAt },
        });
      }
    }
  }

  async function createTask(lead: Lead, input: TaskInput) {
    const now = new Date().toISOString();
    const task: Task = {
      id: newId("task"),
      lead_id: lead.id,
      user_id: user.id,
      type: input.type,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      due_at: input.due_at,
      status: "open",
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const interaction = makeInteraction(
      lead.id,
      `Tarefa criada: ${task.title} (${taskTypeLabel(task.type)})`,
      task.type === "followup" ? "followup_created" : "note",
    );

    setRemoteTasks((items) => [task, ...items]);
    const shouldUpdateLeadFollowup =
      task.type === "followup" &&
      (!lead.next_followup_at ||
        new Date(task.due_at).getTime() <= new Date(lead.next_followup_at).getTime());
    if (shouldUpdateLeadFollowup) {
      patchLeadOptimistic(lead.id, { next_followup_at: task.due_at, updated_at: now });
    }
    addInteractionOptimistic(interaction);
    showToast("Tarefa criada");

    if (supabase) {
      const [taskResult, { error: interactionError }] = await Promise.all([
        createTaskAction(
          {
            id: task.id,
            lead_id: lead.id,
            type: task.type,
            title: task.title,
            notes: task.notes,
            due_at: task.due_at,
          },
          { cancelOpenFollowups: false },
        ),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao criar tarefa. Verifique a migracao de tarefas no Supabase");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.created",
        summary: `Tarefa criada: ${task.title}`,
        metadata: { lead_id: lead.id, type: task.type, due_at: task.due_at },
      });
    }
  }

  async function completeTask(task: Task, lead: Lead) {
    const now = new Date().toISOString();
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const shouldClearFollowup = lead.next_followup_at === task.due_at;
    const interaction = makeInteraction(
      lead.id,
      `Follow-up concluido: ${task.title}`,
      "note",
    );

    setRemoteTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? { ...item, status: "completed", completed_at: now, updated_at: now }
          : item,
      ),
    );
    if (shouldClearFollowup) {
      patchLeadOptimistic(lead.id, { next_followup_at: null, updated_at: now });
    }
    addInteractionOptimistic(interaction);
    showToast("Follow-up concluido");

    if (supabase) {
      const [taskResult, { error: interactionError }] = await Promise.all([
        completeTaskAction(task.id, { leadId: lead.id, clearLeadFollowup: shouldClearFollowup }),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao concluir follow-up");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.completed",
        summary: `Tarefa concluida: ${task.title}`,
        metadata: { lead_id: lead.id, type: task.type, completed_at: now },
      });
    }
  }

  async function rescheduleTask(task: Task, lead: Lead, dueAt: string) {
    const now = new Date().toISOString();
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const interaction = makeInteraction(
      lead.id,
      `Tarefa reagendada: ${task.title} para ${new Date(dueAt).toLocaleString("pt-BR")}`,
      task.type === "followup" ? "followup_created" : "note",
    );

    setRemoteTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? { ...item, due_at: dueAt, status: "open", completed_at: null, updated_at: now }
          : item,
      ),
    );
    if (task.type === "followup") {
      patchLeadOptimistic(lead.id, { next_followup_at: dueAt, updated_at: now });
    }
    addInteractionOptimistic(interaction);
    showToast("Tarefa reagendada");

    if (supabase) {
      const [taskResult, { error: interactionError }] = await Promise.all([
        rescheduleTaskAction(task.id, {
          leadId: lead.id,
          dueAt,
          updateLeadFollowup: task.type === "followup",
        }),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        showToast("Erro ao reagendar tarefa");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.rescheduled",
        summary: `Tarefa reagendada: ${task.title}`,
        metadata: { lead_id: lead.id, type: task.type, due_at: dueAt },
      });
    }
  }

  async function updateLeadTemperature(lead: Lead, temperature: NonNullable<Lead["temperature"]>) {
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const now = new Date().toISOString();
    const interaction: Interaction = {
      id: newId("interaction"),
      lead_id: lead.id,
      note: `Temperatura alterada para ${temperature}`,
      message: `Temperatura alterada para ${temperature}`,
      type: "note",
      channel: "other",
      created_at: now,
    };

    patchLeadOptimistic(lead.id, { temperature, updated_at: now });
    addInteractionOptimistic(interaction);
    showToast("Temperatura atualizada");

    if (supabase) {
      const [{ error: leadError }, { error: interactionError }] = await Promise.all([
        supabase.from("leads").update({ temperature }).eq("id", lead.id),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (leadError || interactionError) {
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao atualizar temperatura");
        return;
      }

      await recordAuditLog({
        entity_type: "lead",
        entity_id: lead.id,
        action: "lead.temperature_changed",
        summary: `Temperatura alterada para ${temperature}`,
        metadata: { previous_temperature: lead.temperature, next_temperature: temperature },
      });
    }
  }



  async function addInteraction(leadId: string, input: InteractionInput) {
    const interaction: Interaction = {
      id: newId("interaction"),
      lead_id: leadId,
      note: input.note,
      message: input.note,
      type: input.type,
      channel: input.channel,
      created_at: new Date().toISOString(),
    };
    addInteractionOptimistic(interaction);
    if (supabase) {
      const { error } = await supabase.from("interactions").insert({ ...interaction, user_id: user.id });
      if (error) showToast("Erro ao registrar interacao");
      else await recordAuditLog({
        entity_type: "lead",
        entity_id: leadId,
        action: "interaction.created",
        summary: "Interacao registrada",
        metadata: { type: input.type, channel: input.channel },
      });
    }
  }

  async function sendWhatsApp(lead: Lead, message: string, nextFollowupAt: string) {
    const now = new Date().toISOString();
    const interaction = makeInteraction(lead.id, "Mensagem enviada via WhatsApp", "whatsapp_sent");
    const nextLead = getNextLeadAfterSendWrapper(lead);
    const previousLeads = remoteLeads;

    patchLeadOptimistic(lead.id, {
      status: "contatado",
      last_contact_at: now,
      next_followup_at: nextFollowupAt,
      updated_at: now,
    });
    addInteractionOptimistic(interaction);
    showToast("Enviando pela Evolution");

    setSelectedLeadId(nextLead?.id ?? null);

    const result = await sendWhatsAppMessage(lead.id, lead.phone, message, nextFollowupAt);

    if (!result.success) {
      setRemoteLeads(previousLeads);
      showToast(result.error ?? "Erro ao enviar pela Evolution");
      return;
    }

    showToast("Mensagem enviada pelo WhatsApp");
    await recordAuditLog({
      entity_type: "whatsapp",
      entity_id: lead.id,
      action: "whatsapp.message_sent",
      summary: `Mensagem enviada para ${lead.name}`,
      metadata: { lead_id: lead.id, next_followup_at: nextFollowupAt },
    });
  }

  function getNextLeadAfterSendWrapper(currentLead: Lead) {
    return getNextLeadAfterSend(currentLead, leads, priorityLeads);
  }

  async function addTemplate(title: string, body: string) {
    if (!supabase) {
      showToast("Supabase nao configurado");
      return;
    }

    const { data, error } = await supabase
      .from("message_templates")
      .insert({ title, body, user_id: user.id })
      .select()
      .single();

    if (error) {
      showToast("Erro ao salvar template");
      return;
    }

    if (data) {
      const template = data as MessageTemplate;
      setRemoteTemplates((items) => [...items, template]);
      await recordAuditLog({
        entity_type: "template",
        entity_id: template.id,
        action: "template.created",
        summary: `Template criado: ${template.title}`,
      });
    }
  }

  async function deleteTemplate(template: MessageTemplate) {
    if (!supabase) {
      showToast("Supabase nao configurado");
      return;
    }

    const previousTemplates = remoteTemplates;
    setTemplatePendingDelete(null);
    setRemoteTemplates((items) => items.filter((item) => item.id !== template.id));
    showToast("Mensagem pronta excluida");

    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", template.id)
      .eq("user_id", user.id);

    if (error) {
      setRemoteTemplates(previousTemplates);
      showToast("Erro ao excluir mensagem pronta");
      return;
    }

    await recordAuditLog({
      entity_type: "template",
      entity_id: template.id,
      action: "template.deleted",
      summary: `Template excluido: ${template.title}`,
    });
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    onLogout();
  }

  return (
    <main className="min-h-screen bg-[#09090D] text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-[60] rounded-lg border border-[#8B5CF6]/40 bg-[#17111f] px-4 py-3 text-sm shadow-2xl shadow-[#8B5CF6]/30">
          {toast.text}
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/25 px-4 py-4 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div>
              <BrandLogo compact className="aspect-[3.13/1] w-56 max-w-full" />
              <div className="mt-3 max-w-full truncate text-xs text-zinc-500">{user.email}</div>
            </div>
            <button
              className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
              onClick={logout}
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav className="mt-4 grid grid-cols-4 gap-2 lg:grid-cols-1">
            {[
              ["dashboard", "Dashboard", BarChart3],
              ["pipeline", "Pipeline", Sparkles],
              ["tasks", "Agenda", CalendarClock],
              ["leads", "Leads", UserRound],
              ["conversations", "Conversas", MessageCircle],
              ["settings", "Configuracoes", Settings],
            ].map(([key, label, Icon]) => (
              <button
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition lg:justify-start ${
                  view === key
                    ? "bg-[#8B5CF6] text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
                key={key as string}
                onClick={() => navigateView(key as View)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label as string}</span>
              </button>
            ))}
          </nav>
          <button
            className="mt-4 hidden w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white lg:flex"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </aside>

        <section className="flex-1 overflow-hidden">
          <header className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{viewTitles[view]}</h1>
              <p className="mt-1 text-sm text-zinc-500">{getViewSubtitle(view)}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6] sm:w-72"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar lead"
                  value={query}
                />
              </div>
              {(view === "pipeline" || view === "leads") && (
                <>
                  <select
                    className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
                    onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}
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
                      setTemperatureFilter(event.target.value as Lead["temperature"] | "all")
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
                    onChange={(event) => setDateFilter(event.target.value as "all" | "today" | "overdue")}
                    value={dateFilter}
                  >
                    <option value="all">Todas datas</option>
                    <option value="today">Criados hoje</option>
                    <option value="overdue">Follow-up atrasado</option>
                  </select>
                  {view === "pipeline" && (
                    <>
                      <select
                        className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) return;
                          applyFilterPreset(event.target.value);
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
                        onClick={saveCurrentFilterPreset}
                        type="button"
                      >
                        Salvar filtro
                      </button>
                      <button
                        className="h-11 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => setPipelineStagesOpen(true)}
                        type="button"
                      >
                        Editar funil
                      </button>
                    </>
                  )}
                  <button
                    className="h-11 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                    onClick={exportFilteredLeads}
                    type="button"
                  >
                    Exportar CSV
                  </button>
                </>
              )}
              {view !== "settings" && (
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium transition hover:bg-[#7C3AED]"
                  onClick={() => {
                    setEditingLead(null);
                    setLeadFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Novo lead
                </button>
              )}
            </div>
          </header>

          <div className="p-5">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
              </div>
            ) : (
              <>
                {view === "dashboard" && (
                  <Dashboard
                    columns={visiblePipelineStages}
                    interactions={interactions}
                    leads={leads}
                    tasks={tasks}
                    onCompleteTask={completeTask}
                    onOpen={(lead) => setSelectedLeadId(lead.id)}
                    onQuickSchedule={(lead) => scheduleFollowup(lead, addDays(1))}
                    onQuickWhatsApp={(lead) => setSelectedLeadId(lead.id)}
                    onViewConversations={() => navigateView("conversations")}
                    whatsappLogs={whatsappLogs}
                    whatsappMessages={whatsappMessages}
                  />
                )}
                {view === "pipeline" && (
                  <Pipeline
                    bulkOwnerName={bulkOwnerName}
                    columns={visiblePipelineStages}
                    leads={filteredLeads}
                    onBulkArchive={() => void bulkArchiveSelectedLeads()}
                    onBulkAssignOwner={() => void bulkAssignOwner()}
                    onBulkMove={(status) => void bulkMoveSelectedLeads(status)}
                    onBulkSchedule={(days) => void bulkScheduleSelectedLeads(days)}
                    onBulkOwnerNameChange={setBulkOwnerName}
                    onClearSelection={() => setSelectedPipelineLeadIds(new Set())}
                    onLeadClick={(lead) => setSelectedLeadId(lead.id)}
                    onLeadDelete={(lead) => setLeadPendingDelete(lead)}
                    onQuickSchedule={(lead) => scheduleFollowup(lead, addDays(1))}
                    onQuickWhatsApp={(lead) => setSelectedLeadId(lead.id)}
                    onStatusChange={requestLeadStatusChange}
                    recentLeadId={recentLeadId}
                    selectedLeadIds={selectedPipelineLeadIds}
                    onToggleLeadSelection={togglePipelineLeadSelection}
                  />
                )}
                {view === "tasks" && (
                  <TasksView
                    leads={leads}
                    onCompleteTask={completeTask}
                    onOpenLead={(lead) => setSelectedLeadId(lead.id)}
                    onRescheduleTask={rescheduleTask}
                    tasks={tasks}
                  />
                )}
                {view === "leads" && (
                  <LeadList
                    leads={filteredLeads}
                    onEdit={(lead) => {
                      setEditingLead(lead);
                      setLeadFormOpen(true);
                    }}
                    onDelete={(lead) => setLeadPendingDelete(lead)}
                    onOpen={(lead) => setSelectedLeadId(lead.id)}
                  />
                )}
                {view === "conversations" && (
                  <Conversations
                    columns={visiblePipelineStages}
                    leads={leads}
                    templates={templates}
                    onAudit={recordAuditLog}
                    onLeadCreated={(lead) => {
                      setRemoteLeads((items) =>
                        items.some((item) => item.id === lead.id)
                          ? items.map((item) => (item.id === lead.id ? lead : item))
                          : [lead, ...items],
                      );
                    }}
                    onOpenLead={(lead) => {
                      setSelectedLeadId(lead.id);
                      navigateView("pipeline");
                    }}
                  />
                )}
                {view === "settings" && (
                  <SettingsView
                    archivedLeads={archivedLeads}
                    auditLogs={auditLogs}
                    initialTab={settingsInitialTab}
                    leads={leads}
                    onAddTemplate={addTemplate}
                    onDeleteTemplate={(template) => setTemplatePendingDelete(template)}
                    tasks={tasks}
                    templates={templates}
                    user={user}
                    whatsappLogs={whatsappLogs}
                    whatsappMessages={whatsappMessages}
                    onUnarchiveLead={(lead) => void unarchiveLead(lead)}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {leadFormOpen && (
        <LeadForm
          columns={visiblePipelineStages}
          lead={editingLead}
          onClose={() => setLeadFormOpen(false)}
          onSave={async (input) => {
            await saveLead(input, editingLead?.id);
            setLeadFormOpen(false);
          }}
        />
      )}

      {selectedLead && (
        <LeadDetails
          interactions={interactions.filter((item) => item.lead_id === selectedLead.id)}
          key={selectedLead.id}
          columns={visiblePipelineStages}
          lead={selectedLead}
          onAddInteraction={addInteraction}
          onCompleteTask={completeTask}
          onCreateTask={createTask}
          onClose={() => setSelectedLeadId(null)}
          onDelete={(lead) => setLeadPendingDelete(lead)}
          onScheduleFollowup={scheduleFollowup}
          onSend={sendWhatsApp}
          onSaveLead={(input) => saveLead(input, selectedLead.id)}
          onUpdateTemperature={updateLeadTemperature}
          tasks={tasks.filter((item) => item.lead_id === selectedLead.id)}
          templates={templates}
          whatsappMessages={whatsappMessages.filter(
            (message) =>
              message.lead_id === selectedLead.id ||
              normalizePhone(message.phone_number) === normalizePhone(selectedLead.phone),
          )}
        />
      )}
      {leadPendingDelete && (
        <ConfirmDeleteLead
          lead={leadPendingDelete}
          onCancel={() => setLeadPendingDelete(null)}
          onConfirm={() => void deleteLead(leadPendingDelete)}
        />
      )}
      {templatePendingDelete && (
        <ConfirmDeleteTemplate
          template={templatePendingDelete}
          onCancel={() => setTemplatePendingDelete(null)}
          onConfirm={() => void deleteTemplate(templatePendingDelete)}
        />
      )}
      {pipelineStagesOpen && (
        <PipelineStagesModal
          stages={pipelineStages}
          leads={leads}
          onAddStage={addPipelineStage}
          onClose={() => setPipelineStagesOpen(false)}
          onMoveStage={movePipelineStage}
          onRemoveStage={removePipelineStage}
          onRenameStage={renamePipelineStage}
          onUpdateStageKind={updatePipelineStageKind}
        />
      )}
    </main>
  );
}

function Dashboard({
  columns,
  leads,
  interactions,
  tasks,
  whatsappMessages,
  whatsappLogs,
  onCompleteTask,
  onOpen,
  onQuickWhatsApp,
  onQuickSchedule,
  onViewConversations,
}: {
  columns: PipelineStage[];
  leads: Lead[];
  interactions: Interaction[];
  tasks: Task[];
  whatsappMessages: WhatsAppMessage[];
  whatsappLogs: WhatsAppLog[];
  onCompleteTask: (task: Task, lead: Lead) => void;
  onOpen: (lead: Lead) => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
  onViewConversations: () => void;
}) {
  const [periodDays, setPeriodDays] = useState(7);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dashboardNow] = useState(() => Date.now());
  const [whatsappStatus, setWhatsappStatus] = useState<{
    connected: boolean;
    state: string;
    phoneNumber?: string | null;
    profileName?: string | null;
    error?: string;
  } | null>(null);
  const dashboardClosedStageIds = useMemo(
    () => new Set(columns.filter((column) => column.kind === "closed").map((column) => column.id)),
    [columns],
  );

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/evolution/status", { cache: "no-store" });
        const data = await response.json();
        if (!mounted) return;
        setWhatsappStatus({
          connected: Boolean(data.connected),
          state: data.state ?? "indefinido",
          phoneNumber: data.phoneNumber ?? null,
          profileName: data.profileName ?? null,
          error: data.error ?? (!response.ok ? "Nao foi possivel consultar a Evolution" : undefined),
        });
      } catch {
        if (mounted) {
          setWhatsappStatus({
            connected: false,
            state: "error",
            error: "Nao foi possivel consultar a Evolution",
          });
        }
      }
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const owners = useMemo(
    () =>
      Array.from(
        new Set(leads.map((lead) => lead.owner_name?.trim()).filter((item): item is string => Boolean(item))),
      ).sort((a, b) => a.localeCompare(b)),
    [leads],
  );
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const leadByPhone = useMemo(() => {
    const index = new Map<string, Lead>();
    for (const lead of leads) {
      for (const phone of getPhoneCandidates(lead.phone)) {
        if (!index.has(phone)) index.set(phone, lead);
      }
    }
    return index;
  }, [leads]);
  const operationalLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          !isLeadClosed(lead, dashboardClosedStageIds) &&
          (ownerFilter === "all" || lead.owner_name === ownerFilter),
      ),
    [dashboardClosedStageIds, leads, ownerFilter],
  );
  const openTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.status !== "open") return false;
        const lead = leadById.get(task.lead_id);
        return Boolean(lead) && (ownerFilter === "all" || lead?.owner_name === ownerFilter);
      }),
    [leadById, ownerFilter, tasks],
  );
  const taskAgenda: DashboardAgendaItem[] = useMemo(
    () =>
      openTasks
        .filter(isTaskDueToday)
        .map((task) => ({
          task,
          lead: leadById.get(task.lead_id) ?? null,
          dueAt: task.due_at,
          title: task.title,
        }))
        .filter((item): item is DashboardAgendaItem & { task: Task } => Boolean(item.lead)),
    [leadById, openTasks],
  );
  const taskAgendaLeadIds = useMemo(
    () => new Set(taskAgenda.map((item) => item.lead.id)),
    [taskAgenda],
  );
  const legacyAgenda: DashboardAgendaItem[] = useMemo(
    () =>
      operationalLeads
        .filter(
          (lead) =>
            Boolean(lead.next_followup_at) &&
            isFollowupDue(lead) &&
            !taskAgendaLeadIds.has(lead.id),
        )
        .map((lead) => ({
          lead,
          dueAt: lead.next_followup_at ?? "",
          title: "Follow-up pendente",
        })),
    [operationalLeads, taskAgendaLeadIds],
  );
  const todayAgenda = useMemo(
    () =>
      [...taskAgenda, ...legacyAgenda].sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
      ),
    [legacyAgenda, taskAgenda],
  );
  const overdueFollowups = useMemo(() => {
    const openTaskLeadIds = new Set(openTasks.map((task) => task.lead_id));
    return [
      ...openTasks.filter(isTaskOverdue),
      ...operationalLeads.filter(
        (lead) => isFollowupOverdue(lead) && !openTaskLeadIds.has(lead.id),
      ),
    ];
  }, [openTasks, operationalLeads]);
  const groupedMessages = useMemo(() => groupMessagesByPhone(whatsappMessages), [whatsappMessages]);
  const conversationsWithPendingReplies = useMemo(
    () => groupedMessages.filter((items) => countPendingInboundMessages(items) > 0),
    [groupedMessages],
  );
  const unlinkedConversations = useMemo(
    () =>
      groupedMessages.filter((items) => {
        const latestLeadId = [...items].reverse().find((message) => message.lead_id)?.lead_id;
        const phone = items[0]?.phone_number ?? "";
        const linkedLead = latestLeadId ? leadById.get(latestLeadId) : leadByPhone.get(normalizePhone(phone));
        return !linkedLead;
      }),
    [groupedMessages, leadById, leadByPhone],
  );
  const failedMessages = useMemo(
    () => whatsappMessages.filter((message) => message.status === "failed"),
    [whatsappMessages],
  );
  const hotLeadsWithoutAction = useMemo(
    () =>
      operationalLeads.filter(
        (lead) => (lead.temperature ?? "morno") === "quente" && !lead.next_followup_at,
      ),
    [operationalLeads],
  );
  const recentInboundMessages = useMemo(
    () => whatsappMessages.filter((message) => message.direction === "inbound").slice(0, 5),
    [whatsappMessages],
  );
  const recentErrors = useMemo(
    () => whatsappLogs.filter((log) => log.status === "error").slice(0, 4),
    [whatsappLogs],
  );
  const periodStart = dashboardNow - periodDays * 24 * 60 * 60 * 1000;
  const createdInPeriod = operationalLeads.filter((lead) => new Date(lead.created_at).getTime() >= periodStart).length;
  const repliesInPeriod = whatsappMessages.filter(
    (message) =>
      message.direction === "inbound" && new Date(message.created_at).getTime() >= periodStart,
  ).length;
  const contactsInPeriod = interactions.filter(
    (interaction) =>
      interaction.type === "whatsapp_sent" &&
      new Date(interaction.created_at).getTime() >= periodStart,
  ).length;
  const responseRate = contactsInPeriod ? Math.min(100, Math.round((repliesInPeriod / contactsInPeriod) * 100)) : 0;
  const openValue = operationalLeads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);
  const openProposals = operationalLeads.filter((lead) => lead.status === "proposta");
  const stuckProposals = operationalLeads.filter(
    (lead) =>
      lead.status === "proposta" &&
      dashboardNow - new Date(lead.updated_at).getTime() > 3 * 24 * 60 * 60 * 1000,
  );
  const noOwner = operationalLeads.filter((lead) => !lead.owner_name);
  const noNextContact = operationalLeads.filter(
    (lead) => lead.status !== "novo" && !lead.next_followup_at,
  );
  const lastWebhook = whatsappLogs[0] ?? null;
  const riskRows = [
    ...hotLeadsWithoutAction.slice(0, 2).map((lead) => ({ lead, reason: "Quente sem proxima acao" })),
    ...stuckProposals.slice(0, 2).map((lead) => ({ lead, reason: "Proposta parada ha 3+ dias" })),
    ...noOwner.slice(0, 2).map((lead) => ({ lead, reason: "Sem responsavel" })),
    ...noNextContact.slice(0, 2).map((lead) => ({ lead, reason: "Sem proximo contato" })),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.lead.id === item.lead.id) === index);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Central do dia</h2>
            <p className="mt-1 text-sm text-zinc-500">Prioridades comerciais, WhatsApp e riscos em uma unica fila de decisao.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setOwnerFilter(event.target.value)}
              value={ownerFilter}
            >
              <option value="all">Todos responsaveis</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setPeriodDays(Number(event.target.value))}
              value={periodDays}
            >
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DashboardPriorityCard description="Acoes fora do prazo" label="Follow-ups vencidos" value={overdueFollowups.length} tone="danger" />
        <DashboardPriorityCard description="Entradas que pedem resposta" label="Respostas novas" onClick={onViewConversations} value={conversationsWithPendingReplies.length} tone="success" />
        <DashboardPriorityCard description="Contatos para converter" label="Conversas sem lead" onClick={onViewConversations} value={unlinkedConversations.length} tone="warning" />
        <DashboardPriorityCard description="Saida bloqueada" label="Mensagens com falha" onClick={onViewConversations} value={failedMessages.length} tone="danger" />
        <DashboardPriorityCard description="Sem proximo passo" label="Quentes sem acao" value={hotLeadsWithoutAction.length} tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Agenda de hoje</h2>
              <p className="mt-1 text-sm text-zinc-500">Atrasados primeiro, depois proximos contatos do dia.</p>
            </div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">
              {todayAgenda.length}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {todayAgenda.length === 0 && (
              <DashboardEmpty text="Nenhum follow-up vencido ou agendado para hoje." />
            )}
            {todayAgenda.slice(0, 6).map((item) => {
              const task = item.task;

              return (
                <DashboardLeadRow
                  dueAt={item.dueAt}
                  key={task?.id ?? `${item.lead.id}-${item.dueAt}`}
                  lead={item.lead}
                  onCompleteTask={task ? () => onCompleteTask(task, item.lead) : undefined}
                  onOpen={() => onOpen(item.lead)}
                  onQuickSchedule={() => onQuickSchedule(item.lead)}
                  onQuickWhatsApp={() => onQuickWhatsApp(item.lead)}
                  title={item.title}
                />
              );
            })}
          </div>
        </section>

        <DashboardWhatsAppHealth
          failedMessages={failedMessages.length}
          lastWebhook={lastWebhook}
          onViewConversations={onViewConversations}
          recentErrors={recentErrors}
          recentInboundMessages={recentInboundMessages}
          status={whatsappStatus}
          unlinkedConversations={unlinkedConversations.length}
          unreadConversations={conversationsWithPendingReplies.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            Riscos comerciais
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <DashboardCompactMetric label="Leads quentes sem proxima acao" value={hotLeadsWithoutAction.length} />
            <DashboardCompactMetric label="Propostas paradas ha 3+ dias" value={stuckProposals.length} />
            <DashboardCompactMetric label="Leads sem responsavel" value={noOwner.length} />
            <DashboardCompactMetric label="Leads ativos sem proximo contato" value={noNextContact.length} />
          </div>
          <div className="mt-4 space-y-2">
            {riskRows.length === 0 && <DashboardEmpty text="Nenhum risco comercial critico para este filtro." />}
            {riskRows.slice(0, 5).map(({ lead, reason }) => (
              <DashboardRiskLeadRow
                key={lead.id}
                lead={lead}
                onOpen={() => onOpen(lead)}
                onQuickSchedule={() => onQuickSchedule(lead)}
                reason={reason}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Performance leve</h2>
          <p className="mt-1 text-sm text-zinc-500">Periodo selecionado e carteira aberta.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DashboardCompactMetric label="Leads criados" value={createdInPeriod} />
            <DashboardCompactMetric label="Respostas" value={repliesInPeriod} />
            <DashboardCompactMetric label="Contatos" value={contactsInPeriod} />
            <DashboardCompactMetric label="Taxa de resposta" value={`${responseRate}%`} />
            <DashboardCompactMetric label="Valor aberto" value={formatCurrency(openValue) ?? "R$ 0"} />
            <DashboardCompactMetric label="Propostas abertas" value={openProposals.length} />
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardPriorityCard({
  label,
  value,
  tone,
  description,
  onClick,
}: {
  label: string;
  value: number;
  tone: "danger" | "success" | "warning";
  description: string;
  onClick?: () => void;
}) {
  const toneClass = {
    danger: "border-red-400/25 bg-red-500/10 text-red-200",
    success: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]",
    warning: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  }[tone];
  const Element = onClick ? "button" : "div";

  return (
    <Element
      className={`rounded-lg border p-4 text-left transition ${toneClass} ${onClick ? "hover:brightness-110" : ""}`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <div className="text-xs uppercase text-current/70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-current/70">{description}</div>
    </Element>
  );
}

function DashboardCompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function DashboardWhatsAppHealth({
  status,
  lastWebhook,
  recentErrors,
  recentInboundMessages,
  unreadConversations,
  unlinkedConversations,
  failedMessages,
  onViewConversations,
}: {
  status: {
    connected: boolean;
    state: string;
    phoneNumber?: string | null;
    profileName?: string | null;
    error?: string;
  } | null;
  lastWebhook: WhatsAppLog | null;
  recentErrors: WhatsAppLog[];
  recentInboundMessages: WhatsAppMessage[];
  unreadConversations: number;
  unlinkedConversations: number;
  failedMessages: number;
  onViewConversations: () => void;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Saude do WhatsApp</h2>
          <p className="mt-1 text-sm text-zinc-500">Status da Evolution, inbox e ultimas entradas.</p>
        </div>
        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
          onClick={onViewConversations}
          type="button"
        >
          Abrir inbox
        </button>
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-400">Evolution</span>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              status?.connected
                ? "bg-[#25D366]/10 text-[#9AF0B8]"
                : "bg-red-500/10 text-red-200"
            }`}
          >
            {status?.connected ? "Conectado" : "Desconectado"}
          </span>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          {status?.phoneNumber || status?.profileName || status?.state || "Consultando status..."}
        </div>
        {status?.error && <div className="mt-2 text-xs text-red-300">{status.error}</div>}
        <div className="mt-3 text-xs text-zinc-500">
          Ultimo webhook:{" "}
          {lastWebhook ? new Date(lastWebhook.created_at).toLocaleString("pt-BR") : "sem registro"}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <DashboardCompactMetric label="Nao lidas" value={unreadConversations} />
        <DashboardCompactMetric label="Sem lead" value={unlinkedConversations} />
        <DashboardCompactMetric label="Falhas de mensagem" value={failedMessages} />
      </div>
      <div className="mt-4 space-y-3">
        {recentInboundMessages.length === 0 && <DashboardEmpty text="Nenhuma mensagem recebida recentemente." />}
        {recentInboundMessages.map((message) => (
          <button
            className="w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:bg-white/[0.05]"
            key={message.id}
            onClick={onViewConversations}
            type="button"
          >
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{message.contact_name || message.phone_number}</span>
              <span>
                {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-300">
              {message.content || "Mensagem sem texto"}
            </p>
          </button>
        ))}
      </div>
      {recentErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3">
          <div className="text-xs font-medium text-red-200">Erros recentes da Evolution</div>
          <div className="mt-2 space-y-1">
            {recentErrors.slice(0, 2).map((log) => (
              <div className="truncate text-xs text-red-100/80" key={log.id}>
                {log.error_message || log.event_type}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
      {text}
    </div>
  );
}

function DashboardLeadRow({
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

function DashboardRiskLeadRow({
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

function TasksView({
  tasks,
  leads,
  onOpenLead,
  onCompleteTask,
  onRescheduleTask,
}: {
  tasks: Task[];
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead) => void;
  onRescheduleTask: (task: Task, lead: Lead, dueAt: string) => void;
}) {
  const [scope, setScope] = useState<TaskScope>("open");
  const [owner, setOwner] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const owners = Array.from(
    new Set(leads.map((lead) => lead.owner_name?.trim()).filter((item): item is string => Boolean(item))),
  ).sort((a, b) => a.localeCompare(b));
  const taskRows = tasks
    .map((task) => ({ task, lead: leads.find((lead) => lead.id === task.lead_id) ?? null }))
    .filter((item): item is { task: Task; lead: Lead } => Boolean(item.lead))
    .filter(({ task, lead }) => {
      if (owner !== "all" && lead.owner_name !== owner) return false;
      if (scope === "completed") return task.status === "completed";
      if (task.status !== "open") return false;
      if (scope === "overdue") return isTaskOverdue(task);
      if (scope === "today") return isTaskDueOnDate(task, new Date());
      if (scope === "upcoming") return new Date(task.due_at).getTime() > endOfDay(new Date()).getTime();
      return true;
    })
    .sort((a, b) => new Date(a.task.due_at).getTime() - new Date(b.task.due_at).getTime());
  const selectedRows = taskRows.filter(({ task }) => selectedIds.has(task.id));
  const counts = {
    open: tasks.filter((task) => task.status === "open").length,
    overdue: tasks.filter((task) => task.status === "open" && isTaskOverdue(task)).length,
    today: tasks.filter((task) => task.status === "open" && isTaskDueOnDate(task, new Date())).length,
    upcoming: tasks.filter((task) => task.status === "open" && new Date(task.due_at).getTime() > endOfDay(new Date()).getTime()).length,
    completed: tasks.filter((task) => task.status === "completed").length,
  };

  function toggleTask(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkReschedule(days: number) {
    for (const { task, lead } of selectedRows) {
      onRescheduleTask(task, lead, addDays(days));
    }
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        {([
          ["open", "Abertas"],
          ["overdue", "Vencidas"],
          ["today", "Hoje"],
          ["upcoming", "Proximas"],
          ["completed", "Concluidas"],
        ] as Array<[TaskScope, string]>).map(([key, label]) => (
          <button
            className={`rounded-lg border p-4 text-left transition ${
              scope === key
                ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/15"
                : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
            }`}
            key={key}
            onClick={() => setScope(key)}
            type="button"
          >
            <div className="text-xs uppercase text-zinc-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{counts[key]}</div>
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Controle de agenda</h2>
            <p className="mt-1 text-sm text-zinc-500">Conclua, abra o lead ou reagende proximas acoes.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setOwner(event.target.value)}
              value={owner}
            >
              <option value="all">Todos responsaveis</option>
              {owners.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-50"
              disabled={selectedRows.length === 0}
              onClick={() => bulkReschedule(1)}
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
              Reagendar selecionadas
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {taskRows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">Nenhuma tarefa encontrada para este filtro.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {taskRows.map(({ task, lead }) => {
                const due = getDueAtLabel(task.due_at);
                return (
                  <div className="grid gap-3 bg-black/20 p-4 lg:grid-cols-[auto_1.4fr_1fr_auto] lg:items-center" key={task.id}>
                    <input
                      checked={selectedIds.has(task.id)}
                      className="mt-1 h-4 w-4 accent-[#8B5CF6] lg:mt-0"
                      onChange={() => toggleTask(task.id)}
                      type="checkbox"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                          {taskTypeLabel(task.type)}
                        </span>
                        <span className="font-medium text-zinc-100">{task.title}</span>
                      </div>
                      <button
                        className="mt-1 text-left text-sm text-zinc-500 transition hover:text-zinc-200"
                        onClick={() => onOpenLead(lead)}
                        type="button"
                      >
                        {lead.name} · {lead.company || "Sem empresa"}
                      </button>
                    </div>
                    <div>
                      <div className={`text-sm ${due.tone}`}>{due.text}</div>
                      <div className="mt-1 text-xs text-zinc-500">{lead.owner_name || "Sem responsavel"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => onOpenLead(lead)}
                        type="button"
                      >
                        Abrir
                      </button>
                      {task.status === "open" && (
                        <>
                          <button
                            className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
                            onClick={() => onRescheduleTask(task, lead, addDays(1))}
                            type="button"
                          >
                            Amanha
                          </button>
                          <button
                            className="h-9 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                            onClick={() => onCompleteTask(task, lead)}
                            type="button"
                          >
                            Concluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function groupMessagesByPhone(messages: WhatsAppMessage[]) {
  const grouped = new Map<string, WhatsAppMessage[]>();
  for (const message of [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )) {
    grouped.set(message.phone_number, [...(grouped.get(message.phone_number) ?? []), message]);
  }
  return Array.from(grouped.values());
}

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
    description: "Leads que ja responderam",
    empty: "Nenhuma resposta registrada",
  },
  proposta: {
    accent: "bg-amber-400",
    description: "Negociacoes com proposta enviada",
    empty: "Nenhuma proposta ativa",
  },
  fechado: {
    accent: "bg-zinc-300",
    description: "Oportunidades concluidas",
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

function Pipeline({
  leads,
  columns,
  recentLeadId,
  selectedLeadIds,
  bulkOwnerName,
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
  columns: PipelineStage[];
  recentLeadId: string | null;
  selectedLeadIds: Set<string>;
  bulkOwnerName: string;
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
                leads={columnLeads}
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

function PipelineBulkActions({
  selectedCount,
  columns,
  bulkOwnerName,
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
  onOwnerNameChange: (value: string) => void;
  onAssignOwner: () => void;
  onMove: (status: LeadStatus) => void;
  onSchedule: (days: number) => void;
  onArchive: () => void;
  onClear: () => void;
}) {
  const disabled = selectedCount === 0;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-100">{selectedCount}</span> selecionados
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
          <select
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6] disabled:opacity-50"
            defaultValue=""
            disabled={disabled}
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
            Follow-up amanha
          </button>
          <div className="flex min-w-0 gap-2">
            <input
              className="h-10 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6] disabled:opacity-50"
              disabled={disabled}
              onChange={(event) => onOwnerNameChange(event.target.value)}
              placeholder="Responsavel"
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
            disabled={disabled}
            onClick={onArchive}
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

function PipelineStagesModal({
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
                className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 xl:grid-cols-[auto_1fr_auto_auto_auto] xl:items-center"
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
                  className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => onRenameStage(stage.id, event.target.value)}
                  value={stage.title}
                />
                <select
                  className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => onUpdateStageKind(stage.id, event.target.value as NonNullable<PipelineStage["kind"]>)}
                  value={stage.kind ?? "open"}
                >
                  <option value="open">Em aberto</option>
                  <option value="closed">Conclusao</option>
                </select>
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-500">
                  {count} leads
                </span>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                  disabled={!canRemove}
                  onClick={() => onRemoveStage(stage.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
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

function PipelineOverview({ leads, closedStageIds }: { leads: Lead[]; closedStageIds: Set<LeadStatus> }) {
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
    <div className={`rounded-xl border ${tone} bg-white/[0.035] p-4`}>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function isLeadClosed(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  return closedStageIds.has(lead.status);
}

function isFollowupDue(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.next_followup_at || isLeadClosed(lead, closedStageIds)) return false;
  const dueAt = new Date(lead.next_followup_at);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

function isFollowupOverdue(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.next_followup_at || isLeadClosed(lead, closedStageIds)) return false;
  return new Date(lead.next_followup_at).getTime() < startOfDay(new Date()).getTime();
}

function isTaskDueToday(task: Task) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

function isTaskDueOnDate(task: Task, date: Date) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return startOfDay(dueAt).getTime() === startOfDay(date).getTime();
}

function isTaskOverdue(task: Task) {
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  return dueAt.getTime() < startOfDay(new Date()).getTime();
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isLeadCreatedToday(lead: Lead) {
  return startOfDay(new Date(lead.created_at)).getTime() === startOfDay(new Date()).getTime();
}

function getFollowupLabel(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (isLeadClosed(lead, closedStageIds)) return { text: "Concluido", tone: "text-zinc-500" };
  if (!lead.next_followup_at) return { text: "Sem follow-up", tone: "text-zinc-500" };

  const dueAt = new Date(lead.next_followup_at);
  const today = new Date();
  const diffDays = Math.ceil(
    (startOfDay(dueAt).getTime() - startOfDay(today).getTime()) / 86400000,
  );

  if (diffDays < 0) return { text: "Follow-up atrasado", tone: "text-red-300" };
  if (diffDays === 0) return { text: "Follow-up hoje", tone: "text-amber-300" };
  if (diffDays === 1) return { text: "Follow-up amanha", tone: "text-[#25D366]" };
  return {
    text: `Follow-up ${dueAt.toLocaleDateString("pt-BR")}`,
    tone: "text-zinc-400",
  };
}

function getDueAtLabel(value: string) {
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return { text: "Data invalida", tone: "text-red-300" };

  const today = new Date();
  const diffDays = Math.ceil(
    (startOfDay(dueAt).getTime() - startOfDay(today).getTime()) / 86400000,
  );
  const time = dueAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (diffDays < 0) return { text: `Atrasado desde ${dueAt.toLocaleDateString("pt-BR")}`, tone: "text-red-300" };
  if (diffDays === 0) return { text: `Hoje as ${time}`, tone: "text-amber-300" };
  if (diffDays === 1) return { text: `Amanha as ${time}`, tone: "text-[#25D366]" };
  return {
    text: `${dueAt.toLocaleDateString("pt-BR")} as ${time}`,
    tone: "text-zinc-400",
  };
}

function taskTypeLabel(type: Task["type"]) {
  if (type === "followup") return "Follow-up";
  if (type === "call") return "Ligacao";
  if (type === "email") return "Email";
  if (type === "whatsapp") return "WhatsApp";
  if (type === "meeting") return "Reuniao";
  return "Outro";
}

function getLastContactLabel(lead: Lead) {
  if (!lead.last_contact_at) return "Sem contato";

  const contactedAt = new Date(lead.last_contact_at);
  const today = new Date();
  const diffDays = Math.floor(
    (startOfDay(today).getTime() - startOfDay(contactedAt).getTime()) / 86400000,
  );

  if (diffDays <= 0) return "Contato hoje";
  if (diffDays === 1) return "Contato ontem";
  return `Contato ha ${diffDays} dias`;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatPhoneCompact(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return normalized || phone;
  return `${normalized.slice(0, -4)}-${normalized.slice(-4)}`;
}

function getLeadInitials(lead: Lead) {
  return lead.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getColumnHealth(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  const due = leads.filter((lead) => isFollowupDue(lead, closedStageIds)).length;
  if (due > 0) return `${due} com follow-up`;
  return leads.length ? "Em dia" : "Sem itens";
}

function getPipelineColumnStats(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  const value = leads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);
  const overdue = leads.filter((lead) => isFollowupOverdue(lead, closedStageIds)).length;
  const hot = leads.filter((lead) => (lead.temperature ?? "morno") === "quente").length;
  const noAction = leads.filter(
    (lead) => !isLeadClosed(lead, closedStageIds) && lead.status !== "novo" && !lead.next_followup_at,
  ).length;

  return { value, overdue, hot, noAction };
}

function getLeadUrgencyScore(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  let score = 0;
  if (isFollowupOverdue(lead, closedStageIds)) score += 100;
  else if (isFollowupDue(lead, closedStageIds)) score += 70;
  if ((lead.temperature ?? "morno") === "quente") score += 35;
  if (lead.status === "proposta") score += 20;
  if (!isLeadClosed(lead, closedStageIds) && lead.status !== "novo" && !lead.next_followup_at) score += 25;
  if (!lead.owner_name) score += 8;
  return score;
}

function sortPipelineLeadsByUrgency(leads: Lead[], closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  return [...leads].sort((a, b) => {
    const scoreDiff = getLeadUrgencyScore(b, closedStageIds) - getLeadUrgencyScore(a, closedStageIds);
    if (scoreDiff !== 0) return scoreDiff;

    const nextFollowupA = a.next_followup_at ? new Date(a.next_followup_at).getTime() : Number.MAX_SAFE_INTEGER;
    const nextFollowupB = b.next_followup_at ? new Date(b.next_followup_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (nextFollowupA !== nextFollowupB) return nextFollowupA - nextFollowupB;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function getSourceLabel(source: string) {
  return source?.trim() || "Origem nao informada";
}

function formatCurrency(value?: number | null) {
  if (!value) return null;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function leadToInput(lead: Lead): LeadInput {
  return {
    name: lead.name,
    phone: lead.phone,
    company: lead.company,
    source: lead.source,
    status: lead.status,
    estimated_value: lead.estimated_value ?? null,
    owner_name: lead.owner_name ?? "",
    temperature: lead.temperature ?? "morno",
    outcome_reason: lead.outcome_reason ?? "",
    sla_hours: lead.sla_hours ?? 24,
  };
}

function getTemperatureLabel(temperature?: Lead["temperature"] | null) {
  if (temperature === "quente") return { text: "Quente", tone: "border-red-400/25 bg-red-500/10 text-red-200" };
  if (temperature === "frio") return { text: "Frio", tone: "border-sky-400/25 bg-sky-500/10 text-sky-200" };
  return { text: "Morno", tone: "border-amber-400/25 bg-amber-500/10 text-amber-100" };
}

function getSlaLabel(lead: Lead, closedStageIds: Set<LeadStatus> = defaultClosedStageIds) {
  if (!lead.last_contact_at || !lead.sla_hours || isLeadClosed(lead, closedStageIds)) return null;

  const expiresAt = new Date(lead.last_contact_at).getTime() + lead.sla_hours * 60 * 60 * 1000;
  const remainingHours = Math.ceil((expiresAt - Date.now()) / 3600000);

  if (remainingHours < 0) return { text: "SLA vencido", tone: "text-red-300" };
  if (remainingHours <= 4) return { text: `SLA ${remainingHours}h`, tone: "text-amber-300" };
  return { text: `SLA ${remainingHours}h`, tone: "text-zinc-500" };
}

function PipelineColumn({
  id,
  title,
  leads,
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

  return (
    <div
      className={`w-[300px] shrink-0 overflow-hidden rounded-lg border transition ${
        isOver ? "border-[#8B5CF6] bg-[#8B5CF6]/10" : "border-white/10 bg-white/[0.025]"
      }`}
      ref={setNodeRef}
    >
      <div className="border-b border-white/10 px-3 py-3">
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
        </div>
      </div>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[320px] space-y-3 p-3">
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              highlighted={recentLeadId === lead.id}
              lead={lead}
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
  columns?: PipelineStage[];
  closedStageIds?: Set<LeadStatus>;
  onClick: () => void;
  onDelete?: () => void;
  selected?: boolean;
  dragging?: boolean;
  highlighted?: boolean;
  showQuickActions?: boolean;
  onStatusChange?: (status: LeadStatus) => void;
  onToggleSelection?: () => void;
  onQuickWhatsApp?: () => void;
  onQuickSchedule?: () => void;
}) {
  const temperature = getTemperatureLabel(lead.temperature);
  const value = formatCurrency(lead.estimated_value);
  const sla = getSlaLabel(lead, closedStageIds);
  const followup = getFollowupLabel(lead, closedStageIds);
  const isOverdue = followup.text === "Follow-up atrasado";
  const isClosed = isLeadClosed(lead, closedStageIds);

  function quick(event: MouseEvent<HTMLButtonElement>, action?: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  }

  return (
    <div
      className={`group relative w-full rounded-lg border bg-[#121119] p-3 text-left shadow-lg shadow-black/10 transition hover:border-[#8B5CF6]/60 ${
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
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-white/10">
        <div
          className={`h-full rounded-t-lg ${
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
            {lead.company || "Sem empresa"} / {lead.owner_name || "Sem responsavel"}
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

function LeadList({
  leads,
  onOpen,
  onEdit,
  onDelete,
}: {
  leads: Lead[];
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

function Templates({
  templates,
  onAddTemplate,
  onDeleteTemplate,
}: {
  templates: MessageTemplate[];
  onAddTemplate: (title: string, body: string) => void;
  onDeleteTemplate: (template: MessageTemplate) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <form
        className="rounded-xl border border-white/10 bg-white/[0.035] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onAddTemplate(title, body);
          setTitle("");
          setBody("");
        }}
      >
        <h2 className="text-lg font-semibold">Nova mensagem pronta</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Variaveis: {"{{nome}}, {{empresa}}, {{telefone}}, {{origem}}"}
        </p>
        <input
          className="mt-4 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none transition focus:border-[#8B5CF6]"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo"
          required
          value={title}
        />
        <textarea
          className="mt-3 min-h-36 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#8B5CF6]"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Mensagem"
          required
          value={body}
        />
        <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] text-sm font-medium">
          <Plus className="h-4 w-4" />
          Salvar mensagem
        </button>
      </form>
      <div className="grid gap-3">
        {templates.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-zinc-500">
            Nenhuma mensagem pronta cadastrada.
          </div>
        )}
        {templates.map((template) => (
          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-5" key={template.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{template.title}</h3>
              <button
                className="rounded-md border border-red-400/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                onClick={() => onDeleteTemplate(template)}
                title="Excluir mensagem pronta"
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{template.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

type ConversationStatusFilter = "all" | "unread" | "waiting" | "responded" | "converted" | "resolved" | "archived";
type ConversationLeadFilter = "all" | "without" | "with";
type ConversationPriorityFilter = "all" | "failed" | "hot" | "unassigned" | "today";
type ConversationSort = "recent" | "unread" | "oldestWaiting" | "hot";
type ConversationStatus = Exclude<ConversationStatusFilter, "all">;
type ConversationCounts = {
  all: number;
  unread: number;
  waiting: number;
  responded: number;
  converted: number;
  resolved: number;
  archived: number;
};

const conversationStatusTabs: Array<{
  id: ConversationStatusFilter;
  label: string;
  countKey: keyof ConversationCounts;
}> = [
  { id: "all", label: "Todas", countKey: "all" },
  { id: "unread", label: "Nao lidas", countKey: "unread" },
  { id: "waiting", label: "Aguardando", countKey: "waiting" },
  { id: "responded", label: "Respondidas", countKey: "responded" },
  { id: "converted", label: "Convertidas", countKey: "converted" },
  { id: "resolved", label: "Resolvidas", countKey: "resolved" },
  { id: "archived", label: "Arquivadas", countKey: "archived" },
];

function Conversations({
  columns,
  leads,
  templates,
  onAudit,
  onLeadCreated,
  onOpenLead,
}: {
  columns: PipelineStage[];
  leads: Lead[];
  templates: MessageTemplate[];
  onAudit: (input: AuditLogInput) => Promise<void>;
  onLeadCreated: (lead: Lead) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [storedConversations, setStoredConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("all");
  const [leadFilter, setLeadFilter] = useState<ConversationLeadFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<ConversationPriorityFilter>("all");
  const [sortMode, setSortMode] = useState<ConversationSort>("recent");
  const [readPhones, setReadPhones] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [conversationActionLoading, setConversationActionLoading] = useState<"resolved" | "archived" | null>(null);
  const [replyMoveStatus, setReplyMoveStatus] = useState<LeadStatus>("");
  const [replyFollowupDays, setReplyFollowupDays] = useState("");
  const [actionError, setActionError] = useState("");
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    Promise.all([
      supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: true }),
      supabase.from("whatsapp_conversations").select("*").order("updated_at", { ascending: false }),
    ]).then(([messageResult, conversationResult]) => {
        if (!mounted) return;
        setMessages((messageResult.data as WhatsAppMessage[] | null) ?? []);
        setStoredConversations((conversationResult.data as WhatsAppConversation[] | null) ?? []);
        setLoading(false);
      });

    const messageChannel = supabase
      .channel("whatsapp-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const nextMessage = payload.new as WhatsAppMessage;
          if (
            payload.eventType === "INSERT" &&
            nextMessage?.direction === "inbound" &&
            nextMessage.phone_number !== selectedPhone
          ) {
            setReadPhones((current) => {
              if (!current.has(nextMessage.phone_number)) return current;
              const next = new Set(current);
              next.delete(nextMessage.phone_number);
              return next;
            });
          }
          setMessages((current) => applyMessageRealtimeEvent(current, payload));
        },
      )
      .subscribe();
    const conversationChannel = supabase
      .channel("whatsapp-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          setStoredConversations((current) => applyConversationRealtimeEvent(current, payload));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(conversationChannel);
    };
  }, [selectedPhone, supabase]);

  const conversations = useMemo(() => {
    const grouped = new Map<string, WhatsAppMessage[]>();

    for (const message of messages) {
      const key = message.phone_number;
      grouped.set(key, [...(grouped.get(key) ?? []), message]);
    }

    return Array.from(grouped.entries())
      .map(([phone, items]) => {
        const lastMessage = items[items.length - 1];
        const linkedLeadId = [...items].reverse().find((item) => item.lead_id)?.lead_id;
        const storedConversation = storedConversations.find((item) => item.phone_number === phone);
        const lead = leads.find((item) => item.id === (storedConversation?.lead_id ?? linkedLeadId));
        const existingLead = lead ?? findLeadByPhone(leads, phone);
        const activeLead = lead ?? existingLead;
        const contactMessage = [...items].reverse().find((item) => item.contact_name);
        const avatarMessage = [...items].reverse().find((item) => item.contact_avatar_url);
        const contactName = lead?.name ?? existingLead?.name ?? storedConversation?.contact_name ?? contactMessage?.contact_name ?? phone;
        const pendingInbound = countPendingInboundMessages(items);
        const unreadCount = readPhones.has(phone) ? 0 : Math.max(pendingInbound, storedConversation?.unread_count ?? 0);
        const status = conversationStatus(lastMessage.direction, Boolean(lead), unreadCount, storedConversation?.status);
        const failedCount = items.filter((item) => item.status === "failed").length;
        return {
          phone,
          lead,
          existingLead,
          activeLead,
          storedConversation,
          messages: items,
          lastMessage,
          contactName,
          avatarUrl: storedConversation?.contact_avatar_url ?? avatarMessage?.contact_avatar_url ?? null,
          unreadCount,
          pendingInbound,
          failedCount,
          status,
          statusLabel: conversationStatusLabel(status),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime(),
      );
  }, [messages, leads, readPhones, storedConversations]);

  const conversationCounts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((conversation) => conversation.status === "unread").length,
      waiting: conversations.filter((conversation) => conversation.status === "waiting").length,
      responded: conversations.filter((conversation) => conversation.status === "responded").length,
      converted: conversations.filter((conversation) => conversation.status === "converted").length,
      resolved: conversations.filter((conversation) => conversation.status === "resolved").length,
      archived: conversations.filter((conversation) => conversation.status === "archived").length,
    }),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const search = conversationQuery.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        const activeLead = conversation.activeLead;
        const matchesStatus = statusFilter === "all" || conversation.status === statusFilter;
        const matchesLead =
          leadFilter === "all" ||
          (leadFilter === "without" && !conversation.lead && !conversation.existingLead) ||
          (leadFilter === "with" && Boolean(conversation.lead || conversation.existingLead));
        const matchesPriority =
          priorityFilter === "all" ||
          (priorityFilter === "failed" && conversation.failedCount > 0) ||
          (priorityFilter === "hot" && activeLead?.temperature === "quente") ||
          (priorityFilter === "unassigned" && Boolean(activeLead) && !activeLead?.owner_name) ||
          (priorityFilter === "today" && isSameDay(conversation.lastMessage.created_at, new Date()));
        const matchesSearch =
          !search ||
          [
            conversation.contactName,
            conversation.phone,
            activeLead?.company ?? "",
            activeLead?.source ?? "",
            ...conversation.messages.map((message) => getWhatsAppMessageDisplay(message)),
          ].some((value) => value.toLowerCase().includes(search));

        return matchesStatus && matchesLead && matchesPriority && matchesSearch;
      })
      .sort((a, b) => sortConversations(a, b, sortMode));
  }, [conversationQuery, conversations, leadFilter, priorityFilter, sortMode, statusFilter]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.phone === selectedPhone) ??
    filteredConversations[0] ??
    conversations[0];
  const selectedConversationLead = selectedConversation?.activeLead ?? null;
  const filteredTemplates = useMemo(() => {
    const search = templateQuery.trim().toLowerCase();
    if (!search) return templates;
    return templates.filter((template) =>
      [template.title, template.body].some((value) => value.toLowerCase().includes(search)),
    );
  }, [templateQuery, templates]);

  const markConversationAsRead = useCallback(
    (phone: string, status: WhatsAppConversation["status"] = "responded") => {
      setReadPhones((current) => {
        if (current.has(phone)) return current;
        const next = new Set(current);
        next.add(phone);
        return next;
      });

      if (supabase) {
        void supabase
          .from("whatsapp_conversations")
          .update({
            unread_count: 0,
            last_read_at: new Date().toISOString(),
            status,
          })
          .eq("phone_number", phone);
      }
    },
    [supabase],
  );

  function selectConversation(phone: string) {
    setSelectedPhone(phone);
    const conversation = conversations.find((item) => item.phone === phone);
    const currentStatus = conversation?.status;
    if (currentStatus === "archived" || currentStatus === "resolved") return;
    markConversationAsRead(phone, conversation?.lead ? "converted" : "responded");
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template || !selectedConversation) return;

    const virtualLead: Lead = selectedConversationLead ?? {
      id: "",
      name: selectedConversation.contactName,
      phone: selectedConversation.phone,
      company: "",
      source: "WhatsApp",
      status: "novo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const rendered = renderTemplate(template.body, virtualLead);
    setReplyText((current) => (current.trim() ? `${current.trim()}\n${rendered}` : rendered));
  }

  async function sendReply(body: string) {
    if (!selectedConversation || !body.trim()) return;

    setActionError("");
    setSending(true);
    const nextFollowupAt = replyFollowupDays
      ? addDays(Number(replyFollowupDays))
      : null;
    const result = await sendWhatsAppConversationMessage(
      selectedConversation.phone,
      body.trim(),
      selectedConversationLead?.id ?? null,
      {
        nextFollowupAt,
        moveStatus: replyMoveStatus || null,
      },
    );
    setSending(false);

    if (!result.success) {
      setActionError(result.error ?? "Nao foi possivel enviar a mensagem");
      await onAudit({
        entity_type: "whatsapp",
        entity_id: selectedConversationLead?.id ?? null,
        action: "whatsapp.message_failed",
        summary: `Falha ao enviar mensagem para ${selectedConversation.contactName}`,
        metadata: { phone: selectedConversation.phone },
      });
      return;
    }

    setReplyText("");
    setReplyFollowupDays("");
    setReplyMoveStatus("");
    if (result.lead) onLeadCreated(result.lead);
    if (result.message) {
      setMessages((current) => applyMessageRealtimeEvent(current, {
        eventType: "INSERT",
        new: result.message as unknown as Record<string, unknown>,
        old: {},
      }));
    }
    markConversationAsRead(selectedConversation.phone, selectedConversationLead ? "converted" : "responded");
    await onAudit({
      entity_type: "whatsapp",
      entity_id: selectedConversationLead?.id ?? null,
      action: "whatsapp.message_sent",
      summary: `Mensagem enviada para ${selectedConversation.contactName}`,
      metadata: {
        phone: selectedConversation.phone,
        lead_id: selectedConversationLead?.id ?? null,
        move_status: replyMoveStatus || null,
        followup_days: replyFollowupDays || null,
      },
    });
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendReply(replyText);
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleSaveLead(input: {
    name: string;
    company: string;
    source: string;
    status: LeadStatus;
    temperature: NonNullable<Lead["temperature"]>;
    ownerName: string;
    nextFollowupAt: string;
  }) {
    if (!selectedConversation || selectedConversation.lead) return;

    setActionError("");
    setSavingLead(true);
    const result = await saveWhatsAppConversationAsLead({
      phoneNumber: selectedConversation.phone,
      leadId: selectedConversation.existingLead?.id ?? null,
      name: input.name,
      company: input.company,
      source: input.source,
      status: input.status,
      temperature: input.temperature,
      ownerName: input.ownerName,
      nextFollowupAt: input.nextFollowupAt ? new Date(input.nextFollowupAt).toISOString() : null,
    });
    setSavingLead(false);

    if (!result.success || !result.lead) {
      setActionError(result.error ?? "Nao foi possivel salvar o lead");
      return;
    }

    onLeadCreated(result.lead);
    await onAudit({
      entity_type: "whatsapp",
      entity_id: result.lead.id,
      action: selectedConversation.existingLead ? "whatsapp.conversation_linked" : "whatsapp.conversation_converted",
      summary: selectedConversation.existingLead
        ? `Conversa vinculada ao lead ${result.lead.name}`
        : `Conversa convertida em lead: ${result.lead.name}`,
      metadata: { phone: selectedConversation.phone, status: input.status, temperature: input.temperature },
    });
    setLeadModalOpen(false);
    setMessages((current) =>
      current.map((message) =>
        message.phone_number === selectedConversation.phone
          ? { ...message, lead_id: result.lead?.id ?? message.lead_id }
          : message,
      ),
    );
  }

  async function updateSelectedConversationStatus(status: "resolved" | "archived") {
    if (!selectedConversation) return;

    const previous = storedConversations;
    const now = new Date().toISOString();
    setActionError("");
    setConversationActionLoading(status);
    setStoredConversations((items) =>
      upsertLocalConversation(items, {
        id: selectedConversation.storedConversation?.id ?? newId("conversation"),
        user_id: selectedConversation.storedConversation?.user_id ?? "",
        lead_id: selectedConversationLead?.id ?? selectedConversation.storedConversation?.lead_id ?? null,
        phone_number: selectedConversation.phone,
        remote_jid: selectedConversation.storedConversation?.remote_jid ?? null,
        contact_name: selectedConversation.contactName,
        contact_avatar_url: selectedConversation.avatarUrl,
        status,
        unread_count: 0,
        last_message: getWhatsAppMessageDisplay(selectedConversation.lastMessage),
        last_message_direction: selectedConversation.lastMessage.direction,
        last_message_at: selectedConversation.lastMessage.created_at,
        last_read_at: now,
        created_at: selectedConversation.storedConversation?.created_at ?? now,
        updated_at: now,
      }),
    );

    const result = await updateWhatsAppConversationStatus(selectedConversation.phone, status);
    setConversationActionLoading(null);

    if (!result.success) {
      setStoredConversations(previous);
      setActionError(result.error ?? "Nao foi possivel atualizar a conversa");
      return;
    }

    await onAudit({
      entity_type: "whatsapp",
      entity_id: selectedConversationLead?.id ?? null,
      action: status === "resolved" ? "whatsapp.conversation_resolved" : "whatsapp.conversation_archived",
      summary: `${status === "resolved" ? "Conversa resolvida" : "Conversa arquivada"}: ${selectedConversation.contactName}`,
      metadata: { phone: selectedConversation.phone },
    });
  }

  async function updateConversationLeadStatus(status: LeadStatus) {
    if (!selectedConversationLead) return;

    setActionError("");
    const result = await updateLeadAction(selectedConversationLead.id, {
      status,
      name: selectedConversationLead.name,
      phone: selectedConversationLead.phone,
      company: selectedConversationLead.company,
      source: selectedConversationLead.source,
      estimated_value: selectedConversationLead.estimated_value ?? null,
      owner_name: selectedConversationLead.owner_name ?? "",
      temperature: selectedConversationLead.temperature ?? "morno",
      outcome_reason: selectedConversationLead.outcome_reason ?? "",
      sla_hours: selectedConversationLead.sla_hours ?? 24,
    });

    if (!result.success || !result.data) {
      setActionError(result.error ?? "Nao foi possivel mudar a etapa do lead");
      return;
    }

    const updatedLead = result.data as Lead;
    onLeadCreated(updatedLead);
    await onAudit({
      entity_type: "lead",
      entity_id: updatedLead.id,
      action: "lead.status_changed_from_inbox",
      summary: `Etapa alterada pela inbox: ${updatedLead.name}`,
      metadata: { previous_status: selectedConversationLead.status, next_status: status },
    });
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.035] p-8 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-zinc-500" />
        <h2 className="mt-4 text-lg font-semibold">Nenhuma conversa ainda</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Quando uma mensagem for enviada ou recebida pela Evolution, ela aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-[620px] overflow-hidden rounded-xl border border-white/10 bg-[#101018] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="flex min-h-0 flex-col border-b border-white/10 bg-white/[0.025] xl:border-b-0 xl:border-r">
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Inbox WhatsApp</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {conversationCounts.unread} nao lidas de {conversations.length} conversas
              </p>
            </div>
            <span className="rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2 py-1 text-xs text-[#25D366]">
              Tempo real
            </span>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-400">
            <Search className="h-4 w-4" />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-600"
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Buscar nome, telefone ou mensagem"
              value={conversationQuery}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-300 outline-none"
              onChange={(event) => setLeadFilter(event.target.value as ConversationLeadFilter)}
              value={leadFilter}
            >
              <option value="all">Todos os leads</option>
              <option value="without">Sem lead</option>
              <option value="with">Com lead</option>
            </select>
            <select
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-300 outline-none"
              onChange={(event) => setPriorityFilter(event.target.value as ConversationPriorityFilter)}
              value={priorityFilter}
            >
              <option value="all">Todas prioridades</option>
              <option value="failed">Com falha</option>
              <option value="hot">Lead quente</option>
              <option value="unassigned">Sem responsavel</option>
              <option value="today">Recebidas hoje</option>
            </select>
            <select
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-300 outline-none"
              onChange={(event) => setSortMode(event.target.value as ConversationSort)}
              value={sortMode}
            >
              <option value="recent">Mais recentes</option>
              <option value="unread">Nao lidas primeiro</option>
              <option value="oldestWaiting">Maior espera</option>
              <option value="hot">Quentes primeiro</option>
            </select>
            <button
              className="h-9 rounded-lg border border-white/10 text-xs text-zinc-400 transition hover:bg-white/[0.06]"
              onClick={() => {
                setConversationQuery("");
                setStatusFilter("all");
                setLeadFilter("all");
                setPriorityFilter("all");
                setSortMode("recent");
              }}
              type="button"
            >
              Limpar filtros
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {conversationStatusTabs.map((tab) => (
              <button
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  statusFilter === tab.id
                    ? "border-[#8B5CF6] bg-[#8B5CF6]/20 text-white"
                    : "border-white/10 text-zinc-400 hover:bg-white/[0.06]"
                }`}
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                type="button"
              >
                {tab.label} {conversationCounts[tab.countKey]}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <div className="p-5 text-center text-sm text-zinc-500">
              Nenhuma conversa encontrada.
            </div>
          )}
          {filteredConversations.map((conversation) => (
            <button
              className={`block w-full border-b border-white/10 p-4 text-left transition hover:bg-white/[0.05] ${
                selectedConversation?.phone === conversation.phone ? "bg-[#8B5CF6]/15" : ""
              }`}
              key={conversation.phone}
              onClick={() => selectConversation(conversation.phone)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ContactAvatar
                    avatarUrl={conversation.avatarUrl}
                    label={conversation.contactName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{conversation.contactName}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">{conversation.phone}</div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(conversation.lastMessage.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="truncate text-sm text-zinc-500">
                  {getWhatsAppMessageDisplay(conversation.lastMessage)}
                </p>
                {conversation.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-semibold text-black">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                  {conversation.statusLabel}
                </span>
                {conversation.lead && (
                  <span className="rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2 py-1 text-[11px] text-[#C4B5FD]">
                    Lead
                  </span>
                )}
                {conversation.activeLead?.temperature === "quente" && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                    Quente
                  </span>
                )}
                {conversation.failedCount > 0 && (
                  <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                    Falha
                  </span>
                )}
                {!conversation.lead && conversation.existingLead && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                    Lead existente
                  </span>
                )}
                {conversation.activeLead?.owner_name && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-500">
                    {conversation.activeLead.owner_name}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-black/10">
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {selectedConversation && (
              <ContactAvatar
                avatarUrl={selectedConversation.avatarUrl}
                label={selectedConversation.contactName}
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate font-semibold">
                  {selectedConversation?.contactName ?? selectedConversation?.phone}
                </div>
                {selectedConversation && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                    {selectedConversation.statusLabel}
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-sm text-zinc-500">{selectedConversation?.phone}</div>
              {selectedConversation && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{selectedConversationLead?.status ?? "sem lead"}</span>
                  <span>-</span>
                  <span>Ultima interacao {new Date(selectedConversation.lastMessage.created_at).toLocaleString("pt-BR")}</span>
                  <a
                    className="text-[#25D366] transition hover:text-[#6EE7A8]"
                    href={`https://wa.me/${selectedConversation.phone}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir WhatsApp Web
                  </a>
                </div>
              )}
            </div>
          </div>
          {selectedConversation && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#25D366]/25 px-3 text-sm text-[#25D366] transition hover:bg-[#25D366]/10 disabled:opacity-60"
                disabled={conversationActionLoading === "resolved"}
                onClick={() => void updateSelectedConversationStatus("resolved")}
                type="button"
              >
                {conversationActionLoading === "resolved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Resolver
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                disabled={conversationActionLoading === "archived"}
                onClick={() => void updateSelectedConversationStatus("archived")}
                type="button"
              >
                {conversationActionLoading === "archived" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Arquivar
              </button>
            </div>
          )}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {selectedConversation?.messages.map((message) => (
            <div
              className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
              key={message.id}
            >
              <div
                className={`max-w-[76%] rounded-lg px-3 py-2.5 text-sm leading-5 ${
                  message.direction === "outbound"
                    ? "bg-[#25D366] text-black"
                    : "border border-white/10 bg-white/[0.06] text-zinc-100"
                }`}
              >
                <div>{getWhatsAppMessageDisplay(message)}</div>
                <div
                  className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${
                    message.direction === "outbound" ? "text-black/60" : "text-zinc-500"
                  }`}
                >
                  <span>{new Date(message.created_at).toLocaleString("pt-BR")}</span>
                  <span>-</span>
                  {messageStatusIcon(message.status)}
                  <span>{messageStatusLabel(message.status)}</span>
                </div>
                {message.status === "failed" && message.direction === "outbound" && (
                  <button
                    className="mt-2 rounded-md border border-black/20 px-2 py-1 text-xs text-black/70 transition hover:bg-black/10"
                    onClick={() => void sendReply(getWhatsAppMessageDisplay(message))}
                    type="button"
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <form className="shrink-0 border-t border-white/10 p-4" onSubmit={handleReply}>
          {actionError && <p className="mb-3 text-sm text-red-300">{actionError}</p>}
          <div className="mb-3 grid gap-2 lg:grid-cols-[160px_180px_150px_1fr]">
            <input
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
              onChange={(event) => setTemplateQuery(event.target.value)}
              placeholder="Buscar template"
              value={templateQuery}
            />
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              disabled={filteredTemplates.length === 0}
              onChange={(event) => {
                applyTemplate(event.target.value);
                event.target.value = "";
              }}
              value=""
            >
              <option value="">Aplicar template</option>
              {filteredTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              disabled={!selectedConversationLead}
              onChange={(event) => setReplyMoveStatus(event.target.value as LeadStatus)}
              value={replyMoveStatus}
            >
              <option value="">Mover etapa</option>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <select
                className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
                disabled={!selectedConversationLead}
                onChange={(event) => setReplyFollowupDays(event.target.value)}
                value={replyFollowupDays}
              >
                <option value="">Sem follow-up</option>
                <option value="1">Amanha</option>
                <option value="2">2 dias</option>
                <option value="5">5 dias</option>
              </select>
              <span>{replyText.length}/1024</span>
              <span>Enter envia</span>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              Variaveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{telefone}}"}
            </span>
          </div>
          {replyText.includes("{{") && (
            <div className="mb-3 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-3 text-xs text-zinc-300">
              Preview: {previewTemplateText(replyText, selectedConversation)}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              className="min-h-12 flex-1 resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-[#8B5CF6]"
              maxLength={1024}
              onChange={(event) => setReplyText(event.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Responder pelo WhatsApp"
              value={replyText}
            />
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 text-sm font-semibold text-black transition hover:bg-[#20bd5a] disabled:opacity-60"
              disabled={sending || !replyText.trim()}
              type="submit"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Enviando" : "Enviar"}
            </button>
          </div>
        </form>
      </section>
      <aside className="flex min-h-0 flex-col border-t border-white/10 bg-white/[0.025] xl:border-l xl:border-t-0">
        <div className="border-b border-white/10 p-4">
          <div className="text-sm font-semibold text-zinc-100">Contato comercial</div>
          <p className="mt-1 text-xs text-zinc-500">Dados para operar a venda sem sair da conversa.</p>
        </div>
        {selectedConversation ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-center gap-3">
              <ContactAvatar
                avatarUrl={selectedConversation.avatarUrl}
                label={selectedConversation.contactName}
              />
              <div className="min-w-0">
                <div className="truncate font-semibold text-zinc-100">{selectedConversation.contactName}</div>
                <div className="mt-1 text-sm text-zinc-500">{selectedConversation.phone}</div>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <ConversationInfoRow
                label="Lead"
                value={selectedConversation.lead ? "Vinculado" : selectedConversation.existingLead ? "Existente nao vinculado" : "Sem lead"}
              />
              <ConversationInfoRow label="Etapa" value={selectedConversationLead?.status ?? "-"} />
              <ConversationInfoRow
                label="Temperatura"
                value={selectedConversationLead ? getTemperatureLabel(selectedConversationLead.temperature).text : "-"}
              />
              <ConversationInfoRow label="Responsavel" value={selectedConversationLead?.owner_name || "Nao definido"} />
              <ConversationInfoRow
                label="Proximo follow-up"
                value={
                  selectedConversationLead?.next_followup_at
                    ? new Date(selectedConversationLead.next_followup_at).toLocaleString("pt-BR")
                    : "Sem follow-up"
                }
              />
              <ConversationInfoRow
                label="Ultima interacao"
                value={new Date(selectedConversation.lastMessage.created_at).toLocaleString("pt-BR")}
              />
            </div>

            {selectedConversationLead && (
              <label className="block text-sm text-zinc-300">
                Mudar etapa
                <select
                  className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => void updateConversationLeadStatus(event.target.value as LeadStatus)}
                  value={selectedConversationLead.status}
                >
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-2">
              {selectedConversation.lead ? (
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                  onClick={() => selectedConversation.lead && onOpenLead(selectedConversation.lead)}
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Lead 360
                </button>
              ) : (
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#25D366]/30 px-3 text-sm text-[#25D366] transition hover:bg-[#25D366]/10 disabled:opacity-60"
                  disabled={savingLead}
                  onClick={() => setLeadModalOpen(true)}
                  type="button"
                >
                  {selectedConversation.existingLead ? <Link2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {selectedConversation.existingLead ? "Vincular lead existente" : "Criar lead"}
                </button>
              )}
              <a
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                href={`https://wa.me/${selectedConversation.phone}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
                WhatsApp Web
              </a>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-zinc-500">Selecione uma conversa.</div>
        )}
      </aside>
      {leadModalOpen && selectedConversation && (
        <ConversationLeadModal
          columns={columns}
          initialName={selectedConversation.contactName}
          phoneNumber={selectedConversation.phone}
          saving={savingLead}
          existingLead={selectedConversation.existingLead ?? null}
          onClose={() => setLeadModalOpen(false)}
          onSave={handleSaveLead}
        />
      )}
    </div>
  );
}

function ConversationLeadModal({
  columns,
  initialName,
  phoneNumber,
  saving,
  existingLead,
  onClose,
  onSave,
}: {
  columns: PipelineStage[];
  initialName: string;
  phoneNumber: string;
  saving: boolean;
  existingLead: Lead | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    company: string;
    source: string;
    status: LeadStatus;
    temperature: NonNullable<Lead["temperature"]>;
    ownerName: string;
    nextFollowupAt: string;
  }) => void;
}) {
  const [name, setName] = useState(existingLead?.name ?? initialName);
  const [company, setCompany] = useState(existingLead?.company ?? "");
  const [source, setSource] = useState(existingLead?.source ?? "WhatsApp");
  const [status, setStatus] = useState<LeadStatus>(existingLead?.status ?? columns[0]?.id ?? "novo");
  const [temperature, setTemperature] = useState<NonNullable<Lead["temperature"]>>(existingLead?.temperature ?? "morno");
  const [ownerName, setOwnerName] = useState(existingLead?.owner_name ?? "");
  const [nextFollowupAt, setNextFollowupAt] = useState("");

  return (
    <Modal onClose={onClose} title={existingLead ? "Vincular conversa ao lead" : "Salvar conversa como lead"}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, company, source, status, temperature, ownerName, nextFollowupAt });
        }}
      >
        {existingLead && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            Ja existe um lead com este telefone. A conversa sera vinculada a ele, evitando duplicidade.
          </div>
        )}
        <Input label="Nome" onChange={setName} required value={name} />
        <label className="block text-sm text-zinc-300">
          Telefone
          <input
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-zinc-400 outline-none"
            readOnly
            value={phoneNumber}
          />
        </label>
        <Input label="Empresa" onChange={setCompany} value={company} />
        <Input label="Origem" onChange={setSource} value={source} />
        <Input label="Responsavel" onChange={setOwnerName} value={ownerName} />
        <label className="block text-sm text-zinc-300">
          Status inicial
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
            value={status}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Temperatura
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setTemperature(event.target.value as NonNullable<Lead["temperature"]>)}
            value={temperature}
          >
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Proximo follow-up
          <input
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setNextFollowupAt(event.target.value)}
            type="datetime-local"
            value={nextFollowupAt}
          />
        </label>
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] font-semibold text-black transition hover:bg-[#20bd5a] disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {existingLead ? "Vincular conversa" : "Criar lead e vincular conversa"}
        </button>
      </form>
    </Modal>
  );
}

function conversationStatus(
  direction: WhatsAppMessage["direction"],
  hasLinkedLead: boolean,
  unreadCount: number,
  storedStatus?: WhatsAppConversation["status"] | null,
): ConversationStatus {
  if (storedStatus === "archived" || storedStatus === "resolved") return storedStatus;
  if (hasLinkedLead) return "converted";
  if (unreadCount > 0) return "unread";
  if (direction === "outbound") return "waiting";
  return "responded";
}

function countPendingInboundMessages(messages: WhatsAppMessage[]) {
  const lastOutboundAt = Math.max(
    0,
    ...messages
      .filter((message) => message.direction === "outbound")
      .map((message) => new Date(message.created_at).getTime()),
  );

  return messages.filter(
    (message) =>
      message.direction === "inbound" && new Date(message.created_at).getTime() > lastOutboundAt,
  ).length;
}

function conversationStatusLabel(status: ConversationStatus) {
  const labels: Record<ConversationStatus, string> = {
    unread: "Nao lida",
    waiting: "Aguardando resposta",
    responded: "Respondida",
    converted: "Convertida em lead",
    resolved: "Resolvida",
    archived: "Arquivada",
  };

  return labels[status];
}

function messageStatusLabel(status: WhatsAppMessage["status"]) {
  const labels: Record<WhatsAppMessage["status"], string> = {
    pending: "pendente",
    sent: "enviada",
    delivered: "entregue",
    read: "lida",
    failed: "falhou",
  };

  return labels[status] ?? status;
}

function messageStatusIcon(status: WhatsAppMessage["status"]) {
  const className = "h-3.5 w-3.5";

  if (status === "pending") return <Clock3 className={className} />;
  if (status === "sent") return <Check className={className} />;
  if (status === "delivered") return <CheckCheck className={className} />;
  if (status === "read") return <CheckCheck className={`${className} text-[#0EA5E9]`} />;
  return <AlertTriangle className={className} />;
}

function previewTemplateText(
  text: string,
  conversation:
    | {
        contactName: string;
        phone: string;
        lead?: Lead;
      }
    | undefined,
) {
  if (!conversation) return text;

  const lead: Lead = conversation.lead ?? {
    id: "",
    name: conversation.contactName,
    phone: conversation.phone,
    company: "",
    source: "WhatsApp",
    status: "novo",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return renderTemplate(text, lead);
}

function findLeadByPhone(leads: Lead[], phone: string) {
  const candidates = getPhoneCandidates(phone);

  return (
    leads.find((lead) => {
      const normalized = normalizePhone(lead.phone);
      return candidates.some(
        (candidate) => candidate === normalized || candidate.endsWith(normalized) || normalized.endsWith(candidate),
      );
    }) ?? null
  );
}

function getPhoneCandidates(phone: string) {
  const normalized = normalizePhone(phone);
  const candidates = new Set([normalized]);
  const localNumber = normalized.startsWith("55") ? normalized.slice(2) : normalized;

  candidates.add(localNumber);
  candidates.add(`55${localNumber}`);

  if (localNumber.length === 10) {
    const withNinthDigit = `${localNumber.slice(0, 2)}9${localNumber.slice(2)}`;
    candidates.add(withNinthDigit);
    candidates.add(`55${withNinthDigit}`);
  }

  if (localNumber.length === 11 && localNumber[2] === "9") {
    const withoutNinthDigit = `${localNumber.slice(0, 2)}${localNumber.slice(3)}`;
    candidates.add(withoutNinthDigit);
    candidates.add(`55${withoutNinthDigit}`);
  }

  return Array.from(candidates).filter(Boolean);
}

function ContactAvatar({
  avatarUrl,
  label,
  size = "md",
}: {
  avatarUrl?: string | null;
  label: string;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    // Profile picture URLs come from WhatsApp/Evolution and are not handled by next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={label} className={`${dimension} rounded-full object-cover`} src={avatarUrl} />;
  }

  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-300`}>
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

function ConversationInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm text-zinc-100">{value}</div>
    </div>
  );
}

function applyMessageRealtimeEvent(current: WhatsAppMessage[], payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) {
  if (payload.eventType === "INSERT") {
    const next = payload.new as WhatsAppMessage;
    if (current.some((message) => message.id === next.id)) return current;
    return [...current, next].sort(sortWhatsAppMessages);
  }

  if (payload.eventType === "UPDATE") {
    const next = payload.new as WhatsAppMessage;
    return current.map((message) => (message.id === next.id ? next : message)).sort(sortWhatsAppMessages);
  }

  if (payload.eventType === "DELETE") {
    return current.filter((message) => message.id !== payload.old.id);
  }

  return current;
}

function applyConversationRealtimeEvent(current: WhatsAppConversation[], payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) {
  if (payload.eventType === "INSERT") {
    const next = payload.new as WhatsAppConversation;
    return upsertLocalConversation(current, next);
  }

  if (payload.eventType === "UPDATE") {
    const next = payload.new as WhatsAppConversation;
    return upsertLocalConversation(current, next);
  }

  if (payload.eventType === "DELETE") {
    return current.filter((conversation) => conversation.id !== payload.old.id);
  }

  return current;
}

function upsertLocalConversation(current: WhatsAppConversation[], next: WhatsAppConversation) {
  const exists = current.some((conversation) => conversation.id === next.id || conversation.phone_number === next.phone_number);
  const items = exists
    ? current.map((conversation) =>
        conversation.id === next.id || conversation.phone_number === next.phone_number ? next : conversation,
      )
    : [next, ...current];

  return items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

function sortWhatsAppMessages(a: WhatsAppMessage, b: WhatsAppMessage) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function getWhatsAppMessageDisplay(message: WhatsAppMessage) {
  if (message.content?.trim()) return message.content;
  if (message.media_url) return "Midia recebida";
  return message.direction === "inbound" ? "Mensagem recebida" : "Mensagem enviada";
}

function isSameDay(value: string, date: Date) {
  const current = new Date(value);
  return startOfDay(current).getTime() === startOfDay(date).getTime();
}

function sortConversations<
  T extends {
    unreadCount: number;
    lastMessage: WhatsAppMessage;
    activeLead?: Lead | null;
  },
>(a: T, b: T, mode: ConversationSort) {
  if (mode === "unread") {
    const unreadDiff = b.unreadCount - a.unreadCount;
    if (unreadDiff !== 0) return unreadDiff;
  }

  if (mode === "oldestWaiting") {
    const aInbound = a.lastMessage.direction === "inbound" ? 0 : 1;
    const bInbound = b.lastMessage.direction === "inbound" ? 0 : 1;
    if (aInbound !== bInbound) return aInbound - bInbound;
    return new Date(a.lastMessage.created_at).getTime() - new Date(b.lastMessage.created_at).getTime();
  }

  if (mode === "hot") {
    const aHot = a.activeLead?.temperature === "quente" ? 1 : 0;
    const bHot = b.activeLead?.temperature === "quente" ? 1 : 0;
    if (aHot !== bHot) return bHot - aHot;
  }

  return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
}

function migrationChecksInitialState(configured: boolean): MigrationCheck[] {
  if (!configured) {
    return [
      {
        label: "Supabase",
        status: "missing",
        detail: "Supabase nao configurado neste ambiente",
      },
    ];
  }

  return [
    {
      label: "Supabase",
      status: "checking",
      detail: "Verificando conexao autenticada",
    },
    {
      label: "Campos comerciais",
      status: "checking",
      detail: "Verificando commercial_pipeline_migration.sql",
    },
    {
      label: "Tabela de tarefas",
      status: "checking",
      detail: "Verificando tasks_migration.sql",
    },
    {
      label: "Trilha de auditoria",
      status: "checking",
      detail: "Verificando audit_logs_migration.sql",
    },
    {
      label: "Conversas operacionais",
      status: "checking",
      detail: "Verificando conversations_operational_migration.sql",
    },
    {
      label: "Webhook WhatsApp",
      status: "checking",
      detail: "Verificando recebimento recente de eventos",
    },
  ];
}

type SettingsTab = "system" | "whatsapp" | "templates" | "team" | "crm" | "audit" | "logs" | "data";
type UserRole = "admin" | "seller" | "support" | "readonly";
type CrmPreferences = {
  companyName: string;
  brandName: string;
  defaultSlaHours: string;
  businessHours: string;
  defaultFollowupDays: string;
  defaultWhatsAppSource: string;
  defaultOwnerName: string;
};

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "system", label: "Sistema" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "templates", label: "Mensagens" },
  { id: "team", label: "Equipe" },
  { id: "crm", label: "CRM" },
  { id: "audit", label: "Auditoria" },
  { id: "logs", label: "Logs" },
  { id: "data", label: "Dados" },
];

const defaultCrmPreferences: CrmPreferences = {
  companyName: "OrigoCRM",
  brandName: "OrigoCRM",
  defaultSlaHours: "24",
  businessHours: "08:00-18:00",
  defaultFollowupDays: "1",
  defaultWhatsAppSource: "WhatsApp",
  defaultOwnerName: "",
};

const migrationSqlByLabel: Record<string, string> = {
  "Campos comerciais": [
    "alter table public.leads add column if not exists estimated_value numeric(12,2);",
    "alter table public.leads add column if not exists owner_name text not null default '';",
    "alter table public.leads add column if not exists temperature text not null default 'morno';",
    "alter table public.leads add column if not exists outcome_reason text not null default '';",
    "alter table public.leads add column if not exists sla_hours integer not null default 24;",
    "alter table public.leads add column if not exists archived_at timestamptz;",
    "alter table public.leads drop constraint if exists leads_status_check;",
    "alter table public.leads drop constraint if exists leads_closed_outcome_reason_check;",
    "create index if not exists leads_user_id_temperature_idx on public.leads(user_id, temperature);",
    "create index if not exists leads_user_id_owner_name_idx on public.leads(user_id, owner_name);",
    "create index if not exists leads_user_id_archived_at_idx on public.leads(user_id, archived_at);",
  ].join("\n"),
  "Tabela de tarefas": [
    "create table if not exists public.tasks (",
    "  id uuid primary key default gen_random_uuid(),",
    "  user_id uuid not null references auth.users(id) on delete cascade,",
    "  lead_id uuid not null references public.leads(id) on delete cascade,",
    "  type text not null default 'followup',",
    "  title text not null,",
    "  notes text,",
    "  due_at timestamptz not null,",
    "  status text not null default 'open' check (status in ('open', 'completed', 'canceled')),",
    "  completed_at timestamptz,",
    "  created_at timestamptz not null default now(),",
    "  updated_at timestamptz not null default now()",
    ");",
    "alter table public.tasks drop constraint if exists tasks_type_check;",
    "alter table public.tasks add constraint tasks_type_check check (type in ('followup', 'call', 'email', 'whatsapp', 'meeting', 'other'));",
    "create index if not exists tasks_user_id_status_due_at_idx on public.tasks(user_id, status, due_at);",
    "create index if not exists tasks_user_id_lead_id_idx on public.tasks(user_id, lead_id);",
    "alter table public.tasks enable row level security;",
  ].join("\n"),
  "Trilha de auditoria": [
    "create table if not exists public.audit_logs (",
    "  id uuid primary key default gen_random_uuid(),",
    "  user_id uuid references auth.users(id) on delete set null,",
    "  entity_type text not null check (entity_type in ('lead', 'task', 'template', 'whatsapp', 'system')),",
    "  entity_id uuid,",
    "  action text not null,",
    "  summary text not null,",
    "  metadata jsonb not null default '{}'::jsonb,",
    "  created_at timestamptz not null default now()",
    ");",
    "create index if not exists audit_logs_user_id_created_at_idx on public.audit_logs(user_id, created_at desc);",
    "create index if not exists audit_logs_user_id_entity_idx on public.audit_logs(user_id, entity_type, entity_id);",
    "alter table public.audit_logs enable row level security;",
  ].join("\n"),
  "Conversas operacionais": [
    "alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_status_check;",
    "alter table public.whatsapp_conversations add constraint whatsapp_conversations_status_check check (status in ('open', 'unread', 'waiting', 'responded', 'converted', 'resolved', 'archived'));",
    "create index if not exists whatsapp_conversations_user_id_status_updated_at_idx on public.whatsapp_conversations(user_id, status, updated_at desc);",
  ].join("\n"),
};

function readCrmPreferences(): CrmPreferences {
  if (typeof window === "undefined") return defaultCrmPreferences;

  try {
    const raw = window.localStorage.getItem("origocrm:settings");
    return raw ? { ...defaultCrmPreferences, ...JSON.parse(raw) } : defaultCrmPreferences;
  } catch {
    return defaultCrmPreferences;
  }
}

function readUserRole(): UserRole {
  if (typeof window === "undefined") return "admin";
  const value = window.localStorage.getItem("origocrm:user-role");
  return value === "seller" || value === "support" || value === "readonly" ? value : "admin";
}

function SettingsView({
  auditLogs,
  archivedLeads,
  initialTab,
  leads,
  onAddTemplate,
  onDeleteTemplate,
  tasks,
  templates,
  user,
  whatsappLogs,
  whatsappMessages,
  onUnarchiveLead,
}: {
  auditLogs: AuditLog[];
  archivedLeads: Lead[];
  initialTab?: SettingsTab;
  leads: Lead[];
  onAddTemplate: (title: string, body: string) => void;
  onDeleteTemplate: (template: MessageTemplate) => void;
  tasks: Task[];
  templates: MessageTemplate[];
  user: AuthUser;
  whatsappLogs: WhatsAppLog[];
  whatsappMessages: WhatsAppMessage[];
  onUnarchiveLead: (lead: Lead) => void;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [checks, setChecks] = useState<MigrationCheck[]>(() => migrationChecksInitialState(Boolean(supabase)));
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? "system");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState("");
  const [evolutionStatus, setEvolutionStatus] = useState<{
    configured: boolean;
    connected: boolean;
    state: string;
    instanceName?: string;
    phoneNumber?: string | null;
    profileName?: string | null;
    error?: string;
  } | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionDisconnecting, setEvolutionDisconnecting] = useState(false);
  const [evolutionQrCode, setEvolutionQrCode] = useState<string | null>(null);
  const [evolutionPairingCode, setEvolutionPairingCode] = useState<string | null>(null);
  const [evolutionFeedback, setEvolutionFeedback] = useState("");
  const [role, setRole] = useState<UserRole>(() => readUserRole());
  const [preferences, setPreferences] = useState<CrmPreferences>(() => readCrmPreferences());
  const [auditEntityFilter, setAuditEntityFilter] = useState<AuditLog["entity_type"] | "all">("all");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<WhatsAppLog["status"] | "all">("all");
  const [selectedWhatsAppLog, setSelectedWhatsAppLog] = useState<WhatsAppLog | null>(null);
  const lastWebhook = whatsappLogs[0] ?? null;
  const lastError = whatsappLogs.find((log) => log.status === "error") ?? null;
  const lastMessage = whatsappMessages[0] ?? null;
  const pendingChecks = checks.filter((check) => check.status === "missing");
  const auditActions = useMemo(
    () => Array.from(new Set(auditLogs.map((log) => log.action))).sort((a, b) => a.localeCompare(b)),
    [auditLogs],
  );
  const filteredAuditLogs = useMemo(() => {
    const search = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesEntity = auditEntityFilter === "all" || log.entity_type === auditEntityFilter;
      const matchesAction = auditActionFilter === "all" || log.action === auditActionFilter;
      const matchesSearch =
        !search ||
        [log.summary, log.action, log.entity_type, JSON.stringify(log.metadata)]
          .some((value) => value.toLowerCase().includes(search));
      return matchesEntity && matchesAction && matchesSearch;
    });
  }, [auditActionFilter, auditEntityFilter, auditLogs, auditSearch]);
  const filteredWhatsappLogs = useMemo(
    () => whatsappLogs.filter((log) => logStatusFilter === "all" || log.status === logStatusFilter),
    [logStatusFilter, whatsappLogs],
  );
  const environmentHost = typeof window === "undefined" ? "indefinido" : window.location.host;
  const rolePermissions: Record<UserRole, string[]> = {
    admin: ["Pipeline", "Conversas", "Tarefas", "Templates", "Configuracoes", "Excluir lead", "Alterar funil", "Desconectar WhatsApp"],
    seller: ["Pipeline", "Conversas", "Tarefas", "Templates"],
    support: ["Conversas", "Tarefas", "Templates"],
    readonly: ["Leitura de dados"],
  };

  const runChecks = useCallback(async () => {
    if (!supabase) {
      setChecks(migrationChecksInitialState(false));
      return;
    }

    const client = supabase;
    setChecking(true);
    const [session, commercial, tasksResult, auditResult, conversationResult, webhookResult, evolutionResult] = await Promise.all([
      client.auth.getUser(),
      client
        .from("leads")
        .select("id,estimated_value,owner_name,temperature,outcome_reason,sla_hours,archived_at")
        .limit(1),
      client
        .from("tasks")
        .select("id,lead_id,type,title,due_at,status,completed_at")
        .limit(1),
      client
        .from("audit_logs")
        .select("id,entity_type,entity_id,action,summary,metadata")
        .limit(1),
      client
        .from("whatsapp_conversations")
        .select("id,status,unread_count,last_read_at")
        .limit(1),
      fetch("/api/webhooks/evolution", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/evolution/status", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json() })).catch(() => null),
    ]);
    const evolutionData = evolutionResult?.data;

    if (evolutionData) {
      setEvolutionStatus({
        configured: Boolean(evolutionData.configured),
        connected: Boolean(evolutionData.connected),
        state: evolutionData.state ?? "indefinido",
        instanceName: evolutionData.instanceName,
        phoneNumber: evolutionData.phoneNumber,
        profileName: evolutionData.profileName,
        error: evolutionData.error,
      });
    }

    setChecks([
      {
        label: "Supabase",
        status: session.data.user ? "ok" : "missing",
        detail: session.data.user ? "Sessao autenticada e banco acessivel" : "Usuario nao autenticado ou RLS bloqueando leitura",
      },
      {
        label: "Campos comerciais",
        status: commercial.error ? "missing" : "ok",
        detail: commercial.error
          ? "Aplique commercial_pipeline_migration.sql, lead_archiving_contracts_migration.sql e custom_pipeline_stages_migration.sql"
          : "Campos comerciais, arquivamento e etapas customizadas disponiveis",
      },
      {
        label: "Tabela de tarefas",
        status: tasksResult.error ? "missing" : "ok",
        detail: tasksResult.error
          ? "Aplique supabase/tasks_migration.sql e tasks_meeting_type_migration.sql"
          : "Tabela tasks disponivel para agenda profissional",
      },
      {
        label: "Trilha de auditoria",
        status: auditResult.error ? "missing" : "ok",
        detail: auditResult.error
          ? "Aplique supabase/audit_logs_migration.sql"
          : "Tabela audit_logs pronta para acoes sensiveis",
      },
      {
        label: "Conversas operacionais",
        status: conversationResult.error ? "missing" : "ok",
        detail: conversationResult.error
          ? "Aplique supabase/conversations_operational_migration.sql"
          : "Status resolvida/arquivada e inbox operacional disponiveis",
      },
      {
        label: "Webhook WhatsApp",
        status: webhookResult?.status === "ok" ? "ok" : "missing",
        detail: webhookResult?.status === "ok"
          ? `Endpoint ativo com ${(webhookResult.events ?? []).length} eventos suportados`
          : "Nao foi possivel validar o endpoint publico do webhook",
      },
      {
        label: "Evolution",
        status: evolutionData?.configured ? "ok" : "missing",
        detail: evolutionData?.configured
          ? `Instancia ${evolutionData.instanceName || "configurada"} em estado ${evolutionData.state ?? "indefinido"}`
          : "Variaveis da Evolution ausentes ou nao acessiveis",
      },
    ]);
    setLastCheckedAt(new Date().toISOString());
    setChecking(false);
  }, [supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void runChecks();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [runChecks]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("origocrm:settings", JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("origocrm:user-role", role);
  }, [role]);

  useEffect(() => {
    if (!initialTab) return undefined;
    const timeout = window.setTimeout(() => setActiveTab(initialTab), 0);
    return () => window.clearTimeout(timeout);
  }, [initialTab]);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel((current) => (current === label ? "" : current)), 1600);
  }

  async function refreshEvolutionStatus() {
    setEvolutionFeedback("");
    setEvolutionLoading(true);
    try {
      const response = await fetch("/api/evolution/status", { cache: "no-store" });
      const data = await response.json();
      setEvolutionStatus({
        configured: Boolean(data.configured),
        connected: Boolean(data.connected),
        state: data.state ?? "indefinido",
        instanceName: data.instanceName,
        phoneNumber: data.phoneNumber,
        profileName: data.profileName,
        error: data.error,
      });
      if (!response.ok) setEvolutionFeedback(data.error ?? "Nao foi possivel consultar a Evolution");
    } catch {
      setEvolutionFeedback("Nao foi possivel consultar a Evolution");
    } finally {
      setEvolutionLoading(false);
    }
  }

  async function generateQrCode() {
    setEvolutionFeedback("");
    setEvolutionQrCode(null);
    setEvolutionPairingCode(null);
    setEvolutionLoading(true);
    try {
      const response = await fetch("/api/evolution/qrcode", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.error) {
        setEvolutionFeedback(data.error ?? "Nao foi possivel gerar QR Code");
        return;
      }

      setEvolutionQrCode(data.base64 ?? null);
      setEvolutionPairingCode(data.pairingCode ?? null);
      await refreshEvolutionStatus();
      setEvolutionFeedback(
        data.base64
          ? "QR gerado. Escaneie pelo WhatsApp e clique em Atualizar."
          : data.pairingCode
            ? "Codigo de pareamento gerado."
            : "A Evolution respondeu, mas nao retornou QR ou codigo de pareamento.",
      );
    } catch {
      setEvolutionFeedback("Nao foi possivel gerar QR Code");
    } finally {
      setEvolutionLoading(false);
    }
  }

  async function disconnectEvolution() {
    setEvolutionFeedback("");
    setEvolutionDisconnecting(true);
    try {
      const response = await fetch("/api/evolution/disconnect", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || data.error) {
        setEvolutionFeedback(data.error ?? "Nao foi possivel desconectar");
        return;
      }

      setEvolutionQrCode(null);
      setEvolutionPairingCode(null);
      await refreshEvolutionStatus();
      setEvolutionFeedback("WhatsApp desconectado");
    } catch {
      setEvolutionFeedback("Nao foi possivel desconectar");
    } finally {
      setEvolutionDisconnecting(false);
    }
  }

  async function testWebhook() {
    const response = await fetch("/api/webhooks/evolution", { cache: "no-store" });
    const data = await response.json();
    setEvolutionFeedback(response.ok ? `Webhook ativo: ${(data.events ?? []).join(", ")}` : "Webhook nao respondeu");
  }

  function updatePreference<K extends keyof CrmPreferences>(key: K, value: CrmPreferences[K]) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function exportLeads() {
    downloadCsv("origocrm-leads.csv", leads.map((lead) => ({
      nome: lead.name,
      telefone: lead.phone,
      empresa: lead.company,
      origem: lead.source,
      status: lead.status,
      temperatura: lead.temperature ?? "",
      responsavel: lead.owner_name ?? "",
      criado_em: lead.created_at,
    })));
  }

  function exportMessages() {
    downloadCsv("origocrm-conversas.csv", whatsappMessages.map((message) => ({
      telefone: message.phone_number,
      direcao: message.direction,
      conteudo: getWhatsAppMessageDisplay(message),
      status: message.status,
      criado_em: message.created_at,
    })));
  }

  function exportAudit() {
    downloadCsv("origocrm-auditoria.csv", filteredAuditLogs.map((log) => ({
      entidade: log.entity_type,
      acao: log.action,
      resumo: log.summary,
      metadata: JSON.stringify(log.metadata),
      criado_em: log.created_at,
    })));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.025] p-2">
        {settingsTabs.map((tab) => (
          <button
            className={`h-9 rounded-md px-3 text-sm transition ${
              activeTab === tab.id ? "bg-[#8B5CF6] text-white" : "text-zinc-400 hover:bg-white/[0.06]"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "system" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Diagnostico operacional</h2>
            <p className="mt-1 text-sm text-zinc-500">Banco, migrations, webhook, Evolution e ambiente.</p>
            <p className="mt-2 text-xs text-zinc-600">
              Ultimo teste: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString("pt-BR") : "ainda nao executado"}
            </p>
          </div>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
            disabled={checking}
            onClick={() => void runChecks()}
            type="button"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verificar agora
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm text-zinc-400">
          {checks.map((check) => (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3" key={check.label}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium text-zinc-100">{check.label}</div>
                  <p className="mt-2 text-xs text-zinc-500">{check.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SettingsStatusPill status={check.status} />
                  {check.status === "missing" && migrationSqlByLabel[check.label] && (
                    <button
                      className="flex h-8 items-center gap-1 rounded-md border border-amber-400/25 px-2 text-xs text-amber-200 transition hover:bg-amber-400/10"
                      onClick={() => void copyText(check.label, migrationSqlByLabel[check.label])}
                      type="button"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedLabel === check.label ? "Copiado" : "Copiar SQL"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SettingsMetric icon={Database} label="Banco" value={supabase ? "Configurado" : "Pendente"} />
          <SettingsMetric icon={ShieldCheck} label="Usuario" value={user.email ?? user.id} />
          <SettingsMetric icon={Settings} label="Ambiente" value={environmentHost} />
          <SettingsMetric icon={MessageCircle} label="WhatsApp" value={evolutionStatus?.connected ? "Conectado" : "Pendente"} />
        </div>
        {pendingChecks.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            {pendingChecks.length} item(ns) pedem acao. Copie o SQL pendente e aplique no SQL Editor do Supabase.
          </div>
        )}
      </section>
      )}

      {activeTab === "whatsapp" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Evolution</h2>
                <p className="mt-1 text-sm text-zinc-500">Estado da instancia, webhook e acoes operacionais.</p>
              </div>
              <SettingsStatusPill
                status={evolutionStatus?.connected ? "ok" : "missing"}
                okLabel={evolutionStatus?.connected ? "Conectado" : "Pendente"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsMetric icon={Wifi} label="Estado" value={evolutionStatus?.state ?? "nao verificado"} />
              <SettingsMetric icon={UserRound} label="Numero conectado" value={evolutionStatus?.phoneNumber ?? "Nao informado"} />
              <SettingsMetric icon={MessageCircle} label="Perfil" value={evolutionStatus?.profileName ?? "Nao informado"} />
              <SettingsMetric icon={Clock3} label="Ultimo webhook" value={lastWebhook ? new Date(lastWebhook.created_at).toLocaleString("pt-BR") : "Sem eventos"} />
              <SettingsMetric icon={Send} label="Ultima mensagem" value={lastMessage ? new Date(lastMessage.created_at).toLocaleString("pt-BR") : "Sem mensagens"} />
              <SettingsMetric icon={AlertTriangle} label="Ultimo erro" value={lastError?.error_message ?? lastError?.event_type ?? "Sem erros recentes"} />
            </div>
            {evolutionFeedback && <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">{evolutionFeedback}</p>}
            {evolutionStatus?.error && <p className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{evolutionStatus.error}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" disabled={evolutionLoading} onClick={() => void refreshEvolutionStatus()} type="button">
                {evolutionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" disabled={evolutionLoading} onClick={() => void generateQrCode()} type="button">
                {evolutionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Gerar QR
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" disabled={evolutionLoading} onClick={() => void generateQrCode()} type="button">
                <RotateCcw className="h-4 w-4" /> Reconectar
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-60" disabled={evolutionDisconnecting} onClick={() => void disconnectEvolution()} type="button">
                {evolutionDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />} Desconectar
              </button>
              <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60 sm:col-span-2" onClick={() => void testWebhook()} type="button">
                <ExternalLink className="h-4 w-4" /> Testar webhook
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-zinc-100">Pareamento WhatsApp</h3>
                  <p className="mt-1 text-sm text-zinc-500">Gere o QR ou codigo e conecte pelo app do WhatsApp.</p>
                </div>
                {evolutionStatus?.connected ? <Wifi className="h-5 w-5 text-[#25D366]" /> : <QrCode className="h-5 w-5 text-zinc-500" />}
              </div>
              <div className="mt-4 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 p-5">
                {evolutionStatus?.connected ? (
                  <div className="text-center text-sm text-zinc-400">
                    <Wifi className="mx-auto mb-3 h-8 w-8 text-[#25D366]" />
                    WhatsApp conectado. As conversas novas chegam pelo webhook.
                  </div>
                ) : evolutionQrCode ? (
                  // QR Code vem como data URL da Evolution, entao nao passa pelo otimizador de imagem.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="QR Code para conectar WhatsApp"
                    className="h-72 w-72 rounded-lg bg-white p-3"
                    src={evolutionQrCode}
                  />
                ) : evolutionPairingCode ? (
                  <div className="text-center">
                    <div className="text-sm text-zinc-500">Codigo de pareamento</div>
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-5 py-3 font-mono text-2xl tracking-widest text-zinc-100">
                      {evolutionPairingCode}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-sm text-center text-sm leading-6 text-zinc-500">
                    Clique em Gerar QR ou Reconectar para iniciar o pareamento da instancia.
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
              {whatsappLogs.slice(0, 5).map((log) => (
                <div className="grid gap-2 bg-black/20 p-3 text-sm md:grid-cols-[1fr_auto]" key={log.id}>
                  <div>
                    <div className="font-medium text-zinc-100">{friendlyWhatsAppLogLabel(log)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{log.event_type} - {log.status}</div>
                  </div>
                  <div className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString("pt-BR")}</div>
                </div>
              ))}
              {whatsappLogs.length === 0 && <div className="p-4 text-sm text-zinc-500">Nenhum log recebido.</div>}
            </div>
          </div>
        </div>
      </section>
      )}

      {activeTab === "templates" && (
      <section className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mensagens prontas</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Configure os textos usados no Lead 360, follow-ups e conversas do WhatsApp.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
              {templates.length} cadastradas
            </span>
          </div>
        </div>
        <Templates templates={templates} onAddTemplate={onAddTemplate} onDeleteTemplate={onDeleteTemplate} />
      </section>
      )}

      {activeTab === "team" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Usuarios e seguranca</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-zinc-500">Usuario logado</div>
            <div className="mt-1 font-medium text-zinc-100">{user.email ?? user.id}</div>
            <label className="mt-4 block text-sm text-zinc-300">
              Papel operacional
              <select
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#8B5CF6]"
                onChange={(event) => setRole(event.target.value as UserRole)}
                value={role}
              >
                <option value="admin">Admin</option>
                <option value="seller">Vendedor</option>
                <option value="support">Atendimento</option>
                <option value="readonly">Leitura</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-medium text-zinc-100">Permissoes por modulo</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Pipeline", "Conversas", "Tarefas", "Templates", "Configuracoes"].map((item) => (
                <span className={`rounded-full border px-2.5 py-1 text-xs ${rolePermissions[role].includes(item) ? "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]" : "border-white/10 text-zinc-500"}`} key={item}>
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-4 text-sm font-medium text-zinc-100">Acoes sensiveis</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Excluir lead", "Arquivar conversa", "Alterar funil", "Desconectar WhatsApp"].map((item) => (
                <span className={`rounded-full border px-2.5 py-1 text-xs ${role === "admin" ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-white/10 text-zinc-500"}`} key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-zinc-500">Convite de equipe e permissoes server-side devem entrar quando houver multiusuario real.</p>
      </section>
      )}

      {activeTab === "crm" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Preferencias do CRM</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SettingsInput label="Nome da empresa" value={preferences.companyName} onChange={(value) => updatePreference("companyName", value)} />
          <SettingsInput label="Marca exibida" value={preferences.brandName} onChange={(value) => updatePreference("brandName", value)} />
          <SettingsInput label="SLA padrao (horas)" value={preferences.defaultSlaHours} onChange={(value) => updatePreference("defaultSlaHours", value)} />
          <SettingsInput label="Horario comercial" value={preferences.businessHours} onChange={(value) => updatePreference("businessHours", value)} />
          <SettingsInput label="Follow-up padrao (dias)" value={preferences.defaultFollowupDays} onChange={(value) => updatePreference("defaultFollowupDays", value)} />
          <SettingsInput label="Origem padrao WhatsApp" value={preferences.defaultWhatsAppSource} onChange={(value) => updatePreference("defaultWhatsAppSource", value)} />
          <SettingsInput label="Responsavel padrao" value={preferences.defaultOwnerName} onChange={(value) => updatePreference("defaultOwnerName", value)} />
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-zinc-100">Funil e temperaturas</div>
          <p className="mt-1 text-sm text-zinc-500">Etapas seguem configuraveis na tela Pipeline. Temperaturas atuais: frio, morno e quente.</p>
        </div>
      </section>
      )}

      {activeTab === "audit" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Auditoria profissional</h2>
            <p className="mt-1 text-sm text-zinc-500">Acoes sensiveis registradas para rastreabilidade operacional.</p>
          </div>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" onClick={exportAudit} type="button">
            <FileDown className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_220px]">
          <input
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#8B5CF6]"
            onChange={(event) => setAuditSearch(event.target.value)}
            placeholder="Buscar resumo, acao ou metadata"
            value={auditSearch}
          />
          <select
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none"
            onChange={(event) => setAuditEntityFilter(event.target.value as AuditLog["entity_type"] | "all")}
            value={auditEntityFilter}
          >
            <option value="all">Todas entidades</option>
            <option value="lead">Lead</option>
            <option value="task">Task</option>
            <option value="template">Template</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="system">Sistema</option>
          </select>
          <select
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none"
            onChange={(event) => setAuditActionFilter(event.target.value)}
            value={auditActionFilter}
          >
            <option value="all">Todas acoes</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {filteredAuditLogs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              Nenhum registro carregado. Se a migracao estiver pendente, aplique audit_logs_migration.sql.
            </div>
          ) : (
            filteredAuditLogs.slice(0, 30).map((log) => (
              <button className="grid w-full gap-2 bg-black/20 p-3 text-left text-sm transition hover:bg-white/[0.04] md:grid-cols-[1fr_auto_auto]" key={log.id} onClick={() => setSelectedAuditLog(log)} type="button">
                <div>
                  <div className="font-medium text-zinc-100">{log.summary}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {log.entity_type} - {log.action}
                  </div>
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </div>
              </button>
            ))
          )}
        </div>
        {selectedAuditLog && (
          <SettingsDetailPanel title={selectedAuditLog.summary} onClose={() => setSelectedAuditLog(null)}>
            <pre className="overflow-auto whitespace-pre-wrap text-xs text-zinc-300">{JSON.stringify(selectedAuditLog, null, 2)}</pre>
          </SettingsDetailPanel>
        )}
      </section>
      )}

      {activeTab === "logs" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Logs WhatsApp amigaveis</h2>
            <p className="mt-1 text-sm text-zinc-500">Webhooks, falhas e eventos de sincronizacao em linguagem operacional.</p>
          </div>
          <select
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none"
            onChange={(event) => setLogStatusFilter(event.target.value as WhatsAppLog["status"] | "all")}
            value={logStatusFilter}
          >
            <option value="all">Todos</option>
            <option value="success">Sucesso</option>
            <option value="error">Erro</option>
          </select>
        </div>
        <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {filteredWhatsappLogs.slice(0, 40).map((log) => (
            <div className="grid gap-3 bg-black/20 p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={log.id}>
              <div>
                <div className="font-medium text-zinc-100">{friendlyWhatsAppLogLabel(log)}</div>
                <div className="mt-1 text-xs text-zinc-500">{log.event_type} - {new Date(log.created_at).toLocaleString("pt-BR")}</div>
              </div>
              <SettingsStatusPill status={log.status === "success" ? "ok" : "missing"} okLabel={log.status} missingLabel={log.status} />
              <button className="flex h-8 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-zinc-300 hover:bg-white/[0.06]" onClick={() => setSelectedWhatsAppLog(log)} type="button">
                <Eye className="h-3.5 w-3.5" /> Ver payload
              </button>
            </div>
          ))}
          {filteredWhatsappLogs.length === 0 && <div className="p-4 text-sm text-zinc-500">Nenhum log encontrado.</div>}
        </div>
        {selectedWhatsAppLog && (
          <SettingsDetailPanel title={friendlyWhatsAppLogLabel(selectedWhatsAppLog)} onClose={() => setSelectedWhatsAppLog(null)}>
            <pre className="overflow-auto whitespace-pre-wrap text-xs text-zinc-300">{JSON.stringify(selectedWhatsAppLog.payload, null, 2)}</pre>
          </SettingsDetailPanel>
        )}
      </section>
      )}

      {activeTab === "data" && (
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Backup e dados</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SettingsMetric icon={UserRound} label="Leads" value={leads.length.toString()} />
          <SettingsMetric icon={MessageCircle} label="Mensagens" value={whatsappMessages.length.toString()} />
          <SettingsMetric icon={CalendarClock} label="Tarefas" value={tasks.length.toString()} />
          <SettingsMetric icon={Database} label="Logs" value={whatsappLogs.length.toString()} />
          <SettingsMetric icon={Sparkles} label="Templates" value={templates.length.toString()} />
          <SettingsMetric icon={Archive} label="Arquivados" value={archivedLeads.length.toString()} />
        </div>
        <div className="mt-4 grid gap-2">
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" onClick={exportLeads} type="button"><FileDown className="h-4 w-4" /> Exportar leads</button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" onClick={exportMessages} type="button"><FileDown className="h-4 w-4" /> Exportar conversas</button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60" onClick={exportAudit} type="button"><FileDown className="h-4 w-4" /> Exportar auditoria</button>
        </div>
        <p className="mt-4 text-sm text-zinc-500">Retencao atual: manter historico operacional. Importacao CSV entra em fase posterior.</p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Leads arquivados</h2>
            <p className="mt-1 text-sm text-zinc-500">Recupere oportunidades arquivadas sem recriar cadastro.</p>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-500">
            {archivedLeads.length}
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {archivedLeads.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Nenhum lead arquivado.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {archivedLeads.slice(0, 20).map((lead) => (
                <div
                  className="grid gap-3 bg-black/20 p-3 text-sm md:grid-cols-[1fr_auto] md:items-center"
                  key={lead.id}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100">{lead.name}</div>
                    <div className="mt-1 truncate text-xs text-zinc-500">
                      {lead.company || "Sem empresa"} - {lead.phone} - {lead.status}
                    </div>
                  </div>
                  <button
                    className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                    onClick={() => onUnarchiveLead(lead)}
                    type="button"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Desarquivar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      </div>
      )}
    </div>
  );
}

function SettingsStatusPill({
  status,
  okLabel = "Aplicada",
  missingLabel = "Pendente",
}: {
  status: MigrationCheck["status"];
  okLabel?: string;
  missingLabel?: string;
}) {
  const className =
    status === "ok"
      ? "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]"
      : status === "missing"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
        : "border-white/10 bg-white/[0.04] text-zinc-400";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {status === "ok" ? okLabel : status === "missing" ? missingLabel : "Verificando"}
    </span>
  );
}

function SettingsMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs uppercase text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function SettingsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function SettingsDetailPanel({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-zinc-100">{title}</h3>
        <button className="text-sm text-zinc-500 hover:text-zinc-200" onClick={onClose} type="button">
          Fechar
        </button>
      </div>
      <div className="mt-3 max-h-80 overflow-auto">{children}</div>
    </div>
  );
}

function friendlyWhatsAppLogLabel(log: WhatsAppLog) {
  if (log.status === "error") return log.error_message || "Falha na integracao WhatsApp";
  if (log.event_type.includes("messages.upsert.ignored")) return "Mensagem ignorada pelo webhook";
  if (log.event_type.includes("messages.upsert.unmatched_saved")) return "Conversa criada sem lead vinculado";
  if (log.event_type.includes("messages.upsert")) return "Mensagem recebida pelo webhook";
  if (log.event_type.includes("messages.update")) return "Status de entrega atualizado";
  if (log.event_type.includes("connection")) return "Estado da conexao atualizado";
  if (log.event_type.includes("qr")) return "QR Code atualizado";
  return "Evento WhatsApp registrado";
}

function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function LeadForm({
  columns,
  lead,
  onClose,
  onSave,
}: {
  columns: PipelineStage[];
  lead: Lead | null;
  onClose: () => void;
  onSave: (input: LeadInput) => void;
}) {
  const [form, setForm] = useState<LeadInput>(lead ?? emptyLead);

  function updateField<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal onClose={onClose} title={lead ? "Editar lead" : "Novo lead"}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <Input label="Nome" onChange={(value) => updateField("name", value)} required value={form.name} />
        <Input
          label="Telefone"
          onChange={(value) => updateField("phone", normalizePhone(value))}
          required
          value={form.phone}
        />
        <Input label="Empresa" onChange={(value) => updateField("company", value)} value={form.company} />
        <Input label="Origem" onChange={(value) => updateField("source", value)} value={form.source} />
        <Input
          label="Valor estimado"
          onChange={(value) =>
            updateField("estimated_value", value ? Number(value.replace(",", ".")) : null)
          }
          type="number"
          value={form.estimated_value?.toString() ?? ""}
        />
        <Input
          label="Responsavel"
          onChange={(value) => updateField("owner_name", value)}
          value={form.owner_name ?? ""}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-300">
            Temperatura
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) =>
                updateField("temperature", event.target.value as Lead["temperature"])
              }
              value={form.temperature ?? "morno"}
            >
              <option value="frio">Frio</option>
              <option value="morno">Morno</option>
              <option value="quente">Quente</option>
            </select>
          </label>
          <Input
            label="SLA de retorno (h)"
            onChange={(value) => updateField("sla_hours", value ? Number(value) : null)}
            type="number"
            value={form.sla_hours?.toString() ?? ""}
          />
        </div>
        <label className="block text-sm text-zinc-300">
          Motivo de ganho/perda
          <textarea
            className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => updateField("outcome_reason", event.target.value)}
            value={form.outcome_reason ?? ""}
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Status
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => updateField("status", event.target.value as LeadStatus)}
            value={form.status}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] font-medium">
          <Check className="h-4 w-4" />
          Salvar
        </button>
      </form>
    </Modal>
  );
}

type LeadDetailsTab = "summary" | "commercial" | "tasks" | "contact" | "history";

function LeadDetails({
  columns,
  lead,
  templates,
  interactions,
  tasks,
  whatsappMessages,
  onClose,
  onSend,
  onAddInteraction,
  onCreateTask,
  onCompleteTask,
  onScheduleFollowup,
  onSaveLead,
  onUpdateTemperature,
  onDelete,
}: {
  columns: PipelineStage[];
  lead: Lead;
  templates: MessageTemplate[];
  interactions: Interaction[];
  tasks: Task[];
  whatsappMessages: WhatsAppMessage[];
  onClose: () => void;
  onSend: (lead: Lead, message: string, nextFollowupAt: string) => void;
  onAddInteraction: (leadId: string, input: InteractionInput) => void;
  onCreateTask: (lead: Lead, input: TaskInput) => void;
  onCompleteTask: (task: Task, lead: Lead) => void;
  onScheduleFollowup: (lead: Lead, nextFollowupAt: string) => void;
  onSaveLead: (input: LeadInput) => void;
  onUpdateTemperature: (lead: Lead, temperature: NonNullable<Lead["temperature"]>) => void;
  onDelete: (lead: Lead) => void;
}) {
  const automaticTemplate = pickTemplate(templates, lead);
  const [activeTab, setActiveTab] = useState<LeadDetailsTab>("summary");
  const [selectedTemplateId, setSelectedTemplateId] = useState(automaticTemplate?.id ?? "");
  const [message, setMessage] = useState(automaticTemplate ? renderTemplate(automaticTemplate.body, lead) : "");
  const [followupAt, setFollowupAt] = useState(() => toDateTimeLocal(lead.next_followup_at ?? addDays(1)));
  const [commercialForm, setCommercialForm] = useState<LeadInput>(() => leadToInput(lead));
  const [taskForm, setTaskForm] = useState<TaskInput>(() => ({
    type: "followup",
    title: `Follow-up com ${lead.name}`,
    notes: "",
    due_at: addDays(1),
  }));
  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState<NonNullable<Interaction["type"]>>("note");
  const [interactionChannel, setInteractionChannel] = useState<Interaction["channel"]>("whatsapp");
  const nextFollowupAt = fromDateTimeLocal(followupAt);
  const openTasks = tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const currentStage = columns.find((column) => column.id === lead.status)?.title ?? lead.status;
  const temperatureLabel = getTemperatureLabel(lead.temperature);
  const nextTask = openTasks[0] ?? null;
  const lastInteraction = [...interactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
  const leadTabs: { id: LeadDetailsTab; label: string; count?: number }[] = [
    { id: "summary", label: "Resumo" },
    { id: "commercial", label: "Comercial" },
    { id: "tasks", label: "Tarefas", count: openTasks.length },
    { id: "contact", label: "Contato" },
    { id: "history", label: "Historico", count: interactions.length + whatsappMessages.length },
  ];

  function updateCommercialField<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setCommercialForm((current) => ({ ...current, [key]: value }));
  }

  function updateTaskField<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setTaskForm((current) => ({ ...current, [key]: value }));
  }

  function selectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (template) setMessage(renderTemplate(template.body, lead));
  }

  return (
    <Modal onClose={onClose} title={lead.name} wide>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-300">
                  {currentStage}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${temperatureLabel.tone}`}>
                  {temperatureLabel.text}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400">
                  {lead.owner_name || "Sem responsavel"}
                </span>
              </div>
              <div className="mt-2 truncate text-sm text-zinc-500">
                {lead.company || "Sem empresa"} - {lead.phone}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[520px]">
              <LeadMetric label="Tarefas" value={String(openTasks.length)} />
              <LeadMetric label="WhatsApp" value={String(whatsappMessages.length)} />
              <LeadMetric label="Valor" value={formatCurrency(lead.estimated_value) ?? "R$ 0"} />
              <LeadMetric
                label="Proximo"
                value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR") : "Sem data"}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {leadTabs.map((tab) => (
              <button
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                  activeTab === tab.id
                    ? "border-[#8B5CF6]/70 bg-[#8B5CF6]/20 text-white"
                    : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
                {typeof tab.count === "number" && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] text-zinc-300">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "summary" && (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100">Resumo operacional</h3>
                  <p className="mt-1 text-sm text-zinc-500">Proxima melhor acao e contexto essencial do lead.</p>
                </div>
                <button
                  className="mt-2 flex h-9 items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-3 text-xs font-medium text-[#DDD6FE] transition hover:bg-[#8B5CF6]/25 sm:mt-0"
                  onClick={() => setActiveTab("contact")}
                  type="button"
                >
                  <MessageCircle className="h-4 w-4" />
                  Contatar
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <LeadSummaryItem label="Empresa" value={lead.company || "Sem empresa"} />
                <LeadSummaryItem label="Origem" value={lead.source || "Nao informada"} />
                <LeadSummaryItem label="Responsavel" value={lead.owner_name || "Nao definido"} />
                <LeadSummaryItem label="Valor estimado" value={formatCurrency(lead.estimated_value) ?? "Nao informado"} />
                <LeadSummaryItem
                  label="Proximo contato"
                  value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString("pt-BR") : "Nao agendado"}
                />
                <LeadSummaryItem
                  label="Ultimo contato"
                  value={lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleString("pt-BR") : "Sem contato"}
                />
              </div>
              {lead.outcome_reason && (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-xs uppercase text-zinc-500">Motivo de ganho/perda</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-300">{lead.outcome_reason}</div>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                <div className="text-sm font-semibold text-zinc-100">Proxima acao</div>
                {nextTask ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                        {taskTypeLabel(nextTask.type)}
                      </span>
                      <span className="text-sm font-medium text-zinc-100">{nextTask.title}</span>
                    </div>
                    <div className={`mt-2 text-xs ${getDueAtLabel(nextTask.due_at).tone}`}>
                      {getDueAtLabel(nextTask.due_at).text}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                    Nenhuma tarefa aberta. Crie uma tarefa para manter o lead em cadencia.
                  </div>
                )}
                <button
                  className="mt-3 h-9 w-full rounded-lg border border-white/10 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                  onClick={() => setActiveTab("tasks")}
                  type="button"
                >
                  Ver tarefas
                </button>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                <div className="text-sm font-semibold text-zinc-100">Ultimo registro</div>
                {lastInteraction ? (
                  <div className="mt-3 text-sm leading-6 text-zinc-400">
                    <div className="text-zinc-100">{timelineTitle(lastInteraction)}</div>
                    <div className="line-clamp-3">{lastInteraction.message ?? lastInteraction.note}</div>
                    <div className="mt-2 text-xs text-zinc-500">{new Date(lastInteraction.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-zinc-500">Nenhuma interacao registrada.</div>
                )}
              </div>

              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
                onClick={() => onDelete(lead)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                Excluir lead
              </button>
            </aside>
          </div>
        )}

        {activeTab === "commercial" && (
        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveLead(commercialForm);
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100">Dados comerciais</h3>
                <p className="mt-1 text-sm text-zinc-500">Edite qualificacao, responsavel e etapa sem sair do lead.</p>
              </div>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium transition hover:bg-[#7C3AED]"
                type="submit"
              >
                <Save className="h-4 w-4" />
                Salvar dados
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input label="Nome" onChange={(value) => updateCommercialField("name", value)} required value={commercialForm.name} />
              <Input
                label="Telefone"
                onChange={(value) => updateCommercialField("phone", normalizePhone(value))}
                required
                value={commercialForm.phone}
              />
              <Input label="Empresa" onChange={(value) => updateCommercialField("company", value)} value={commercialForm.company} />
              <Input label="Origem" onChange={(value) => updateCommercialField("source", value)} value={commercialForm.source} />
              <Input
                label="Valor estimado"
                onChange={(value) =>
                  updateCommercialField("estimated_value", value ? Number(value.replace(",", ".")) : null)
                }
                type="number"
                value={commercialForm.estimated_value?.toString() ?? ""}
              />
              <Input label="Responsavel" onChange={(value) => updateCommercialField("owner_name", value)} value={commercialForm.owner_name ?? ""} />
              <label className="block text-sm text-zinc-300">
                Temperatura
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => {
                    const temperature = event.target.value as NonNullable<Lead["temperature"]>;
                    updateCommercialField("temperature", temperature);
                    onUpdateTemperature(lead, temperature);
                  }}
                  value={commercialForm.temperature ?? lead.temperature ?? "morno"}
                >
                  <option value="frio">Frio</option>
                  <option value="morno">Morno</option>
                  <option value="quente">Quente</option>
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Etapa
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => updateCommercialField("status", event.target.value as LeadStatus)}
                  value={commercialForm.status}
                >
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>{column.title}</option>
                  ))}
                </select>
              </label>
              <Input
                label="SLA de retorno (h)"
                onChange={(value) => updateCommercialField("sla_hours", value ? Number(value) : null)}
                type="number"
                value={commercialForm.sla_hours?.toString() ?? ""}
              />
            </div>
            <label className="block text-sm text-zinc-300">
              Motivo de ganho/perda
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-[#8B5CF6]"
                onChange={(event) => updateCommercialField("outcome_reason", event.target.value)}
                value={commercialForm.outcome_reason ?? ""}
              />
            </label>
          </form>
        </section>
        )}

        {activeTab === "tasks" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Tarefas abertas</h3>
                <p className="mt-1 text-xs text-zinc-500">Proximas acoes deste lead.</p>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">{openTasks.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {openTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  Nenhuma tarefa aberta para este lead.
                </div>
              )}
              {openTasks.map((task) => {
                const due = getDueAtLabel(task.due_at);
                return (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3" key={task.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                            {taskTypeLabel(task.type)}
                          </span>
                          <span className="text-sm font-medium text-zinc-100">{task.title}</span>
                        </div>
                        <div className={`mt-2 text-xs ${due.tone}`}>{due.text}</div>
                        {task.notes && <p className="mt-2 text-xs leading-5 text-zinc-500">{task.notes}</p>}
                      </div>
                      <button
                        className="h-9 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                        onClick={() => onCompleteTask(task, lead)}
                        type="button"
                      >
                        Concluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form
            className="rounded-lg border border-white/10 bg-white/[0.025] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!taskForm.title.trim()) return;
              onCreateTask(lead, taskForm);
              setTaskForm({
                type: taskForm.type,
                title: taskForm.type === "followup" ? `Follow-up com ${lead.name}` : "",
                notes: "",
                due_at: addDays(1),
              });
            }}
          >
            <h3 className="text-sm font-semibold text-zinc-100">Criar tarefa</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                Tipo
                <select
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => {
                    const type = event.target.value as Task["type"];
                    updateTaskField("type", type);
                    if (!taskForm.title.trim() || taskForm.title.startsWith("Follow-up")) {
                      updateTaskField("title", type === "followup" ? `Follow-up com ${lead.name}` : taskTypeLabel(type));
                    }
                  }}
                  value={taskForm.type}
                >
                  <option value="followup">Follow-up</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Ligacao</option>
                  <option value="email">Email</option>
                  <option value="meeting">Reuniao</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <label className="block text-sm text-zinc-300">
                Quando
                <input
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                  onChange={(event) => updateTaskField("due_at", fromDateTimeLocal(event.target.value))}
                  type="datetime-local"
                  value={toDateTimeLocal(taskForm.due_at)}
                />
              </label>
            </div>
            <Input label="Titulo" onChange={(value) => updateTaskField("title", value)} required value={taskForm.title} />
            <label className="mt-3 block text-sm text-zinc-300">
              Observacao
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-[#8B5CF6]"
                onChange={(event) => updateTaskField("notes", event.target.value)}
                value={taskForm.notes ?? ""}
              />
            </label>
            <button className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-sm font-medium text-[#DDD6FE] transition hover:bg-[#8B5CF6]/25">
              <CalendarClock className="h-4 w-4" />
              Criar tarefa
            </button>
          </form>
        </section>
        )}

        {activeTab === "contact" && (
        <section className="space-y-5">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            Mensagem pronta
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
              disabled={templates.length === 0}
              onChange={(event) => selectTemplate(event.target.value)}
              value={selectedTemplateId}
            >
              <option value="">Escolher mensagem</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className="min-h-32 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setMessage(event.target.value)}
            value={message}
          />
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Proximo contato</h3>
              <p className="text-xs text-zinc-500">
                Salve a agenda do lead sem precisar enviar mensagem.
              </p>
            </div>
            <div className="text-xs text-zinc-500">
              Atual:{" "}
              {lead.next_followup_at
                ? new Date(lead.next_followup_at).toLocaleString("pt-BR")
                : "Nao agendado"}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 5].map((days) => (
              <button
                className={`h-10 rounded-lg border text-sm transition ${
                  isSameFollowupDay(followupAt, days)
                    ? "border-[#8B5CF6] bg-[#8B5CF6] text-white"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"
                }`}
                key={days}
                onClick={() => setFollowupAt(toDateTimeLocal(addDays(days)))}
                type="button"
              >
                {days === 1 ? "Amanha" : `${days} dias`}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setFollowupAt(event.target.value)}
              type="datetime-local"
              value={followupAt}
            />
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-4 text-sm font-medium text-[#DDD6FE] transition hover:bg-[#8B5CF6]/25"
              onClick={() => onScheduleFollowup(lead, nextFollowupAt)}
              type="button"
            >
              <Check className="h-4 w-4" />
              Salvar follow-up
            </button>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Sera salvo para {new Date(nextFollowupAt).toLocaleString("pt-BR")}.
          </div>
        </section>

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] font-semibold text-black shadow-lg shadow-[#8B5CF6]/20 transition hover:brightness-110 active:shadow-[#8B5CF6]/60"
          onClick={() => onSend(lead, message, nextFollowupAt)}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar mensagem agora
          <ExternalLink className="h-4 w-4" />
        </button>
        </section>
        )}

        {activeTab === "history" && (
        <section className="space-y-5">
        <form
          className="rounded-lg border border-white/10 bg-white/[0.025] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onAddInteraction(lead.id, {
              note,
              type: interactionType,
              channel: interactionChannel,
            });
            setNote("");
          }}
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1 text-sm text-zinc-300">
              Tipo de interacao
              <select
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                onChange={(event) => setInteractionType(event.target.value as NonNullable<Interaction["type"]>)}
                value={interactionType}
              >
                <option value="note">Nota</option>
                <option value="whatsapp_sent">WhatsApp</option>
                <option value="followup_created">Follow-up</option>
                <option value="status_changed">Mudanca de status</option>
              </select>
            </label>
            <label className="flex-1 text-sm text-zinc-300">
              Canal
              <select
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                onChange={(event) => setInteractionChannel(event.target.value as Interaction["channel"])}
                value={interactionChannel}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Ligacao</option>
                <option value="email">Email</option>
                <option value="other">Outro</option>
              </select>
            </label>
          </div>
          <textarea
            className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resumo objetivo do contato, combinados, objecoes ou proximo passo"
            required
            value={note}
          />
          <button className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm text-zinc-300 transition hover:bg-white/[0.06]">
            <Edit3 className="h-4 w-4" />
            Registrar interacao
          </button>
        </form>

        <LeadHistory interactions={interactions} whatsappMessages={whatsappMessages} />
        </section>
        )}
      </div>
    </Modal>
  );
}

function LeadMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="truncate text-[11px] uppercase text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function LeadSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function LeadHistory({
  interactions,
  whatsappMessages,
}: {
  interactions: Interaction[];
  whatsappMessages: WhatsAppMessage[];
}) {
  const commercialChanges = interactions.filter(isCommercialInteraction);
  const operationalInteractions = interactions.filter(
    (interaction) => !isCommercialInteraction(interaction) && interaction.type !== "whatsapp_sent",
  );
  const whatsappInteractions = interactions.filter((interaction) => interaction.type === "whatsapp_sent");

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Timeline
        emptyText="Nenhuma interacao manual registrada."
        interactions={operationalInteractions}
        title="Interacoes"
      />
      <WhatsAppHistory interactions={whatsappInteractions} messages={whatsappMessages} />
      <Timeline
        emptyText="Nenhuma mudanca comercial registrada."
        interactions={commercialChanges}
        title="Mudancas comerciais"
      />
    </div>
  );
}

function WhatsAppHistory({
  interactions,
  messages,
}: {
  interactions: Interaction[];
  messages: WhatsAppMessage[];
}) {
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">WhatsApp</h3>
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-500">
          {sortedMessages.length || interactions.length} registros
        </span>
      </div>
      {sortedMessages.length === 0 && interactions.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
          Nenhuma mensagem de WhatsApp vinculada a este lead.
        </div>
      )}
      {sortedMessages.slice(0, 8).map((message) => (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4" key={message.id}>
          <div className="flex items-center justify-between gap-3">
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${
              message.direction === "inbound"
                ? "bg-[#25D366]/10 text-[#9AF0B8]"
                : "bg-[#8B5CF6]/10 text-[#DDD6FE]"
            }`}>
              {message.direction === "inbound" ? "Recebida" : "Enviada"}
            </span>
            <span className="text-xs text-zinc-500">{new Date(message.created_at).toLocaleString("pt-BR")}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-300">{message.content || "Mensagem sem texto"}</p>
        </div>
      ))}
      {sortedMessages.length === 0 && interactions.map((interaction) => (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4" key={interaction.id}>
          <div className="text-sm font-medium text-zinc-100">Mensagem enviada</div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{interaction.message ?? interaction.note}</p>
        </div>
      ))}
    </div>
  );
}

function Timeline({
  interactions,
  title = "Historico comercial",
  emptyText = "Nenhuma interacao registrada. Use notas objetivas para manter contexto, combinados e proximos passos do lead.",
}: {
  interactions: Interaction[];
  title?: string;
  emptyText?: string;
}) {
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-500">
          {sorted.length} registros
        </span>
      </div>
      {sorted.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
      {sorted.map((interaction) => (
        <div className="relative border-l border-white/10 pl-4" key={interaction.id}>
          <div className={`absolute -left-1.5 top-2 h-3 w-3 rounded-full ${timelineTone(interaction)}`} />
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-100">{timelineTitle(interaction)}</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
                    {interactionChannelLabel(interaction.channel)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                  {interaction.message ?? interaction.note}
                </p>
              </div>
              <span className="shrink-0 text-xs text-zinc-500">
                {new Date(interaction.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function timelineTitle(interaction: Interaction) {
  if (interaction.type === "whatsapp_sent") return "Mensagem enviada";
  if (interaction.type === "status_changed") return "Mudanca de status";
  if (interaction.type === "followup_created") return "Follow-up criado";
  return "Interacao registrada";
}

function timelineTone(interaction: Interaction) {
  if (interaction.type === "whatsapp_sent") return "bg-[#25D366]";
  if (interaction.type === "followup_created") return "bg-amber-300";
  if (interaction.type === "status_changed") return "bg-[#8B5CF6]";
  return "bg-zinc-400";
}

function isCommercialInteraction(interaction: Interaction) {
  const text = `${interaction.message ?? ""} ${interaction.note ?? ""}`.toLowerCase();
  return (
    interaction.type === "status_changed" ||
    interaction.type === "followup_created" ||
    text.includes("temperatura alterada") ||
    text.includes("tarefa criada") ||
    text.includes("tarefa reagendada") ||
    text.includes("follow-up concluido")
  );
}

function interactionChannelLabel(channel: Interaction["channel"]) {
  if (channel === "call") return "Ligacao";
  if (channel === "email") return "Email";
  if (channel === "other") return "Outro";
  return "WhatsApp";
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return addDays(1);
  return date.toISOString();
}

function isSameFollowupDay(value: string, days: number) {
  const selected = new Date(value);
  const quickDate = new Date(addDays(days));
  return startOfDay(selected).getTime() === startOfDay(quickDate).getTime();
}

function ConfirmDeleteLead({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title="Excluir lead">
      <div className="space-y-4">
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <p className="font-medium text-red-100">Esta acao remove o lead da base.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                O lead {lead.name}, suas tarefas e interacoes serao apagados. O historico de
                WhatsApp sera preservado desvinculado.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400"
            onClick={onConfirm}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Excluir lead
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDeleteTemplate({
  template,
  onCancel,
  onConfirm,
}: {
  template: MessageTemplate;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title="Excluir mensagem pronta">
      <div className="space-y-4">
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <p className="font-medium text-red-100">A mensagem pronta sera removida.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                {template.title} deixara de aparecer nas selecoes de atendimento e follow-up.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400"
            onClick={onConfirm}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Excluir mensagem
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Kept as a reusable confirmation modal for future close-stage workflows.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CloseLeadModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(lead.outcome_reason ?? "");

  return (
    <Modal onClose={onCancel} title="Fechar lead">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          onConfirm(reason.trim());
        }}
      >
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium text-amber-100">Informe o motivo antes de fechar.</p>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Esse registro ajuda a entender ganho, perda, objeção ou contexto final da oportunidade.
              </p>
            </div>
          </div>
        </div>
        <label className="block text-sm text-zinc-300">
          Motivo de ganho/perda
          <textarea
            autoFocus
            className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setReason(event.target.value)}
            placeholder={`Ex.: ${lead.name} fechou com outro fornecedor, sem budget agora, ou venda concluida.`}
            required
            value={reason}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED] disabled:opacity-50"
            disabled={!reason.trim()}
            type="submit"
          >
            <Check className="h-4 w-4" />
            Fechar lead
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Input({
  label,
  value,
  required,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none transition focus:border-[#8B5CF6]"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0F0F16] p-5 shadow-2xl shadow-black ${
        wide ? "max-w-6xl" : "max-w-xl"
      }`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

