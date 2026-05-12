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
  BarChart3,
  CalendarClock,
  Check,
  CheckCheck,
  Clock3,
  Edit3,
  ExternalLink,
  Loader2,
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
  Sparkles,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";

import { deleteLead as deleteLeadAction } from "@/actions/leads";
import {
  saveWhatsAppConversationAsLead,
  sendWhatsAppConversationMessage,
  sendWhatsAppMessage,
} from "@/actions/whatsapp";
import { pipelineColumns } from "@/lib/constants";
import { createSupabaseClient, isSupabaseConfigured } from "@/lib/db";
import type {
  Interaction,
  Lead,
  LeadInput,
  LeadStatus,
  MessageTemplate,
  Task,
  WhatsAppLog,
  WhatsAppMessage,
} from "@/lib/types";
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

type View = "dashboard" | "pipeline" | "tasks" | "leads" | "templates" | "conversations" | "whatsapp" | "settings";
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

export function CrmApp({ initialView = "dashboard" }: { initialView?: View } = {}) {
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

  return <Workspace initialView={initialView} user={user} onLogout={() => setUser(null)} />;
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

const viewPaths: Record<View, string> = {
  dashboard: "/dashboard",
  pipeline: "/pipeline",
  tasks: "/tasks",
  leads: "/leads",
  templates: "/templates",
  conversations: "/conversations",
  whatsapp: "/whatsapp",
  settings: "/settings",
};

const pathViews: Record<string, View> = Object.fromEntries(
  Object.entries(viewPaths).map(([view, path]) => [path, view]),
) as Record<string, View>;

function Workspace({
  user,
  onLogout,
  initialView,
}: {
  user: AuthUser;
  onLogout: () => void;
  initialView: View;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const view = pathViews[pathname] ?? initialView;
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [temperatureFilter, setTemperatureFilter] = useState<Lead["temperature"] | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "overdue">("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadPendingDelete, setLeadPendingDelete] = useState<Lead | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recentLeadId, setRecentLeadId] = useState<string | null>(null);
  const [remoteLeads, setRemoteLeads] = useState<Lead[]>([]);
  const [remoteTemplates, setRemoteTemplates] = useState<MessageTemplate[]>([]);
  const [remoteInteractions, setRemoteInteractions] = useState<Interaction[]>([]);
  const [remoteTasks, setRemoteTasks] = useState<Task[]>([]);
  const [remoteWhatsAppMessages, setRemoteWhatsAppMessages] = useState<WhatsAppMessage[]>([]);
  const [remoteWhatsAppLogs, setRemoteWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const leads = remoteLeads;
  const templates = remoteTemplates;
  const interactions = remoteInteractions;
  const tasks = remoteTasks;
  const whatsappMessages = remoteWhatsAppMessages;
  const whatsappLogs = remoteWhatsAppLogs;
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
      ] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("message_templates").select("*").order("created_at", { ascending: true }),
        supabase.from("interactions").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").order("due_at", { ascending: true }).limit(200),
        supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("whatsapp_logs").select("*").order("created_at", { ascending: false }).limit(30),
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

      setRemoteLeads((leadResult.data as Lead[] | null) ?? []);
      setRemoteTemplates((templateResult.data as MessageTemplate[] | null) ?? []);
      setRemoteInteractions((interactionResult.data as Interaction[] | null) ?? []);
      setRemoteTasks((taskResult.data as Task[] | null) ?? []);
      setRemoteWhatsAppMessages((whatsappMessageResult.data as WhatsAppMessage[] | null) ?? []);
      setRemoteWhatsAppLogs((whatsappLogResult.data as WhatsAppLog[] | null) ?? []);
      setLoading(false);
    }

    loadRemoteData();
  }, [supabase, user.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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

  function patchLeadOptimistic(id: string, patch: Partial<Lead>) {
    setRemoteLeads((items) => items.map((lead) => (lead.id === id ? { ...lead, ...patch } : lead)));
    setRecentLeadId(id);
    window.setTimeout(() => setRecentLeadId((current) => (current === id ? null : current)), 1400);
  }

  function addInteractionOptimistic(interaction: Interaction) {
    setRemoteInteractions((items) => [interaction, ...items]);
  }

  async function saveLead(input: LeadInput, id?: string) {
    const timestamp = new Date().toISOString();

    if (!supabase) {
      showToast("Supabase nao configurado");
      return;
    }

    if (id) {
      const previous = remoteLeads;
      patchLeadOptimistic(id, { ...input, updated_at: timestamp });
      const { error } = await supabase.from("leads").update(input).eq("id", id);
      if (error) {
        setRemoteLeads(previous);
        showToast("Erro ao atualizar lead");
      }
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (error) {
      showToast("Erro ao criar lead");
      return;
    }

    if (data) setRemoteLeads((items) => [data as Lead, ...items]);
  }

  async function deleteLead(lead: Lead) {
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;

    setSelectedLeadId((current) => (current === lead.id ? null : current));
    setLeadPendingDelete(null);
    setRemoteLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteInteractions((items) => items.filter((item) => item.lead_id !== lead.id));
    showToast("Lead removido");

    const result = await deleteLeadAction(lead.id);

    if (!result.success) {
      setRemoteLeads(previousLeads);
      setRemoteInteractions(previousInteractions);
      showToast(result.error ?? "Erro ao excluir lead");
    }
  }

  async function updateLeadStatus(id: string, status: LeadStatus) {
    const before = leads.find((lead) => lead.id === id);
    patchLeadOptimistic(id, { status, updated_at: new Date().toISOString() });
    if (before && before.status !== status) {
      const interaction = makeInteraction(id, `Status alterado para ${status}`, "status_changed");
      addInteractionOptimistic(interaction);
      if (supabase) await supabase.from("interactions").insert({ ...interaction, user_id: user.id });
    }
    if (supabase) {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) showToast("Erro ao atualizar status");
    }
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
    patchLeadOptimistic(lead.id, {
      next_followup_at: nextFollowupAt,
      updated_at: now,
    });
    const interaction = makeInteraction(
      lead.id,
      `Follow-up criado para ${new Date(nextFollowupAt).toLocaleString("pt-BR")}`,
      "followup_created",
    );
    addInteractionOptimistic(interaction);
    setRemoteTasks((items) => [
      task,
      ...items.map((item) =>
        item.lead_id === lead.id && item.status === "open" && item.type === "followup"
          ? { ...item, status: "canceled" as const, updated_at: now }
          : item,
      ),
    ]);
    showToast("Follow-up agendado");

    if (supabase) {
      const saveTask = async () => {
        const { error: cancelTaskError } = await supabase
          .from("tasks")
          .update({ status: "canceled", updated_at: now })
          .eq("lead_id", lead.id)
          .eq("type", "followup")
          .eq("status", "open");

        if (cancelTaskError) return { error: cancelTaskError };

        return supabase.from("tasks").insert({
          id: task.id,
          lead_id: lead.id,
          user_id: user.id,
          type: task.type,
          title: task.title,
          notes: task.notes,
          due_at: task.due_at,
          status: task.status,
        });
      };
      const [{ error: leadError }, { error: interactionError }, { error: taskError }] = await Promise.all([
        supabase.from("leads").update({ next_followup_at: nextFollowupAt }).eq("id", lead.id),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
        saveTask(),
      ]);
      if (leadError || interactionError) showToast("Erro ao salvar follow-up");
      if (taskError) showToast("Follow-up salvo; aplique a migracao de tarefas no Supabase");
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

    setRemoteTasks((items) => [
      task,
      ...items.map((item) =>
        task.type === "followup" &&
        item.lead_id === lead.id &&
        item.status === "open" &&
        item.type === "followup"
          ? { ...item, status: "canceled" as const, updated_at: now }
          : item,
      ),
    ]);
    if (task.type === "followup") {
      patchLeadOptimistic(lead.id, { next_followup_at: task.due_at, updated_at: now });
    }
    addInteractionOptimistic(interaction);
    showToast("Tarefa criada");

    if (supabase) {
      const saveTask = async () => {
        if (task.type === "followup") {
          const { error: cancelTaskError } = await supabase
            .from("tasks")
            .update({ status: "canceled", updated_at: now })
            .eq("lead_id", lead.id)
            .eq("type", "followup")
            .eq("status", "open");

          if (cancelTaskError) return { error: cancelTaskError };
        }

        return supabase.from("tasks").insert({
          id: task.id,
          lead_id: lead.id,
          user_id: user.id,
          type: task.type,
          title: task.title,
          notes: task.notes,
          due_at: task.due_at,
          status: task.status,
        });
      };
      const [{ error: taskError }, { error: leadError }, { error: interactionError }] = await Promise.all([
        saveTask(),
        task.type === "followup"
          ? supabase.from("leads").update({ next_followup_at: task.due_at }).eq("id", lead.id)
          : Promise.resolve({ error: null }),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (taskError || leadError || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao criar tarefa. Verifique a migracao de tarefas no Supabase");
      }
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
      const [{ error: taskError }, { error: leadError }, { error: interactionError }] = await Promise.all([
        supabase
          .from("tasks")
          .update({ status: "completed", completed_at: now, updated_at: now })
          .eq("id", task.id),
        shouldClearFollowup
          ? supabase.from("leads").update({ next_followup_at: null }).eq("id", lead.id)
          : Promise.resolve({ error: null }),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (taskError || leadError || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao concluir follow-up");
      }
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
      const [{ error: taskError }, { error: leadError }, { error: interactionError }] = await Promise.all([
        supabase
          .from("tasks")
          .update({ due_at: dueAt, status: "open", completed_at: null, updated_at: now })
          .eq("id", task.id),
        task.type === "followup"
          ? supabase.from("leads").update({ next_followup_at: dueAt }).eq("id", lead.id)
          : Promise.resolve({ error: null }),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);

      if (taskError || leadError || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        showToast("Erro ao reagendar tarefa");
      }
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
      }
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

    if (data) setRemoteTemplates((items) => [...items, data as MessageTemplate]);
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
              ["templates", "Mensagens prontas", MessageCircle],
              ["conversations", "Conversas", MessageCircle],
              ["whatsapp", "Conexao WhatsApp", QrCode],
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
              <h1 className="text-2xl font-semibold">
                {view === "dashboard" && "Dashboard"}
                {view === "pipeline" && "Pipeline"}
                {view === "tasks" && "Agenda"}
                {view === "leads" && "Leads"}
                {view === "templates" && "Mensagens prontas"}
                {view === "conversations" && "Conversas"}
                {view === "whatsapp" && "Conexao WhatsApp"}
                {view === "settings" && "Configuracoes"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {view === "conversations"
                  ? "Mensagens salvas pelo webhook da Evolution."
                  : view === "tasks"
                    ? "Tarefas comerciais, follow-ups e proximas acoes."
                  : view === "whatsapp"
                    ? "Conecte a instancia OrigoCRM pelo QR Code."
                    : view === "settings"
                      ? "Status das conexoes e proximos ajustes do CRM."
                      : "Cadencia continua: abrir, enviar, proximo."}
              </p>
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
                    {pipelineColumns.map((column) => (
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
                  <button
                    className="h-11 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                    onClick={exportFilteredLeads}
                    type="button"
                  >
                    Exportar CSV
                  </button>
                </>
              )}
              {view !== "whatsapp" && view !== "settings" && (
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
                    leads={filteredLeads}
                    onLeadClick={(lead) => setSelectedLeadId(lead.id)}
                    onLeadDelete={(lead) => setLeadPendingDelete(lead)}
                    onQuickSchedule={(lead) => scheduleFollowup(lead, addDays(1))}
                    onQuickWhatsApp={(lead) => setSelectedLeadId(lead.id)}
                    onStatusChange={updateLeadStatus}
                    recentLeadId={recentLeadId}
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
                {view === "templates" && <Templates templates={templates} onAddTemplate={addTemplate} />}
                {view === "conversations" && (
                  <Conversations
                    leads={leads}
                    templates={templates}
                    onLeadCreated={(lead) => {
                      setRemoteLeads((items) =>
                        items.some((item) => item.id === lead.id) ? items : [lead, ...items],
                      );
                    }}
                    onOpenLead={(lead) => {
                      setSelectedLeadId(lead.id);
                      navigateView("pipeline");
                    }}
                  />
                )}
                {view === "whatsapp" && <WhatsAppConnection />}
                {view === "settings" && <SettingsView />}
              </>
            )}
          </div>
        </section>
      </div>

      {leadFormOpen && (
        <LeadForm
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
    </main>
  );
}

function Dashboard({
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
  const [dashboardNow] = useState(() => Date.now());
  const taskAgenda: DashboardAgendaItem[] = tasks
    .filter((task) => task.status === "open" && isTaskDueToday(task))
    .map((task) => ({
      task,
      lead: leads.find((lead) => lead.id === task.lead_id) ?? null,
      dueAt: task.due_at,
      title: task.title,
    }))
    .filter((item): item is DashboardAgendaItem & { task: Task } => Boolean(item.lead));
  const legacyAgenda: DashboardAgendaItem[] = leads
    .filter(
      (lead) =>
        lead.next_followup_at &&
        lead.status !== "fechado" &&
        isFollowupDue(lead) &&
        !taskAgenda.some((item) => item.lead.id === lead.id),
    )
    .map((lead) => ({
      lead,
      dueAt: lead.next_followup_at ?? "",
      title: "Follow-up pendente",
    }));
  const todayAgenda = [...taskAgenda, ...legacyAgenda].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  const overdueFollowups = [
    ...tasks.filter((task) => task.status === "open" && isTaskOverdue(task)),
    ...leads.filter(
      (lead) =>
        isFollowupOverdue(lead) &&
        !tasks.some((task) => task.status === "open" && task.lead_id === lead.id),
    ),
  ];
  const groupedMessages = groupMessagesByPhone(whatsappMessages);
  const conversationsWithPendingReplies = groupedMessages.filter(
    (items) => countPendingInboundMessages(items) > 0,
  );
  const unlinkedConversations = groupedMessages.filter((items) => {
    const latestLeadId = [...items].reverse().find((message) => message.lead_id)?.lead_id;
    const phone = items[0]?.phone_number ?? "";
    return !latestLeadId && !findLeadByPhone(leads, phone);
  });
  const failedMessages = whatsappMessages.filter((message) => message.status === "failed");
  const hotLeadsWithoutAction = leads.filter(
    (lead) =>
      (lead.temperature ?? "morno") === "quente" &&
      !lead.next_followup_at &&
      lead.status !== "fechado",
  );
  const recentInboundMessages = whatsappMessages
    .filter((message) => message.direction === "inbound")
    .slice(0, 5);
  const recentErrors = whatsappLogs.filter((log) => log.status === "error").slice(0, 4);
  const sevenDaysAgo = dashboardNow - 7 * 24 * 60 * 60 * 1000;
  const created7d = leads.filter((lead) => new Date(lead.created_at).getTime() >= sevenDaysAgo).length;
  const replies7d = whatsappMessages.filter(
    (message) =>
      message.direction === "inbound" && new Date(message.created_at).getTime() >= sevenDaysAgo,
  ).length;
  const contacts7d = interactions.filter(
    (interaction) =>
      interaction.type === "whatsapp_sent" &&
      new Date(interaction.created_at).getTime() >= sevenDaysAgo,
  ).length;
  const responseRate = contacts7d ? Math.round((replies7d / contacts7d) * 100) : 0;
  const openValue = leads
    .filter((lead) => lead.status !== "fechado")
    .reduce((total, lead) => total + (lead.estimated_value ?? 0), 0);
  const stuckProposals = leads.filter(
    (lead) =>
      lead.status === "proposta" &&
      dashboardNow - new Date(lead.updated_at).getTime() > 3 * 24 * 60 * 60 * 1000,
  );
  const noOwner = leads.filter((lead) => lead.status !== "fechado" && !lead.owner_name);
  const noNextContact = leads.filter(
    (lead) => lead.status !== "fechado" && lead.status !== "novo" && !lead.next_followup_at,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DashboardSignal label="Follow-ups vencidos" value={overdueFollowups.length} tone="danger" />
        <DashboardSignal label="Respostas novas" value={conversationsWithPendingReplies.length} tone="success" />
        <DashboardSignal label="Conversas sem lead" value={unlinkedConversations.length} tone="warning" />
        <DashboardSignal label="Mensagens com falha" value={failedMessages.length} tone="danger" />
        <DashboardSignal label="Quentes sem acao" value={hotLeadsWithoutAction.length} tone="warning" />
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

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">WhatsApp agora</h2>
              <p className="mt-1 text-sm text-zinc-500">Sinais da inbox e da Evolution.</p>
            </div>
            <button
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
              onClick={onViewConversations}
              type="button"
            >
              Abrir inbox
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <DashboardMiniMetric label="Nao lidas" value={conversationsWithPendingReplies.length} />
            <DashboardMiniMetric label="Sem lead" value={unlinkedConversations.length} />
            <DashboardMiniMetric label="Erros Evolution" value={recentErrors.length} />
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
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            Riscos comerciais
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <RiskItem label="Leads quentes sem proxima acao" value={hotLeadsWithoutAction.length} />
            <RiskItem label="Propostas paradas ha 3+ dias" value={stuckProposals.length} />
            <RiskItem label="Leads sem responsavel" value={noOwner.length} />
            <RiskItem label="Leads ativos sem proximo contato" value={noNextContact.length} />
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Performance leve</h2>
          <p className="mt-1 text-sm text-zinc-500">Ultimos 7 dias e carteira aberta.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardMiniMetric label="Leads criados" value={created7d} />
            <DashboardMiniMetric label="Respostas" value={replies7d} />
            <DashboardMiniMetric label="Contatos" value={contacts7d} />
            <DashboardMiniMetric label="Resposta" value={`${responseRate}%`} />
            <DashboardMiniMetric label="Valor aberto" value={formatCurrency(openValue) ?? "R$ 0"} />
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardSignal({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "success" | "warning";
}) {
  const toneClass = {
    danger: "border-red-400/25 bg-red-500/10 text-red-200",
    success: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]",
    warning: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-xs uppercase text-current/70">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function DashboardMiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-100">{value}</div>
    </div>
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

function RiskItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs text-zinc-100">{value}</span>
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

const pipelineMeta: Record<
  LeadStatus,
  { accent: string; description: string; empty: string }
> = {
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

function Pipeline({
  leads,
  recentLeadId,
  onLeadClick,
  onLeadDelete,
  onStatusChange,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  leads: Lead[];
  recentLeadId: string | null;
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (lead: Lead) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
}) {
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
    const column = pipelineColumns.find((item) => item.id === overId);
    const overLead = leads.find((lead) => lead.id === overId);
    const nextStatus = (column?.id ?? overLead?.status) as LeadStatus | undefined;

    if (nextStatus && nextStatus !== activeLead.status) onStatusChange(activeLead.id, nextStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <PipelineOverview leads={leads} />
        <div className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-5">
          {pipelineColumns.map((column) => {
            const columnLeads = leads.filter((lead) => lead.status === column.id);
            return (
              <PipelineColumn
                key={column.id}
                id={column.id}
                leads={columnLeads}
                onLeadClick={onLeadClick}
                onLeadDelete={onLeadDelete}
                onQuickSchedule={onQuickSchedule}
                onQuickWhatsApp={onQuickWhatsApp}
                recentLeadId={recentLeadId}
                title={column.title}
              />
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}

function PipelineOverview({ leads }: { leads: Lead[] }) {
  const pendingFollowups = leads.filter((lead) => isFollowupDue(lead)).length;
  const activeDeals = leads.filter((lead) => lead.status !== "fechado").length;
  const replied = leads.filter((lead) => lead.status === "respondeu").length;
  const closed = leads.filter((lead) => lead.status === "fechado").length;
  const closeRate = leads.length ? Math.round((closed / leads.length) * 100) : 0;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <PipelineStat label="Leads ativos" value={activeDeals.toString()} tone="border-[#8B5CF6]/30" />
      <PipelineStat label="Follow-up hoje" value={pendingFollowups.toString()} tone="border-amber-400/30" />
      <PipelineStat label="Responderam" value={replied.toString()} tone="border-[#25D366]/30" />
      <PipelineStat label="Taxa de fechamento" value={`${closeRate}%`} tone="border-white/10" />
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

function isFollowupDue(lead: Lead) {
  if (!lead.next_followup_at || lead.status === "fechado") return false;
  const dueAt = new Date(lead.next_followup_at);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

function isFollowupOverdue(lead: Lead) {
  if (!lead.next_followup_at || lead.status === "fechado") return false;
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

function getFollowupLabel(lead: Lead) {
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

function getColumnHealth(leads: Lead[]) {
  const due = leads.filter((lead) => isFollowupDue(lead)).length;
  if (due > 0) return `${due} com follow-up`;
  return leads.length ? "Em dia" : "Sem itens";
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

function getSlaLabel(lead: Lead) {
  if (!lead.last_contact_at || !lead.sla_hours || lead.status === "fechado") return null;

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
  recentLeadId,
  onLeadClick,
  onLeadDelete,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  id: LeadStatus;
  title: string;
  leads: Lead[];
  recentLeadId: string | null;
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (lead: Lead) => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const meta = pipelineMeta[id];

  return (
    <div
      className={`min-h-[560px] min-w-72 rounded-lg border p-3 transition ${
        isOver ? "border-[#8B5CF6] bg-[#8B5CF6]/10" : "border-white/10 bg-white/[0.025]"
      }`}
      ref={setNodeRef}
    >
      <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.accent}`} />
            <h2 className="truncate text-sm font-semibold text-zinc-100">{title}</h2>
          </div>
          <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-zinc-300">
            {leads.length}
          </span>
        </div>
        <p className="mt-2 min-h-8 text-xs leading-4 text-zinc-500">{meta.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
          <span>{getColumnHealth(leads)}</span>
          <span>Arraste para mover</span>
        </div>
      </div>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              highlighted={recentLeadId === lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onDelete={() => onLeadDelete(lead)}
              onQuickSchedule={() => onQuickSchedule(lead)}
              onQuickWhatsApp={() => onQuickWhatsApp(lead)}
            />
          ))}
          {leads.length === 0 && (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 p-4 text-center text-sm text-zinc-500">
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
  highlighted,
  onClick,
  onDelete,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  highlighted: boolean;
  onClick: () => void;
  onDelete: () => void;
  onQuickWhatsApp: () => void;
  onQuickSchedule: () => void;
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
        highlighted={highlighted}
        lead={lead}
        onClick={onClick}
        onDelete={onDelete}
        onQuickSchedule={onQuickSchedule}
        onQuickWhatsApp={onQuickWhatsApp}
        showQuickActions
      />
    </div>
  );
}

function LeadCard({
  lead,
  onClick,
  onDelete,
  dragging = false,
  highlighted = false,
  showQuickActions = false,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  onClick: () => void;
  onDelete?: () => void;
  dragging?: boolean;
  highlighted?: boolean;
  showQuickActions?: boolean;
  onQuickWhatsApp?: () => void;
  onQuickSchedule?: () => void;
}) {
  const temperature = getTemperatureLabel(lead.temperature);
  const value = formatCurrency(lead.estimated_value);
  const sla = getSlaLabel(lead);

  function quick(event: MouseEvent<HTMLButtonElement>, action?: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  }

  return (
    <div
      className={`group relative w-full rounded-lg border bg-[#121119] p-3 text-left shadow-lg shadow-black/10 transition hover:border-[#8B5CF6]/60 ${
        highlighted ? "border-[#8B5CF6] shadow-[#8B5CF6]/30" : "border-white/10"
      } ${dragging ? "opacity-60" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-zinc-200">
          {getLeadInitials(lead) || <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-white">{lead.name}</div>
          <div className="mt-1 truncate text-sm text-zinc-400">{lead.company || "Sem empresa"}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400">
          {formatPhoneCompact(lead.phone)}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <div className={`flex items-center justify-between gap-3 ${getFollowupLabel(lead).tone}`}>
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {getFollowupLabel(lead).text}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-zinc-500">
          <span>{getLastContactLabel(lead)}</span>
          {sla && <span className={sla.tone}>{sla.text}</span>}
        </div>
        {lead.owner_name && <div className="text-zinc-500">Resp. {lead.owner_name}</div>}
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
}: {
  templates: MessageTemplate[];
  onAddTemplate: (title: string, body: string) => void;
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
        {templates.map((template) => (
          <article className="rounded-xl border border-white/10 bg-white/[0.035] p-5" key={template.id}>
            <h3 className="font-medium">{template.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{template.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function WhatsAppConnection() {
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    configured: boolean;
    connected: boolean;
    state: string;
    instanceName?: string;
    phoneNumber?: string | null;
    profileName?: string | null;
    error?: string;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");

  const loadStatus = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const response = await fetch("/api/evolution/status", { cache: "no-store" });
      const data = await response.json();
      setStatus({
        ...data,
        error: data.error ?? (!response.ok ? "Nao foi possivel consultar a Evolution" : undefined),
      });
      setLastCheckedAt(new Date().toISOString());
    } catch {
      setStatus({
        configured: true,
        connected: false,
        state: "error",
        error: "Nao foi possivel consultar a Evolution",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadQrCode() {
    setQrError("");
    setPairingCode(null);
    setQrLoading(true);

    try {
      const response = await fetch("/api/evolution/qrcode", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || data.error) {
        setQrError(data.error ?? "Nao foi possivel gerar o QR Code");
        return;
      }

      setQrCode(data.base64 ?? null);
      setPairingCode(data.pairingCode ?? null);

      if (!data.base64 && !data.pairingCode) {
        setQrError("A Evolution retornou codigo de conexao, mas nao retornou imagem de QR Code.");
      }

      await loadStatus(false);
    } catch {
      setQrError("Nao foi possivel gerar o QR Code");
    } finally {
      setQrLoading(false);
    }
  }

  async function disconnectWhatsApp() {
    setQrError("");
    setDisconnecting(true);

    try {
      const response = await fetch("/api/evolution/disconnect", {
        method: "DELETE",
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        setQrError(data.error ?? "Nao foi possivel desconectar o WhatsApp");
        return;
      }

      setQrCode(null);
      setPairingCode(null);
      await loadStatus(false);
    } catch {
      setQrError("Nao foi possivel desconectar o WhatsApp");
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    const interval = window.setInterval(() => {
      void loadStatus(false);
    }, 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadStatus]);

  const connected = status?.connected;
  const healthTone = connected
    ? "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]"
    : status?.error
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-amber-400/30 bg-amber-500/10 text-amber-100";

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Instancia</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {status?.instanceName || "OrigoCRM"}
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
              connected ? "bg-[#25D366]/15 text-[#25D366]" : "bg-red-500/15 text-red-300"
            }`}
          >
            {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {connected ? "Conectado" : "Desconectado"}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className={`rounded-lg border p-4 ${healthTone}`}>
            <div className="text-sm opacity-80">Saude da conexao</div>
            <div className="mt-1 font-medium">
              {connected ? "Operacional" : status?.error ? "Com erro" : "Aguardando conexao"}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-sm text-zinc-500">Estado tecnico</div>
                <div className="mt-1 font-mono text-sm text-zinc-200">
                  {loading ? "consultando..." : status?.state ?? "indefinido"}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Numero conectado</div>
                <div className="mt-1 font-mono text-sm text-zinc-200">
                  {status?.phoneNumber || "Nao informado pela Evolution"}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Perfil</div>
                <div className="mt-1 text-sm text-zinc-200">
                  {status?.profileName || "Nao informado"}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ultima verificacao</div>
                <div className="mt-1 text-sm text-zinc-200">
                  {lastCheckedAt
                    ? new Date(lastCheckedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Pendente"}
                </div>
              </div>
            </div>
            {status?.error && <p className="mt-3 text-sm text-red-300">{status.error}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            onClick={() => void loadStatus()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {connected ? (
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-4 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
              disabled={disconnecting}
              onClick={disconnectWhatsApp}
              type="button"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
              Desconectar
            </button>
          ) : (
            <button
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium transition hover:bg-[#7C3AED] disabled:opacity-60"
              disabled={qrLoading}
              onClick={loadQrCode}
              type="button"
            >
              {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Reconectar / Gerar QR
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Conectar WhatsApp</h2>
        <div className="mt-5 flex min-h-80 items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 p-5">
          {connected ? (
            <div className="text-center text-sm text-zinc-400">
              <Wifi className="mx-auto mb-3 h-8 w-8 text-[#25D366]" />
              WhatsApp conectado. As conversas novas chegam pelo webhook.
            </div>
          ) : qrCode ? (
            // QR Code vem como data URL da Evolution, entao nao passa pelo otimizador de imagem.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="QR Code para conectar WhatsApp"
              className="h-72 w-72 rounded-lg bg-white p-3"
              src={qrCode}
            />
          ) : pairingCode ? (
            <div className="text-center">
              <div className="text-sm text-zinc-500">Codigo de pareamento</div>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-5 py-3 font-mono text-2xl tracking-widest text-zinc-100">
                {pairingCode}
              </div>
            </div>
          ) : (
            <div className="max-w-sm text-center text-sm leading-6 text-zinc-500">
              Gere o QR Code e leia com o app do WhatsApp no celular. Depois clique em Atualizar
              para confirmar o status conectado. A tela tambem consulta o status automaticamente.
            </div>
          )}
        </div>
        {qrError && <p className="mt-3 text-sm text-red-300">{qrError}</p>}
      </section>
    </div>
  );
}

type ConversationStatusFilter = "all" | "unread" | "waiting" | "responded" | "converted";
type ConversationLeadFilter = "all" | "without" | "with";
type ConversationStatus = Exclude<ConversationStatusFilter, "all">;
type ConversationCounts = {
  all: number;
  unread: number;
  waiting: number;
  responded: number;
  converted: number;
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
];

function Conversations({
  leads,
  templates,
  onLeadCreated,
  onOpenLead,
}: {
  leads: Lead[];
  templates: MessageTemplate[];
  onLeadCreated: (lead: Lead) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("all");
  const [leadFilter, setLeadFilter] = useState<ConversationLeadFilter>("all");
  const [readPhones, setReadPhones] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [actionError, setActionError] = useState("");
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!mounted) return;
        setMessages((data as WhatsAppMessage[] | null) ?? []);
        setLoading(false);
      });

    const channel = supabase
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

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
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
        const lead = leads.find((item) => item.id === linkedLeadId);
        const existingLead = lead ?? findLeadByPhone(leads, phone);
        const contactMessage = [...items].reverse().find((item) => item.contact_name);
        const avatarMessage = [...items].reverse().find((item) => item.contact_avatar_url);
        const contactName = lead?.name ?? existingLead?.name ?? contactMessage?.contact_name ?? phone;
        const pendingInbound = countPendingInboundMessages(items);
        const unreadCount = readPhones.has(phone) ? 0 : pendingInbound;
        const status = conversationStatus(lastMessage.direction, Boolean(lead), unreadCount);
        return {
          phone,
          lead,
          existingLead,
          messages: items,
          lastMessage,
          contactName,
          avatarUrl: avatarMessage?.contact_avatar_url ?? null,
          unreadCount,
          pendingInbound,
          status,
          statusLabel: conversationStatusLabel(status),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime(),
      );
  }, [messages, leads, readPhones]);

  const conversationCounts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((conversation) => conversation.status === "unread").length,
      waiting: conversations.filter((conversation) => conversation.status === "waiting").length,
      responded: conversations.filter((conversation) => conversation.status === "responded").length,
      converted: conversations.filter((conversation) => conversation.status === "converted").length,
    }),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const search = conversationQuery.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const matchesStatus = statusFilter === "all" || conversation.status === statusFilter;
      const matchesLead =
        leadFilter === "all" ||
        (leadFilter === "without" && !conversation.lead && !conversation.existingLead) ||
        (leadFilter === "with" && Boolean(conversation.lead || conversation.existingLead));
      const matchesSearch =
        !search ||
        [
          conversation.contactName,
          conversation.phone,
          conversation.lead?.company ?? "",
          conversation.lead?.source ?? "",
          ...conversation.messages.map((message) => message.content),
        ].some((value) => value.toLowerCase().includes(search));

      return matchesStatus && matchesLead && matchesSearch;
    });
  }, [conversationQuery, conversations, leadFilter, statusFilter]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.phone === selectedPhone) ??
    filteredConversations[0] ??
    conversations[0];

  const markConversationAsRead = useCallback(
    (phone: string, status: "responded" | "converted" = "responded") => {
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
    markConversationAsRead(phone, conversation?.lead ? "converted" : "responded");
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template || !selectedConversation) return;

    const virtualLead: Lead = selectedConversation.lead ?? {
      id: "",
      name: selectedConversation.contactName,
      phone: selectedConversation.phone,
      company: "",
      source: "WhatsApp",
      status: "novo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setReplyText(renderTemplate(template.body, virtualLead));
  }

  async function sendReply(body: string) {
    if (!selectedConversation || !body.trim()) return;

    setActionError("");
    setSending(true);
    const result = await sendWhatsAppConversationMessage(
      selectedConversation.phone,
      body.trim(),
      selectedConversation.lead?.id ?? null,
    );
    setSending(false);

    if (!result.success) {
      setActionError(result.error ?? "Nao foi possivel enviar a mensagem");
      return;
    }

    setReplyText("");
    if (result.message) {
      setMessages((current) => applyMessageRealtimeEvent(current, {
        eventType: "INSERT",
        new: result.message as unknown as Record<string, unknown>,
        old: {},
      }));
    }
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
    nextFollowupAt: string;
  }) {
    if (!selectedConversation || selectedConversation.lead) return;

    setActionError("");
    setSavingLead(true);
    const result = await saveWhatsAppConversationAsLead({
      phoneNumber: selectedConversation.phone,
      name: input.name,
      company: input.company,
      source: input.source,
      status: input.status,
      nextFollowupAt: input.nextFollowupAt ? new Date(input.nextFollowupAt).toISOString() : null,
    });
    setSavingLead(false);

    if (!result.success || !result.lead) {
      setActionError(result.error ?? "Nao foi possivel salvar o lead");
      return;
    }

    onLeadCreated(result.lead);
    setLeadModalOpen(false);
    setMessages((current) =>
      current.map((message) =>
        message.phone_number === selectedConversation.phone
          ? { ...message, lead_id: result.lead?.id ?? message.lead_id }
          : message,
      ),
    );
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
    <div className="grid h-[calc(100vh-11rem)] min-h-[560px] overflow-hidden rounded-xl border border-white/10 bg-[#101018] lg:grid-cols-[340px_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-white/10 bg-white/[0.025] lg:border-b-0 lg:border-r">
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
            <button
              className="h-9 rounded-lg border border-white/10 text-xs text-zinc-400 transition hover:bg-white/[0.06]"
              onClick={() => {
                setConversationQuery("");
                setStatusFilter("all");
                setLeadFilter("all");
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
                  {conversation.lastMessage.content || "Mensagem sem texto"}
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
                {!conversation.lead && conversation.existingLead && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                    Lead existente
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
                  <span>{selectedConversation.lead?.status ?? "sem lead"}</span>
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
              {selectedConversation.lead ? (
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                  onClick={() => selectedConversation.lead && onOpenLead(selectedConversation.lead)}
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir lead
                </button>
              ) : (
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#25D366]/30 px-3 text-sm text-[#25D366] transition hover:bg-[#25D366]/10 disabled:opacity-60"
                  disabled={savingLead}
                  onClick={() => setLeadModalOpen(true)}
                  type="button"
                >
                  {savingLead ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {selectedConversation.existingLead ? "Vincular ao lead" : "Salvar como lead"}
                </button>
              )}
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
                className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-6 ${
                  message.direction === "outbound"
                    ? "bg-[#25D366] text-black"
                    : "border border-white/10 bg-white/[0.06] text-zinc-100"
                }`}
              >
                <div>{message.content || "Mensagem sem texto"}</div>
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
                    onClick={() => void sendReply(message.content)}
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              disabled={templates.length === 0}
              onChange={(event) => applyTemplate(event.target.value)}
              value=""
            >
              <option value="">Mensagem pronta</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              {replyText.length}/1024 caracteres
            </span>
            <span className="text-xs text-zinc-600">Enter envia, Shift+Enter quebra linha</span>
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
      {leadModalOpen && selectedConversation && (
        <ConversationLeadModal
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
  initialName,
  phoneNumber,
  saving,
  existingLead,
  onClose,
  onSave,
}: {
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
    nextFollowupAt: string;
  }) => void;
}) {
  const [name, setName] = useState(existingLead?.name ?? initialName);
  const [company, setCompany] = useState(existingLead?.company ?? "");
  const [source, setSource] = useState(existingLead?.source ?? "WhatsApp");
  const [status, setStatus] = useState<LeadStatus>(existingLead?.status ?? "respondeu");
  const [nextFollowupAt, setNextFollowupAt] = useState("");

  return (
    <Modal onClose={onClose} title={existingLead ? "Vincular conversa ao lead" : "Salvar conversa como lead"}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ name, company, source, status, nextFollowupAt });
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
        <label className="block text-sm text-zinc-300">
          Status inicial
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
            value={status}
          >
            {pipelineColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
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
): ConversationStatus {
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

function sortWhatsAppMessages(a: WhatsAppMessage, b: WhatsAppMessage) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function migrationChecksInitialState(configured: boolean): MigrationCheck[] {
  if (!configured) {
    return [
      {
        label: "Campos comerciais",
        status: "missing",
        detail: "Supabase nao configurado neste ambiente",
      },
      {
        label: "Tabela de tarefas",
        status: "missing",
        detail: "Supabase nao configurado neste ambiente",
      },
    ];
  }

  return [
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
  ];
}

function SettingsView() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [checks, setChecks] = useState<MigrationCheck[]>(() => migrationChecksInitialState(Boolean(supabase)));

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    const client = supabase;

    async function runChecks() {
      const [commercial, tasksResult] = await Promise.all([
        client
          .from("leads")
          .select("id,estimated_value,owner_name,temperature,outcome_reason,sla_hours")
          .limit(1),
        client
          .from("tasks")
          .select("id,lead_id,type,title,due_at,status,completed_at")
          .limit(1),
      ]);

      if (!mounted) return;

      setChecks([
        {
          label: "Campos comerciais",
          status: commercial.error ? "missing" : "ok",
          detail: commercial.error
            ? "Aplique supabase/commercial_pipeline_migration.sql"
            : "Campos comerciais disponiveis em leads",
        },
        {
          label: "Tabela de tarefas",
          status: tasksResult.error ? "missing" : "ok",
          detail: tasksResult.error
            ? "Aplique supabase/tasks_migration.sql e tasks_meeting_type_migration.sql"
            : "Tabela tasks disponivel para agenda profissional",
        },
      ]);
    }

    void runChecks();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Banco de dados</h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-400">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <span>Supabase</span>
            <span className="text-[#25D366]">Ativo</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <span>Tabelas do CRM</span>
            <span>leads, interacoes, mensagens, tarefas</span>
          </div>
          {checks.map((check) => (
            <div className="rounded-lg border border-white/10 bg-black/20 p-3" key={check.label}>
              <div className="flex items-center justify-between gap-3">
                <span>{check.label}</span>
                <span className={
                  check.status === "ok"
                    ? "text-[#25D366]"
                    : check.status === "missing"
                      ? "text-amber-300"
                      : "text-zinc-500"
                }>
                  {check.status === "ok" ? "Aplicada" : check.status === "missing" ? "Pendente" : "Verificando"}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Evolution</h2>
        <div className="mt-4 space-y-3 text-sm text-zinc-400">
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-zinc-500">Webhook publico</div>
            <div className="mt-1 break-all font-mono text-xs text-zinc-300">
              /api/webhooks/evolution
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-zinc-500">Variaveis esperadas na Vercel</div>
            <div className="mt-1 font-mono text-xs text-zinc-300">
              EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME,
              EVOLUTION_WEBHOOK_KEY
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LeadForm({
  lead,
  onClose,
  onSave,
}: {
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
            {pipelineColumns.map((column) => (
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

function LeadDetails({
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

  function updateCommercialField<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setCommercialForm((current) => ({ ...current, [key]: value }));
  }

  function updateTaskField<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setTaskForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal onClose={onClose} title={lead.name} wide>
      <div className="space-y-5">
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
                  {pipelineColumns.map((column) => (
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

        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <div className="text-sm text-zinc-500">Empresa</div>
              <div className="mt-1">{lead.company || "Sem empresa"}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-500">Valor</div>
              <div className="mt-1">{formatCurrency(lead.estimated_value) ?? "Nao informado"}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-500">Temperatura</div>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-[#14131B] px-2 text-sm capitalize text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
                onChange={(event) =>
                  onUpdateTemperature(lead, event.target.value as NonNullable<Lead["temperature"]>)
                }
                value={lead.temperature ?? "morno"}
              >
                <option value="frio">Frio</option>
                <option value="morno">Morno</option>
                <option value="quente">Quente</option>
              </select>
            </div>
            <div>
              <div className="text-sm text-zinc-500">Responsavel</div>
              <div className="mt-1">{lead.owner_name || "Nao definido"}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-zinc-500">Proximo contato atual</div>
          <div className="mt-1">
            {lead.next_followup_at
              ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR")
              : "Nao agendado"}
          </div>
          {lead.outcome_reason && (
            <>
              <div className="mt-3 text-sm text-zinc-500">Motivo de ganho/perda</div>
              <div className="mt-1 text-sm text-zinc-300">{lead.outcome_reason}</div>
            </>
          )}
        </div>

        <div>
          <div className="mb-2 text-sm text-zinc-300">
            Mensagem pronta aplicada: {automaticTemplate?.title ?? "Nenhuma"}
          </div>
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

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          onClick={() => onDelete(lead)}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
          Excluir lead
        </button>
      </div>
    </Modal>
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
              <p className="font-medium text-red-100">Esta acao nao pode ser desfeita.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                O lead {lead.name} e suas interacoes serao apagados. O historico do WhatsApp sera
                preservado, mas ficara desvinculado deste lead.
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
            Excluir definitivamente
          </button>
        </div>
      </div>
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

