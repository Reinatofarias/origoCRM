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
  BarChart3,
  Check,
  Clock3,
  Edit3,
  ExternalLink,
  Flame,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";

import { pipelineColumns } from "@/lib/constants";
import { createSupabaseClient, isSupabaseConfigured } from "@/lib/db";
import type { Interaction, Lead, LeadInput, LeadStatus, MessageTemplate } from "@/lib/types";
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

type View = "dashboard" | "pipeline" | "leads" | "templates";
type AuthUser = { id: string; email?: string };
type Toast = { id: string; text: string };
type AuthMode = "login" | "signup";

const emptyLead: LeadInput = {
  name: "",
  phone: "",
  company: "",
  source: "",
  status: "novo",
};

export function CrmApp() {
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
      <main className="flex min-h-screen items-center justify-center bg-[#0B0B0F] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
      </main>
    );
  }

  if (!supabase) return <MissingSupabaseConfig />;

  if (!user) return <AuthScreen />;

  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

function MissingSupabaseConfig() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0B0F] px-5 text-white">
      <section className="w-full max-w-lg rounded-xl border border-white/10 bg-white/[0.04] p-6">
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
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setMessage("");
    setLoading(true);

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === "signup") {
      setMessage("Conta criada. Se o Supabase pedir confirmacao, verifique seu email.");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0B0F] px-5 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-sm text-zinc-300">
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            Prospeccao via WhatsApp
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight sm:text-7xl">ORIGOCRM</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
            Pipeline rapido, mensagens prontas e follow-up automatico para falar com mais leads.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-[#7C3AED]/10 backdrop-blur">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Acesse com email e senha. Os dados ficam salvos no Supabase.
            </p>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
            {[
              ["login", "Entrar"],
              ["signup", "Criar conta"],
            ].map(([key, label]) => (
              <button
                className={`h-10 rounded-md text-sm font-medium transition ${
                  mode === key
                    ? "bg-[#7C3AED] text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
                key={key}
                onClick={() => {
                  setMode(key as AuthMode);
                  setMessage("");
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <form className="space-y-4" onSubmit={handleAuth}>
            <label className="block text-sm text-zinc-300">
              Email
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-white outline-none ring-[#7C3AED]/50 transition focus:border-[#7C3AED] focus:ring-4"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Senha
              <input
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-white outline-none ring-[#7C3AED]/50 transition focus:border-[#7C3AED] focus:ring-4"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimo 6 caracteres"
                required
                type="password"
                value={password}
              />
            </label>
            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-4 font-medium transition hover:bg-[#6D28D9] disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          {message && <p className="mt-4 text-sm text-zinc-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}

function Workspace({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recentLeadId, setRecentLeadId] = useState<string | null>(null);
  const [remoteLeads, setRemoteLeads] = useState<Lead[]>([]);
  const [remoteTemplates, setRemoteTemplates] = useState<MessageTemplate[]>([]);
  const [remoteInteractions, setRemoteInteractions] = useState<Interaction[]>([]);
  const leads = remoteLeads;
  const templates = remoteTemplates;
  const interactions = remoteInteractions;
  const priorityLeads = useMemo(() => getPriorityLeads(leads), [leads]);

  useEffect(() => {
    async function loadRemoteData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [leadResult, templateResult, interactionResult] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("message_templates").select("*").order("created_at", { ascending: true }),
        supabase.from("interactions").select("*").order("created_at", { ascending: false }),
      ]);

      if (leadResult.error || templateResult.error || interactionResult.error) {
        setToast({
          id: newId("toast"),
          text: "Nao foi possivel carregar os dados do Supabase",
        });
      }

      setRemoteLeads((leadResult.data as Lead[] | null) ?? []);
      setRemoteTemplates((templateResult.data as MessageTemplate[] | null) ?? []);
      setRemoteInteractions((interactionResult.data as Interaction[] | null) ?? []);
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
    if (!search) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.phone, lead.company, lead.source].some((value) =>
        value.toLowerCase().includes(search),
      ),
    );
  }, [leads, query]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const leadsToday = leads.filter((lead) => {
    const created = new Date(lead.created_at);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  }).length;
  const activeLeads = leads.filter((lead) => lead.status !== "fechado").length;

  function showToast(text: string) {
    setToast({ id: newId("toast"), text });
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
    patchLeadOptimistic(lead.id, { next_followup_at: nextFollowupAt });
    const interaction = makeInteraction(
      lead.id,
      `Follow-up criado para ${new Date(nextFollowupAt).toLocaleDateString("pt-BR")}`,
      "followup_created",
    );
    addInteractionOptimistic(interaction);
    showToast("Follow-up agendado");

    if (supabase) {
      const [{ error: leadError }, { error: interactionError }] = await Promise.all([
        supabase.from("leads").update({ next_followup_at: nextFollowupAt }).eq("id", lead.id),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);
      if (leadError || interactionError) showToast("Erro ao salvar follow-up");
    }
  }



  async function addInteraction(leadId: string, note: string) {
    const interaction = makeInteraction(leadId, note, "note");
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

    patchLeadOptimistic(lead.id, {
      status: "contatado",
      last_contact_at: now,
      next_followup_at: nextFollowupAt,
      updated_at: now,
    });
    addInteractionOptimistic(interaction);
    showToast("Mensagem enviada");

    window.open(
      `https://wa.me/${normalizePhone(lead.phone)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );

    setSelectedLeadId(nextLead?.id ?? null);

    if (supabase) {
      const [{ error: leadError }, { error: interactionError }] = await Promise.all([
        supabase
          .from("leads")
          .update({
            status: "contatado",
            last_contact_at: now,
            next_followup_at: nextFollowupAt,
          })
          .eq("id", lead.id),
        supabase.from("interactions").insert({ ...interaction, user_id: user.id }),
      ]);
      if (leadError || interactionError) showToast("Erro ao salvar envio no Supabase");
    }
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
    <main className="min-h-screen bg-[#0B0B0F] text-white">
      {toast && (
        <div className="fixed right-4 top-4 z-[60] rounded-lg border border-[#7C3AED]/40 bg-[#17111f] px-4 py-3 text-sm shadow-2xl shadow-[#7C3AED]/30">
          {toast.text}
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/10 bg-black/20 px-4 py-4 lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div>
              <div className="text-xl font-semibold tracking-tight">ORIGOCRM</div>
              <div className="mt-1 text-xs text-zinc-500">{user.email}</div>
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
              ["leads", "Leads", UserRound],
              ["templates", "Mensagens prontas", MessageCircle],
            ].map(([key, label, Icon]) => (
              <button
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition lg:justify-start ${
                  view === key
                    ? "bg-[#7C3AED] text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
                key={key as string}
                onClick={() => setView(key as View)}
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
                {view === "leads" && "Leads"}
                {view === "templates" && "Mensagens prontas"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Cadencia continua: abrir, enviar, proximo.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#7C3AED] sm:w-72"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar lead"
                  value={query}
                />
              </div>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-4 text-sm font-medium transition hover:bg-[#6D28D9]"
                onClick={() => {
                  setEditingLead(null);
                  setLeadFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Novo lead
              </button>
            </div>
          </header>

          <div className="p-5">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
              </div>
            ) : (
              <>
                {view === "dashboard" && (
                  <Dashboard
                    activeLeads={activeLeads}
                    leads={leads}
                    leadsToday={leadsToday}
                    onOpen={(lead) => setSelectedLeadId(lead.id)}
                    priorityLeads={priorityLeads}
                    recentLeadId={recentLeadId}
                  />
                )}
                {view === "pipeline" && (
                  <Pipeline
                    leads={filteredLeads}
                    onLeadClick={(lead) => setSelectedLeadId(lead.id)}
                    onQuickSchedule={(lead) => scheduleFollowup(lead, addDays(1))}
                    onQuickWhatsApp={(lead) => setSelectedLeadId(lead.id)}
                    onStatusChange={updateLeadStatus}
                    recentLeadId={recentLeadId}
                  />
                )}
                {view === "leads" && (
                  <LeadList
                    leads={filteredLeads}
                    onEdit={(lead) => {
                      setEditingLead(lead);
                      setLeadFormOpen(true);
                    }}
                    onOpen={(lead) => setSelectedLeadId(lead.id)}
                  />
                )}
                {view === "templates" && <Templates templates={templates} onAddTemplate={addTemplate} />}
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
          onClose={() => setSelectedLeadId(null)}
          onSend={sendWhatsApp}
          templates={templates}
        />
      )}
    </main>
  );
}

function Dashboard({
  leadsToday,
  activeLeads,
  leads,
  priorityLeads,
  recentLeadId,
  onOpen,
}: {
  leadsToday: number;
  activeLeads: number;
  leads: Lead[];
  priorityLeads: Lead[];
  recentLeadId: string | null;
  onOpen: (lead: Lead) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Leads do dia" value={leadsToday} />
        <Metric title="Leads ativos" value={activeLeads} />
        <Metric title="Fechados" value={leads.filter((lead) => lead.status === "fechado").length} />
      </div>
      <div className="rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/[0.06] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Flame className="h-5 w-5 text-[#A78BFA]" />
            Prioridade do dia
          </h2>
          <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs text-zinc-300">
            {priorityLeads.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(priorityLeads.length ? priorityLeads : leads.filter((lead) => lead.status !== "fechado"))
            .slice(0, 6)
            .map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onOpen(lead)}
                highlighted={recentLeadId === lead.id}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-sm text-zinc-500">{title}</div>
      <div className="mt-3 text-4xl font-semibold">{value}</div>
    </div>
  );
}

function Pipeline({
  leads,
  recentLeadId,
  onLeadClick,
  onStatusChange,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  leads: Lead[];
  recentLeadId: string | null;
  onLeadClick: (lead: Lead) => void;
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
      <div className="grid gap-4 overflow-x-auto pb-3 xl:grid-cols-5">
        {pipelineColumns.map((column) => {
          const columnLeads = leads.filter((lead) => lead.status === column.id);
          return (
            <PipelineColumn
              key={column.id}
              id={column.id}
              leads={columnLeads}
              onLeadClick={onLeadClick}
              onQuickSchedule={onQuickSchedule}
              onQuickWhatsApp={onQuickWhatsApp}
              recentLeadId={recentLeadId}
              title={column.title}
            />
          );
        })}
      </div>
    </DndContext>
  );
}

function PipelineColumn({
  id,
  title,
  leads,
  recentLeadId,
  onLeadClick,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  id: LeadStatus;
  title: string;
  leads: Lead[];
  recentLeadId: string | null;
  onLeadClick: (lead: Lead) => void;
  onQuickWhatsApp: (lead: Lead) => void;
  onQuickSchedule: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`min-h-72 min-w-64 rounded-xl border p-3 transition ${
        isOver ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-white/10 bg-white/[0.025]"
      }`}
      ref={setNodeRef}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-zinc-400">
          {leads.length}
        </span>
      </div>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              highlighted={recentLeadId === lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onQuickSchedule={() => onQuickSchedule(lead)}
              onQuickWhatsApp={() => onQuickWhatsApp(lead)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableLeadCard({
  lead,
  highlighted,
  onClick,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  highlighted: boolean;
  onClick: () => void;
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
  dragging = false,
  highlighted = false,
  showQuickActions = false,
  onQuickWhatsApp,
  onQuickSchedule,
}: {
  lead: Lead;
  onClick: () => void;
  dragging?: boolean;
  highlighted?: boolean;
  showQuickActions?: boolean;
  onQuickWhatsApp?: () => void;
  onQuickSchedule?: () => void;
}) {
  function quick(event: MouseEvent<HTMLButtonElement>, action?: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  }

  return (
    <div
      className={`group relative w-full rounded-lg border bg-[#111118] p-4 text-left shadow-lg shadow-black/10 transition hover:border-[#7C3AED]/60 ${
        highlighted ? "border-[#7C3AED] shadow-[#7C3AED]/30" : "border-white/10"
      } ${dragging ? "opacity-60" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="font-medium text-white">{lead.name}</div>
      <div className="mt-1 text-sm text-zinc-400">{lead.company || "Sem empresa"}</div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{lead.source || "Origem nao informada"}</span>
        <span>{lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR") : lead.phone}</span>
      </div>
      {showQuickActions && (
        <div className="mt-3 grid grid-cols-3 gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
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
            onClick={(event) => quick(event, onQuickWhatsApp)}
            title="Usar template rapido"
            type="button"
          >
            <Zap className="h-4 w-4" />
          </button>
          <button
            className="flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-zinc-200"
            onClick={(event) => quick(event, onQuickSchedule)}
            title="Agendar follow-up"
            type="button"
          >
            <Clock3 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function LeadList({
  leads,
  onOpen,
  onEdit,
}: {
  leads: Lead[];
  onOpen: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {leads.map((lead) => (
        <div
          className="grid gap-3 border-b border-white/10 bg-white/[0.025] p-4 last:border-b-0 md:grid-cols-[1fr_1fr_140px_96px]"
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
          className="mt-4 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none transition focus:border-[#7C3AED]"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo"
          required
          value={title}
        />
        <textarea
          className="mt-3 min-h-36 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#7C3AED]"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Mensagem"
          required
          value={body}
        />
        <button className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] text-sm font-medium">
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
        <label className="block text-sm text-zinc-300">
          Status
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#101018] px-3 text-white outline-none transition focus:border-[#7C3AED]"
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
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] font-medium">
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
  onClose,
  onSend,
  onAddInteraction,
}: {
  lead: Lead;
  templates: MessageTemplate[];
  interactions: Interaction[];
  onClose: () => void;
  onSend: (lead: Lead, message: string, nextFollowupAt: string) => void;
  onAddInteraction: (leadId: string, note: string) => void;
}) {
  const automaticTemplate = pickTemplate(templates, lead);
  const [message, setMessage] = useState(automaticTemplate ? renderTemplate(automaticTemplate.body, lead) : "");
  const [followupDays, setFollowupDays] = useState(1);
  const [note, setNote] = useState("");
  const nextFollowupAt = addDays(followupDays);

  return (
    <Modal onClose={onClose} title={lead.name}>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-zinc-500">Empresa</div>
          <div className="mt-1">{lead.company || "Sem empresa"}</div>
          <div className="mt-3 text-sm text-zinc-500">Proximo contato atual</div>
          <div className="mt-1">
            {lead.next_followup_at
              ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR")
              : "Nao agendado"}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm text-zinc-300">
            Mensagem pronta aplicada: {automaticTemplate?.title ?? "Nenhuma"}
          </div>
          <textarea
            className="min-h-32 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-200 outline-none transition focus:border-[#7C3AED]"
            onChange={(event) => setMessage(event.target.value)}
            value={message}
          />
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-zinc-300">Proximo contato:</div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 5].map((days) => (
              <button
                className={`h-10 rounded-lg border text-sm transition ${
                  followupDays === days
                    ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"
                }`}
                key={days}
                onClick={() => setFollowupDays(days)}
                type="button"
              >
                {days === 1 ? "Amanha" : `${days} dias`}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Sera salvo para {new Date(nextFollowupAt).toLocaleDateString("pt-BR")}.
          </div>
        </div>

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] font-semibold text-black shadow-lg shadow-[#7C3AED]/20 transition hover:brightness-110 active:shadow-[#7C3AED]/60"
          onClick={() => onSend(lead, message, nextFollowupAt)}
          type="button"
        >
          <MessageCircle className="h-4 w-4" />
          Enviar mensagem agora
          <ExternalLink className="h-4 w-4" />
        </button>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onAddInteraction(lead.id, note);
            setNote("");
          }}
        >
          <textarea
            className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#7C3AED]"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Registrar interacao"
            required
            value={note}
          />
          <button className="mt-2 h-10 w-full rounded-lg border border-white/10 text-sm text-zinc-300 transition hover:bg-white/[0.06]">
            Registrar interacao
          </button>
        </form>

        <Timeline interactions={interactions} />
      </div>
    </Modal>
  );
}

function Timeline({ interactions }: { interactions: Interaction[] }) {
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Timeline</h3>
      {sorted.length === 0 && <p className="text-sm text-zinc-500">Nenhuma interacao ainda.</p>}
      {sorted.map((interaction) => (
        <div className="relative border-l border-white/10 pl-4" key={interaction.id}>
          <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[#7C3AED]" />
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{timelineTitle(interaction)}</span>
              <span>{new Date(interaction.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{interaction.message ?? interaction.note}</p>
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

function Input({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none transition focus:border-[#7C3AED]"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-[#0F0F16] p-5 shadow-2xl shadow-black">
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
