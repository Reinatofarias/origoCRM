"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Edit3,
  Eye,
  ExternalLink,
  FileDown,
  Archive,
  Loader2,
  Link2,
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
  Moon,
  Sun,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";

import { recordAuditLog as recordAuditLogAction } from "@/actions/audit";
import {
  createLead as createLeadAction,
  deleteLead as deleteLeadAction,
  unarchiveLead as unarchiveLeadAction,
  updateLead as updateLeadAction,
} from "@/actions/leads";
import {
  cancelOrganizationInvitation,
  createOrganizationInvitation,
  disableOrganizationMember,
  ensureOrganizationContext,
  listOrganizationInvitations,
  listOrganizationMembers,
  updateOrganizationMemberRole,
  type OrganizationContext,
  type OrganizationInvitationRow,
  type OrganizationMemberRow,
} from "@/actions/organizations";
import { moveLeadStage } from "@/actions/pipeline";
import { createProspectingCampaign as createProspectingCampaignAction } from "@/actions/prospecting";
import {
  assignLeadTag as assignLeadTagAction,
  createTag as createTagAction,
  removeLeadTag as removeLeadTagAction,
} from "@/actions/tags";
import {
  completeTask as completeTaskAction,
  createTask as createTaskAction,
  deleteTask as deleteTaskAction,
  rescheduleTask as rescheduleTaskAction,
  updateTask as updateTaskAction,
} from "@/actions/tasks";
import {
  checkWhatsAppNumbers,
  saveWhatsAppConversationAsLead,
  sendWhatsAppConversationMessage,
  sendWhatsAppMessage,
  updateWhatsAppConversationStatus,
} from "@/actions/whatsapp";
import {
  createPipelineStageId,
  emptyLead,
  groupLeadTagsByLead,
  pickTagColor,
  readPipelineStages,
  readSavedPipelineFilterPresets,
  readSavedPipelineFilters,
  resolvePipelineStageId,
  type PipelineStage,
  type SavedPipelineFilter,
} from "@/components/crm/pipeline-state";
import { PipelineStagesModal } from "@/components/crm/pipeline-controls";
import { LeadList, Pipeline } from "@/components/crm/pipeline-board";
import {
  ConfirmDeleteLead,
  ConfirmDeleteTask,
  ConfirmDeleteTemplate,
} from "@/components/crm/confirmations";
import { CrmContentHeader, type CrmViewMode } from "@/components/crm/content-header";
import {
  DashboardActivityChart,
  DashboardFunnelChart,
  DashboardScoreChart,
  DashboardStageChart,
  DashboardTaskChart,
  type DashboardActivityDay,
} from "@/components/crm/dashboard-charts";
import {
  DashboardCompactMetric,
  DashboardEmpty,
  DashboardMiniLegend,
  DashboardPriorityCard,
} from "@/components/crm/dashboard-widgets";
import {
  DashboardLeadRow,
  DashboardOperationalTaskRow,
  DashboardRiskLeadRow,
} from "@/components/crm/dashboard-rows";
import { DashboardWhatsAppHealth } from "@/components/crm/dashboard-whatsapp-health";
import {
  applyMessageRealtimeEvent,
  conversationStatus,
  conversationStatusLabel,
  conversationStatusTabs,
  countPendingInboundMessages,
  findLeadByPhone,
  getPhoneCandidates,
  getRepeatedOutboundContactNames,
  getSafeConversationContactName,
  getStageTitle,
  getWhatsAppMessageDisplay,
  messageStatusLabel,
  previewTemplateText,
  sortConversations,
  upsertLocalConversation,
  upsertWhatsAppMessage,
  type ConversationLeadFilter,
  type ConversationPriorityFilter,
  type ConversationSort,
  type ConversationStatusFilter,
} from "@/components/crm/conversation-state";
import { useConversationInbox } from "@/components/crm/use-conversation-inbox";
import {
  ContactAvatar,
  ConversationDateDivider,
  ConversationInfoRow,
  ConversationSystemEvent,
  messageStatusIcon,
} from "@/components/crm/conversation-components";
import { ConversationLeadModal, type ConversationLeadSaveInput } from "@/components/crm/conversation-lead-modal";
import {
  endOfDay,
  formatCurrency,
  getDueAtLabel,
  getNextRecurringDueAt,
  getTaskRepeat,
  getTemperatureLabel,
  isCommercialTask,
  isFollowupDue,
  isFollowupOverdue,
  isLeadClosed,
  isLeadCreatedToday,
  isSameDay,
  isSameFollowupDay,
  isTaskDueOnDate,
  isTaskDueToday,
  isTaskOverdue,
  leadToInput,
  openGoogleCalendarEvent,
  startOfDay,
  stripTaskMetadata,
  taskRepeatLabel,
  taskTypeLabel,
  toDateTimeLocal,
  fromDateTimeLocal,
} from "@/components/crm/lead-helpers";
import { LeadHistory, timelineTitle } from "@/components/crm/lead-history";
import { LeadMetric, LeadSummaryItem } from "@/components/crm/lead-summary";
import { AuthScreen, MissingSupabaseConfig } from "@/components/crm/auth-screen";
import { CrmSidebar } from "@/components/crm/sidebar";
import {
  migrationSqlByLabel,
  modulePermissionGroups,
  readCrmPreferences,
  readUserRole,
  roleOptions,
  sensitivePermissionGroups,
  settingsTabs,
  type CrmPreferences,
  type SettingsTab,
} from "@/components/crm/settings-state";
import {
  SettingsDetailPanel,
  SettingsInput,
  SettingsMetric,
  SettingsStatusPill,
} from "@/components/crm/settings-components";
import {
  ConfirmDeleteGoogleEvent,
  GoogleEventEditorModal,
  TaskEditorModal,
} from "@/components/crm/task-modals";
import { TasksWorkspace } from "@/components/crm/tasks-workspace";
import { Templates } from "@/components/crm/templates-view";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventDraft,
  TaskEditorState,
  TaskInput,
  TaskScope,
} from "@/components/crm/tasks-types";
import { readCrmTheme, type CrmTheme } from "@/components/crm/theme";
import { Input, Modal } from "@/components/crm/ui";
import { createSupabaseClient, isSupabaseConfigured } from "@/lib/db";
import {
  can,
  crmPermissionLabels,
  crmRoleLabels,
  getPermissionsForRole,
  type CrmRole,
} from "@/lib/permissions";
import { calculateLeadScore } from "@/lib/lead-scoring";
import {
  billingPeriods,
  formatMoneyFromCents,
  getBillingPeriod,
  getPlan,
  getPlanLimits,
  getPlanMonthlyEquivalentCents,
  getPlanPriceCents,
  getPlanUserLimit,
  isSubscriptionOperational,
  planHasFeature,
  plans,
  type BillingPeriod,
  type PlanSlug,
} from "@/lib/plans";
import type {
  AuditLog,
  Interaction,
  Lead,
  LeadTag,
  LeadInput,
  LeadStatus,
  MessageTemplate,
  Tag as CrmTag,
  Task,
  WhatsAppLog,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/lib/types";
import { pathViews, type View, viewPaths } from "@/lib/navigation";
import { ProspectingModal } from "@/modules/prospecting";
import { normalizeProspectingWhatsAppPhone } from "@/modules/prospecting/utils/phone";
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

type AuthUser = { id: string; email: string };
type Toast = { id: string; text: string };
type DashboardAgendaItem = {
  lead: Lead | null;
  dueAt: string;
  title: string;
  task: Task | null;
};
type InteractionInput = {
  note: string;
  type: NonNullable<Interaction["type"]>;
  channel: Interaction["channel"];
};
type MigrationCheck = {
  label: string;
  status: "checking" | "ok" | "missing";
  detail: string;
};
type GoogleCalendarStatus = {
  configured: boolean;
  migrated: boolean;
  connected: boolean;
  error?: string;
  connection: {
    account_email: string | null;
    calendar_id: string | null;
    status: string;
    last_error: string | null;
    last_synced_at: string | null;
    updated_at: string | null;
  } | null;
};
type AuditLogInput = {
  entity_type: AuditLog["entity_type"];
  entity_id: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
};
type LeadCreateTab = "summary" | "commercial" | "tasks" | "contact" | "history";
export function CrmApp({
  initialView = "dashboard",
  initialSettingsTab = "system",
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
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? "" } : null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null,
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

function Workspace({
  user,
  onLogout,
  initialView,
  initialSettingsTab,
}: {
  user: AuthUser;
  onLogout: () => void;
  initialView: View;
  initialSettingsTab: SettingsTab;
}) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const routedView = pathViews[pathname] ?? initialView;
  const view =
    routedView === "whatsapp" || routedView === "templates"
      ? "settings"
      : routedView === "leads"
        ? "pipeline"
        : routedView;
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
  const [tagFilter, setTagFilter] = useState<string | "all">(savedFilters.tagFilter ?? "all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [prospectingOpen, setProspectingOpen] = useState(false);
  const [leadPendingDelete, setLeadPendingDelete] = useState<Lead | null>(null);
  const [templatePendingDelete, setTemplatePendingDelete] = useState<MessageTemplate | null>(null);
  const [pipelineStagesOpen, setPipelineStagesOpen] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(initialPipelineStages);
  const [selectedPipelineLeadIds, setSelectedPipelineLeadIds] = useState<Set<string>>(() => new Set());
  const [bulkOwnerName, setBulkOwnerName] = useState("");
  const [savedFilterPresets, setSavedFilterPresets] = useState<SavedPipelineFilter[]>(initialFilterPresets);
  const [toast, setToast] = useState<Toast | null>(null);
  const [crmTheme, setCrmTheme] = useState<CrmTheme>(() => readCrmTheme());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("origocrm:onboarding-dismissed") === "true" : false,
  );
  const [crmViewMode, setCrmViewMode] = useState<CrmViewMode>(() => (routedView === "leads" ? "list" : "kanban"));
  const [recentLeadId, setRecentLeadId] = useState<string | null>(null);
  const [remoteLeads, setRemoteLeads] = useState<Lead[]>([]);
  const [remoteArchivedLeads, setRemoteArchivedLeads] = useState<Lead[]>([]);
  const [remoteTemplates, setRemoteTemplates] = useState<MessageTemplate[]>([]);
  const [remoteInteractions, setRemoteInteractions] = useState<Interaction[]>([]);
  const [remoteTasks, setRemoteTasks] = useState<Task[]>([]);
  const [remoteWhatsAppMessages, setRemoteWhatsAppMessages] = useState<WhatsAppMessage[]>([]);
  const [remoteWhatsAppLogs, setRemoteWhatsAppLogs] = useState<WhatsAppLog[]>([]);
  const [remoteAuditLogs, setRemoteAuditLogs] = useState<AuditLog[]>([]);
  const [remoteTags, setRemoteTags] = useState<CrmTag[]>([]);
  const [remoteLeadTags, setRemoteLeadTags] = useState<LeadTag[]>([]);
  const [organizationContext, setOrganizationContext] = useState<OrganizationContext | null>(null);
  const [organizationReady, setOrganizationReady] = useState(false);
  const organizationId = organizationContext?.organization.id ?? null;
  const currentRole: CrmRole = organizationContext?.member.role ?? "owner";
  const currentPlanSlug: PlanSlug = organizationContext?.subscription?.plan_slug ?? "manual";
  const currentSubscriptionOperational = isSubscriptionOperational(
    organizationContext?.subscription?.status,
    organizationContext?.subscription?.provider,
  );
  const currentPlanLimits = useMemo(() => getPlanLimits(currentPlanSlug), [currentPlanSlug]);
  const currentPermissions = useMemo(() => getPermissionsForRole(currentRole), [currentRole]);
  const canCreateLead = currentPermissions.has("lead:create");
  const canDeleteLeads = currentPermissions.has("lead:delete");
  const canUpdatePipeline = currentPermissions.has("pipeline:update");
  const canUseProspecting =
    currentSubscriptionOperational &&
    currentPermissions.has("prospecting:use") &&
    planHasFeature(currentPlanSlug, "prospecting");
  const canManageTemplates = currentPermissions.has("template:manage");
  const leads = remoteLeads;
  const archivedLeads = remoteArchivedLeads;
  const templates = remoteTemplates;
  const interactions = remoteInteractions;
  const tasks = remoteTasks;
  const whatsappMessages = remoteWhatsAppMessages;
  const whatsappLogs = remoteWhatsAppLogs;
  const auditLogs = remoteAuditLogs;
  const tags = remoteTags;
  const leadTags = remoteLeadTags;
  const priorityLeads = useMemo(() => getPriorityLeads(leads), [leads]);
  const existingLeadPhones = useMemo(
    () => new Set([...leads, ...archivedLeads].map((lead) => normalizeProspectingWhatsAppPhone(lead.phone)).filter(Boolean)),
    [archivedLeads, leads],
  );
  const dispatchCountsByLeadId = useMemo(() => {
    const sentByMessage = new Map<string, number>();
    const sentByInteraction = new Map<string, number>();

    for (const message of whatsappMessages) {
      if (message.lead_id && message.direction === "outbound" && message.status !== "failed") {
        sentByMessage.set(message.lead_id, (sentByMessage.get(message.lead_id) ?? 0) + 1);
      }
    }

    for (const interaction of interactions) {
      if (interaction.type === "whatsapp_sent") {
        sentByInteraction.set(interaction.lead_id, (sentByInteraction.get(interaction.lead_id) ?? 0) + 1);
      }
    }

    const ids = new Set([...sentByMessage.keys(), ...sentByInteraction.keys()]);
    return new Map(Array.from(ids).map((id) => [id, Math.max(sentByMessage.get(id) ?? 0, sentByInteraction.get(id) ?? 0)]));
  }, [interactions, whatsappMessages]);
  const tagsByLeadId = useMemo(() => groupLeadTagsByLead(leadTags, tags), [leadTags, tags]);

  useEffect(() => {
    let mounted = true;

    async function loadOrganizationContext() {
      const result = await ensureOrganizationContext();
      if (!mounted) return;

      if (result.success && result.data) {
        setOrganizationContext(result.data);
      } else if (!result.success && !result.error.includes("Base SaaS pendente")) {
        setToast({
          id: newId("toast"),
          text: result.error,
        });
      }

      setOrganizationReady(true);
    }

    loadOrganizationContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    async function loadRemoteData() {
      if (!organizationReady) return;

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
        tagResult,
        leadTagResult,
      ] = await Promise.all([
        (organizationId ? supabase.from("leads").select("*").eq("organization_id", organizationId) : supabase.from("leads").select("*")).order("created_at", { ascending: false }),
        (organizationId ? supabase.from("message_templates").select("*").eq("organization_id", organizationId) : supabase.from("message_templates").select("*")).order("created_at", { ascending: true }),
        (organizationId ? supabase.from("interactions").select("*").eq("organization_id", organizationId) : supabase.from("interactions").select("*")).order("created_at", { ascending: false }),
        (organizationId ? supabase.from("tasks").select("*").eq("organization_id", organizationId) : supabase.from("tasks").select("*")).order("due_at", { ascending: true }).limit(200),
        (organizationId ? supabase.from("whatsapp_messages").select("*").eq("organization_id", organizationId) : supabase.from("whatsapp_messages").select("*")).order("created_at", { ascending: false }).limit(100),
        (organizationId ? supabase.from("whatsapp_logs").select("*").eq("organization_id", organizationId) : supabase.from("whatsapp_logs").select("*")).order("created_at", { ascending: false }).limit(30),
        (organizationId ? supabase.from("audit_logs").select("*").eq("organization_id", organizationId) : supabase.from("audit_logs").select("*")).order("created_at", { ascending: false }).limit(80),
        (organizationId ? supabase.from("tags").select("*").eq("organization_id", organizationId) : supabase.from("tags").select("*")).order("name", { ascending: true }),
        organizationId ? supabase.from("lead_tags").select("*").eq("organization_id", organizationId) : supabase.from("lead_tags").select("*"),
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
          text: "Não foi possível carregar os dados do Supabase",
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
      if (!tagResult.error) setRemoteTags((tagResult.data as CrmTag[] | null) ?? []);
      if (!leadTagResult.error) setRemoteLeadTags((leadTagResult.data as LeadTag[] | null) ?? []);
      setLoading(false);
    }

    loadRemoteData();
  }, [organizationId, organizationReady, supabase, user.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    window.localStorage.setItem(
      "origocrm:pipeline-filters",
      JSON.stringify({ statusFilter, temperatureFilter, dateFilter, tagFilter }),
    );
  }, [dateFilter, statusFilter, tagFilter, temperatureFilter]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:pipeline-filter-presets", JSON.stringify(savedFilterPresets));
  }, [savedFilterPresets]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:pipeline-stages", JSON.stringify(pipelineStages));
  }, [pipelineStages]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:theme", crmTheme);
  }, [crmTheme]);

  useEffect(() => {
    window.localStorage.setItem("origocrm:onboarding-dismissed", onboardingDismissed ? "true" : "false");
  }, [onboardingDismissed]);

  const showLeadHeaderControls = view === "pipeline";

  const filteredLeads = useMemo(() => {
    const search = showLeadHeaderControls ? query.trim().toLowerCase() : "";
    return leads.filter((lead) =>
      (!search ||
        [lead.name, lead.phone, lead.company, lead.source, lead.owner_name ?? ""].some((value) =>
          value.toLowerCase().includes(search),
        )) &&
      (statusFilter === "all" || lead.status === statusFilter) &&
      (temperatureFilter === "all" || (lead.temperature ?? "morno") === temperatureFilter) &&
      (tagFilter === "all" || (tagsByLeadId.get(lead.id) ?? []).some((tag) => tag.id === tagFilter)) &&
      (dateFilter === "all" ||
        (dateFilter === "today" && isLeadCreatedToday(lead)) ||
        (dateFilter === "overdue" && isFollowupOverdue(lead))),
    );
  }, [dateFilter, leads, query, showLeadHeaderControls, statusFilter, tagFilter, tagsByLeadId, temperatureFilter]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const onboardingSteps = [
    {
      id: "whatsapp",
      title: "Conectar WhatsApp",
      description: "Gere o QR Code da organização para receber e responder conversas.",
      done: whatsappMessages.length > 0 || whatsappLogs.some((log) => log.status === "success"),
      action: () => navigateView("whatsapp"),
      actionLabel: "Conectar",
    },
    {
      id: "lead",
      title: "Criar primeiro lead",
      description: "Cadastre uma oportunidade manual ou salve uma conversa como lead.",
      done: leads.length > 0,
      action: () => setLeadFormOpen(true),
      actionLabel: "Novo lead",
    },
    {
      id: "template",
      title: "Criar mensagem pronta",
      description: "Padronize a primeira abordagem para ganhar velocidade comercial.",
      done: templates.length > 0,
      action: () => navigateView("templates"),
      actionLabel: "Criar template",
    },
    {
      id: "task",
      title: "Registrar uma tarefa",
      description: "Centralize follow-ups e tarefas operacionais da rotina.",
      done: tasks.length > 0,
      action: () => navigateView("tasks"),
      actionLabel: "Abrir tarefas",
    },
    ...(canUseProspecting
      ? [
          {
            id: "prospecting",
            title: "Buscar empresas",
            description: "Use a prospecção para capturar contatos e iniciar campanhas.",
            done: false,
            action: () => setProspectingOpen(true),
            actionLabel: "Prospectar",
          },
        ]
      : []),
  ];
  const shouldShowOnboarding =
    view === "dashboard" &&
    !onboardingDismissed &&
    (checkoutSuccess || onboardingSteps.some((step) => !step.done));
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

  function withOrganizationPayload<T extends object>(payload: T) {
    return organizationId ? { ...payload, organization_id: organizationId } : payload;
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
      tags: (tagsByLeadId.get(lead.id) ?? []).map((tag) => tag.name).join(" | "),
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
      tags: "",
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
    if (nextView === "leads") {
      setCrmViewMode("list");
      if (pathname !== viewPaths.pipeline) router.push(viewPaths.pipeline);
      return;
    }
    if (nextView === "pipeline") setCrmViewMode("kanban");
    if (nextView !== "pipeline") setQuery("");
    const nextPath = viewPaths[nextView];
    if (pathname !== nextPath) router.push(nextPath);
  }

  function saveCurrentFilterPreset() {
    const name = window.prompt("Nome para este filtro:");
    const trimmedName = name?.trim();
    if (!trimmedName) return;

    const preset: SavedPipelineFilter = {
      id: newId("filter"),
      name: trimmedName,
      filters: { query, statusFilter, temperatureFilter, dateFilter, tagFilter },
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
    setTagFilter(preset.filters.tagFilter ?? "all");
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
      user_id: null,
      organization_id: organizationId,
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
    if (!can(currentRole, id ? "lead:update" : "lead:create")) {
      showToast(id ? "Você não tem permissão para editar leads" : "Você não tem permissão para criar leads");
      return null;
    }

    const timestamp = new Date().toISOString();

    if (id) {
      const previous = remoteLeads;
      patchLeadOptimistic(id, { ...input, updated_at: timestamp });
      const result = await updateLeadAction(id, input);
      if (!result.success) {
        setRemoteLeads(previous);
        showToast(result.error ?? "Erro ao atualizar lead");
        return null;
      }
      await recordAuditLog({
        entity_type: "lead",
        entity_id: id,
        action: "lead.updated",
        summary: `Lead atualizado: ${input.name}`,
        metadata: { status: input.status, temperature: input.temperature, owner_name: input.owner_name },
      });
      return (result.data as Lead | undefined) ?? null;
    }

    const result = await createLeadAction(input);

    if (!result.success) {
      showToast(result.error ?? "Erro ao criar lead");
      return null;
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
      return createdLead;
    }

    return null;
  }

  async function createLeadTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const existing = tags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;

    const optimisticTag: CrmTag = {
      id: newId("tag"),
      user_id: null,
      organization_id: organizationId,
      name: trimmed,
      color: pickTagColor(trimmed),
      created_at: new Date().toISOString(),
    };
    setRemoteTags((items) => [...items, optimisticTag].sort((a, b) => a.name.localeCompare(b.name)));

    const result = await createTagAction({ name: trimmed, color: optimisticTag.color });
    if (!result.success || !result.data) {
      setRemoteTags((items) => items.filter((tag) => tag.id !== optimisticTag.id));
      showToast(result.error ?? "Erro ao criar tag");
      return null;
    }

    const createdTag = result.data as CrmTag;
    setRemoteTags((items) =>
      items.map((tag) => (tag.id === optimisticTag.id ? createdTag : tag)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    return createdTag;
  }

  async function assignTagToLead(lead: Lead, tagId: string) {
    if (leadTags.some((item) => item.lead_id === lead.id && item.tag_id === tagId)) return;

    const optimistic: LeadTag = {
      user_id: user.id,
      organization_id: organizationId,
      lead_id: lead.id,
      tag_id: tagId,
      created_at: new Date().toISOString(),
    };
    setRemoteLeadTags((items) => [...items, optimistic]);

    const result = await assignLeadTagAction(lead.id, tagId);
    if (!result.success) {
      setRemoteLeadTags((items) => items.filter((item) => !(item.lead_id === lead.id && item.tag_id === tagId)));
      showToast(result.error ?? "Erro ao aplicar tag");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead.tag_added",
      summary: `Tag aplicada em ${lead.name}`,
      metadata: { tag_id: tagId },
    });
  }

  async function removeTagFromLead(lead: Lead, tagId: string) {
    const previous = remoteLeadTags;
    setRemoteLeadTags((items) => items.filter((item) => !(item.lead_id === lead.id && item.tag_id === tagId)));

    const result = await removeLeadTagAction(lead.id, tagId);
    if (!result.success) {
      setRemoteLeadTags(previous);
      showToast(result.error ?? "Erro ao remover tag");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead.tag_removed",
      summary: `Tag removida de ${lead.name}`,
      metadata: { tag_id: tagId },
    });
  }

  function requestDeleteLead(lead: Lead) {
    if (!canDeleteLeads) {
      showToast("Você não tem permissão para excluir leads");
      return;
    }

    setLeadPendingDelete(lead);
  }

  async function deleteLead(lead: Lead) {
    if (!canDeleteLeads) {
      showToast("Você não tem permissão para excluir leads");
      return;
    }

    const previousLeads = remoteLeads;
    const previousArchivedLeads = remoteArchivedLeads;
    const previousTasks = remoteTasks;
    const previousInteractions = remoteInteractions;
    const previousWhatsAppMessages = remoteWhatsAppMessages;
    const previousLeadTags = remoteLeadTags;

    setSelectedLeadId((current) => (current === lead.id ? null : current));
    setLeadPendingDelete(null);
    setRemoteLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteArchivedLeads((items) => items.filter((item) => item.id !== lead.id));
    setRemoteTasks((items) => items.filter((item) => item.lead_id !== lead.id));
    setRemoteInteractions((items) => items.filter((item) => item.lead_id !== lead.id));
    setRemoteWhatsAppMessages((items) =>
      items.map((message) => (message.lead_id === lead.id ? { ...message, lead_id: null } : message)),
    );
    setRemoteLeadTags((items) => items.filter((item) => item.lead_id !== lead.id));
    setSelectedPipelineLeadIds((current) => {
      const next = new Set(current);
      next.delete(lead.id);
      return next;
    });
    showToast("Lead excluído");

    const result = await deleteLeadAction(lead.id);

    if (!result.success) {
      setRemoteLeads(previousLeads);
      setRemoteArchivedLeads(previousArchivedLeads);
      setRemoteTasks(previousTasks);
      setRemoteInteractions(previousInteractions);
      setRemoteWhatsAppMessages(previousWhatsAppMessages);
      setRemoteLeadTags(previousLeadTags);
      showToast(result.error ?? "Erro ao excluir lead");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: lead.id,
      action: "lead.deleted",
      summary: `Lead excluído: ${lead.name}`,
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
    if (!canUpdatePipeline) {
      showToast("Você não tem permissão para alterar o funil");
      return;
    }

    const before = leads.find((lead) => lead.id === id);
    if (!before) return;

    void updateLeadStatus(id, status, before.outcome_reason ?? null);
  }

  async function updateLeadStatus(id: string, status: LeadStatus, outcomeReason: string | null) {
    const before = leads.find((lead) => lead.id === id);
    if (!before) return;

    const previousInteractions = remoteInteractions;
    const reason = outcomeReason?.trim() || before.outcome_reason?.trim() || "";

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
      metadata: { previous_status: before.status, next_status: status },
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
    if (!canDeleteLeads) {
      showToast("Você não tem permissão para excluir leads");
      return;
    }

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
      showToast(failed.error ?? "Erro ao atribuir responsável");
      return;
    }

    await recordAuditLog({
      entity_type: "lead",
      entity_id: null,
      action: "lead.bulk_owner_assigned",
      summary: `Responsável atribuído a ${selected.length} leads`,
      metadata: { lead_ids: Array.from(selectedIds), owner_name: ownerName },
    });
    setBulkOwnerName("");
    setSelectedPipelineLeadIds(new Set());
    showToast("Responsável atribuído");
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
      organization_id: organizationId,
      type: "followup",
      title: `Follow-up com ${lead.name}`,
      notes: null,
      priority: "medium",
      workflow_status: "todo",
      start_at: null,
      position: 0,
      due_at: nextFollowupAt,
      status: "open",
      completed_at: null,
      google_event_id: null,
      google_calendar_id: null,
      google_synced_at: null,
      google_sync_error: null,
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
            priority: task.priority ?? "medium",
            workflow_status: task.workflow_status ?? "todo",
            start_at: task.start_at ?? null,
            position: task.position ?? 0,
            due_at: task.due_at,
          },
          { cancelOpenFollowups: false },
        ),
        supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id })),
      ]);
      if (interactionError) showToast("Erro ao salvar follow-up");
      if (!taskResult.success) showToast("Follow-up salvo; aplique a migração de tarefas no Supabase");
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

  async function createTask(lead: Lead | null, input: TaskInput) {
    const now = new Date().toISOString();
    const leadId = lead?.id ?? input.lead_id ?? null;
    const task: Task = {
      id: newId("task"),
      lead_id: leadId,
      user_id: user.id,
      organization_id: organizationId,
      type: input.type,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      priority: input.priority ?? "medium",
      workflow_status: input.workflow_status ?? "todo",
      start_at: input.start_at ?? null,
      position: input.position ?? 0,
      due_at: input.due_at,
      status: "open",
      completed_at: null,
      google_event_id: null,
      google_calendar_id: null,
      google_synced_at: null,
      google_sync_error: null,
      created_at: now,
      updated_at: now,
    };
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const interaction = lead
      ? makeInteraction(
          lead.id,
          `Tarefa criada: ${task.title} (${taskTypeLabel(task.type)})`,
          task.type === "followup" ? "followup_created" : "note",
        )
      : null;

    setRemoteTasks((items) => [task, ...items]);
    const shouldUpdateLeadFollowup =
      lead !== null &&
      task.type === "followup" &&
      (!lead.next_followup_at ||
        new Date(task.due_at).getTime() <= new Date(lead.next_followup_at).getTime());
    if (shouldUpdateLeadFollowup && lead) {
      patchLeadOptimistic(lead.id, { next_followup_at: task.due_at, updated_at: now });
    }
    if (interaction) addInteractionOptimistic(interaction);
    showToast("Tarefa criada");

    if (supabase) {
      const taskResult = await createTaskAction(
        {
          id: task.id,
          lead_id: leadId,
          type: task.type,
          title: task.title,
          notes: task.notes,
          priority: task.priority ?? "medium",
          workflow_status: task.workflow_status ?? "todo",
          start_at: task.start_at ?? null,
          position: task.position ?? 0,
          due_at: task.due_at,
        },
        { cancelOpenFollowups: false },
      );
      const interactionError = interaction
        ? (await supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id }))).error
        : null;

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao criar tarefa. Verifique a migração de tarefas no Supabase");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.created",
        summary: `Tarefa criada: ${task.title}`,
        metadata: { lead_id: leadId, type: task.type, due_at: task.due_at },
      });
    }
  }

  async function completeTask(task: Task, lead: Lead | null) {
    const now = new Date().toISOString();
    const repeat = getTaskRepeat(task);
    const nextRecurringDueAt = getNextRecurringDueAt(task.due_at, repeat);
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const shouldClearFollowup = Boolean(lead && lead.next_followup_at === task.due_at);
    const interaction = lead
      ? makeInteraction(
          lead.id,
          `Follow-up concluido: ${task.title}`,
          "note",
        )
      : null;

    setRemoteTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? { ...item, status: "completed", completed_at: now, updated_at: now }
          : item,
      ),
    );
    if (shouldClearFollowup && lead) {
      patchLeadOptimistic(lead.id, { next_followup_at: null, updated_at: now });
    }
    if (interaction) addInteractionOptimistic(interaction);
    showToast("Tarefa concluida");

    if (supabase) {
      const taskResult = await completeTaskAction(task.id, { leadId: task.lead_id ?? lead?.id ?? null, clearLeadFollowup: shouldClearFollowup });
      const interactionError = interaction
        ? (await supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id }))).error
        : null;

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
        metadata: { lead_id: task.lead_id ?? lead?.id ?? null, type: task.type, completed_at: now },
      });
    }

    if (nextRecurringDueAt) {
      await createTask(lead, {
        lead_id: lead?.id ?? null,
        type: task.type,
        title: task.title,
        notes: task.notes ?? null,
        priority: task.priority ?? "medium",
        workflow_status: task.workflow_status ?? "todo",
        start_at: task.start_at ?? null,
        position: task.position ?? 0,
        due_at: nextRecurringDueAt,
      });
    }
  }

  async function rescheduleTask(task: Task, lead: Lead | null, dueAt: string) {
    const now = new Date().toISOString();
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const interaction = lead
      ? makeInteraction(
          lead.id,
          `Tarefa reagendada: ${task.title} para ${new Date(dueAt).toLocaleString("pt-BR")}`,
          task.type === "followup" ? "followup_created" : "note",
        )
      : null;

    setRemoteTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? { ...item, due_at: dueAt, status: "open", completed_at: null, updated_at: now }
          : item,
      ),
    );
    if (task.type === "followup" && lead) {
      patchLeadOptimistic(lead.id, { next_followup_at: dueAt, updated_at: now });
    }
    if (interaction) addInteractionOptimistic(interaction);
    showToast("Tarefa reagendada");

    if (supabase) {
      const taskResult = await rescheduleTaskAction(task.id, {
        leadId: task.lead_id ?? lead?.id ?? null,
        dueAt,
        updateLeadFollowup: task.type === "followup" && Boolean(lead),
      });
      const interactionError = interaction
        ? (await supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id }))).error
        : null;

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao reagendar tarefa");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.rescheduled",
        summary: `Tarefa reagendada: ${task.title}`,
        metadata: { lead_id: task.lead_id ?? lead?.id ?? null, type: task.type, due_at: dueAt },
      });
    }
  }

  async function updateTask(task: Task, lead: Lead | null, input: TaskInput) {
    const now = new Date().toISOString();
    const nextLead = input.lead_id ? remoteLeads.find((item) => item.id === input.lead_id) ?? lead : null;
    const previousTasks = remoteTasks;
    const previousLeads = remoteLeads;
    const previousInteractions = remoteInteractions;
    const interaction = nextLead
      ? makeInteraction(
          nextLead.id,
          `Tarefa atualizada: ${input.title.trim()}`,
          input.type === "followup" ? "followup_created" : "note",
        )
      : null;

    setRemoteTasks((items) =>
      items.map((item) =>
        item.id === task.id
          ? {
              ...item,
              lead_id: input.lead_id ?? null,
              type: input.type,
              title: input.title.trim(),
              notes: input.notes?.trim() || null,
              priority: input.priority ?? item.priority ?? "medium",
              workflow_status: input.workflow_status ?? item.workflow_status ?? "todo",
              start_at: input.start_at ?? item.start_at ?? null,
              position: input.position ?? item.position ?? 0,
              due_at: input.due_at,
              updated_at: now,
            }
          : item,
      ),
    );
    if (input.type === "followup" && nextLead) {
      patchLeadOptimistic(nextLead.id, { next_followup_at: input.due_at, updated_at: now });
    }
    if (interaction) addInteractionOptimistic(interaction);
    showToast("Tarefa atualizada");

    if (supabase) {
      const taskResult = await updateTaskAction(task.id, {
        id: task.id,
        lead_id: input.lead_id ?? null,
        type: input.type,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        priority: input.priority ?? "medium",
        workflow_status: input.workflow_status ?? "todo",
        start_at: input.start_at ?? null,
        position: input.position ?? 0,
        due_at: input.due_at,
      });
      const interactionError = interaction
        ? (await supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id }))).error
        : null;

      if (!taskResult.success || interactionError) {
        setRemoteTasks(previousTasks);
        setRemoteLeads(previousLeads);
        setRemoteInteractions(previousInteractions);
        showToast("Erro ao atualizar tarefa");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.updated",
        summary: `Tarefa atualizada: ${input.title.trim()}`,
        metadata: { lead_id: input.lead_id ?? null, type: input.type, due_at: input.due_at },
      });
    }
  }

  async function deleteTask(task: Task, lead: Lead | null) {
    const previousTasks = remoteTasks;
    setRemoteTasks((items) => items.filter((item) => item.id !== task.id));
    showToast("Tarefa excluida");

    if (supabase) {
      const taskResult = await deleteTaskAction(task.id, { leadId: task.lead_id ?? lead?.id ?? null });

      if (!taskResult.success) {
        setRemoteTasks(previousTasks);
        showToast("Erro ao excluir tarefa");
        return;
      }

      await recordAuditLog({
        entity_type: "task",
        entity_id: task.id,
        action: "task.deleted",
        summary: `Tarefa excluida: ${task.title}`,
        metadata: { lead_id: task.lead_id ?? lead?.id ?? null, type: task.type },
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
      user_id: user.id,
      organization_id: organizationId,
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
      const leadUpdateQuery = organizationId
        ? supabase.from("leads").update({ temperature }).eq("id", lead.id).eq("organization_id", organizationId)
        : supabase.from("leads").update({ temperature }).eq("id", lead.id).eq("user_id", user.id);
      const [{ error: leadError }, { error: interactionError }] = await Promise.all([
        leadUpdateQuery,
        supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id })),
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
      user_id: user.id,
      organization_id: organizationId,
      note: input.note,
      message: input.note,
      type: input.type,
      channel: input.channel,
      created_at: new Date().toISOString(),
    };
    addInteractionOptimistic(interaction);
    if (supabase) {
      const { error } = await supabase.from("interactions").insert(withOrganizationPayload({ ...interaction, user_id: user.id }));
      if (error) showToast("Erro ao registrar interação");
      else await recordAuditLog({
        entity_type: "lead",
        entity_id: leadId,
        action: "interaction.created",
        summary: "Interação registrada",
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

    setSelectedLeadId(nextLead?.id ?? lead.id);

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
    if (!canManageTemplates) {
      showToast("Você não tem permissão para gerenciar mensagens prontas");
      return;
    }

    if (!supabase) {
      showToast("Supabase não configurado");
      return;
    }

    const { data, error } = await supabase
      .from("message_templates")
      .insert(withOrganizationPayload({ title, body, user_id: user.id }))
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
    if (!canManageTemplates) {
      showToast("Você não tem permissão para gerenciar mensagens prontas");
      return;
    }

    if (!supabase) {
      showToast("Supabase não configurado");
      return;
    }

    const previousTemplates = remoteTemplates;
    setTemplatePendingDelete(null);
    setRemoteTemplates((items) => items.filter((item) => item.id !== template.id));
    showToast("Mensagem pronta excluida");

    let deleteQuery = supabase
      .from("message_templates")
      .delete()
      .eq("id", template.id);

    deleteQuery = organizationId ? deleteQuery.eq("organization_id", organizationId) : deleteQuery.eq("user_id", user.id);

    const { error } = await deleteQuery;

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
    <main className={`crm-shell crm-theme-${crmTheme} relative min-h-screen overflow-hidden bg-[#09090D] text-white`}>
      <div className="glow-breathe pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_14%_0%,rgba(139,92,246,0.28),transparent_42%),radial-gradient(ellipse_at_88%_12%,rgba(37,211,102,0.12),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
      {toast && (
        <div className="fixed right-4 top-4 z-[60] rounded-lg border border-[#8B5CF6]/40 bg-[#17111f]/95 px-4 py-3 text-sm shadow-2xl shadow-[#8B5CF6]/30 backdrop-blur-xl">
          {toast.text}
        </div>
      )}

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <CrmSidebar
          canUseProspecting={canUseProspecting}
          collapsed={sidebarCollapsed}
          user={user}
          view={view}
          onLogout={logout}
          onNavigate={navigateView}
          onOpenProspecting={() => setProspectingOpen(true)}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        />

        <section className="crm-content relative flex-1 overflow-hidden">
          <CrmContentHeader
            canCreateLead={canCreateLead}
            canUpdatePipeline={canUpdatePipeline}
            crmViewMode={crmViewMode}
            dateFilter={dateFilter}
            query={query}
            savedFilterPresets={savedFilterPresets}
            statusFilter={statusFilter}
            tagFilter={tagFilter}
            tags={tags}
            temperatureFilter={temperatureFilter}
            view={view}
            visiblePipelineStages={visiblePipelineStages}
            onApplyFilterPreset={applyFilterPreset}
            onCreateLead={() => setLeadFormOpen(true)}
            onCrmViewModeChange={setCrmViewMode}
            onDateFilterChange={setDateFilter}
            onExportLeads={exportFilteredLeads}
            onOpenPipelineStages={() => setPipelineStagesOpen(true)}
            onQueryChange={setQuery}
            onSaveFilterPreset={saveCurrentFilterPreset}
            onStatusFilterChange={setStatusFilter}
            onTagFilterChange={setTagFilter}
            onTemperatureFilterChange={setTemperatureFilter}
          />

          <div className="crm-content-body reveal-up relative p-5">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
              </div>
            ) : (
              <>
                {shouldShowOnboarding && (
                  <OnboardingPanel
                    checkoutSuccess={checkoutSuccess}
                    steps={onboardingSteps}
                    onDismiss={() => setOnboardingDismissed(true)}
                  />
                )}
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
                {view === "pipeline" &&
                  (crmViewMode === "kanban" ? (
                    <Pipeline
                      bulkOwnerName={bulkOwnerName}
                      canDeleteLeads={canDeleteLeads}
                      canMoveLeads={canUpdatePipeline}
                      columns={visiblePipelineStages}
                      dispatchCountsByLeadId={dispatchCountsByLeadId}
                      leadTags={tagsByLeadId}
                      leads={filteredLeads}
                      onBulkArchive={() => void bulkArchiveSelectedLeads()}
                      onBulkAssignOwner={() => void bulkAssignOwner()}
                      onBulkMove={(status) => void bulkMoveSelectedLeads(status)}
                      onBulkSchedule={(days) => void bulkScheduleSelectedLeads(days)}
                      onBulkOwnerNameChange={setBulkOwnerName}
                      onClearSelection={() => setSelectedPipelineLeadIds(new Set())}
                      onLeadClick={(lead) => setSelectedLeadId(lead.id)}
                      onLeadDelete={requestDeleteLead}
                      onQuickSchedule={(lead) => scheduleFollowup(lead, addDays(1))}
                      onQuickWhatsApp={(lead) => setSelectedLeadId(lead.id)}
                      onStatusChange={requestLeadStatusChange}
                      recentLeadId={recentLeadId}
                      selectedLeadIds={selectedPipelineLeadIds}
                      onToggleLeadSelection={togglePipelineLeadSelection}
                    />
                  ) : (
                    <LeadList
                      leadTags={tagsByLeadId}
                      leads={filteredLeads}
                      onEdit={(lead) => setSelectedLeadId(lead.id)}
                      onDelete={requestDeleteLead}
                      onOpen={(lead) => setSelectedLeadId(lead.id)}
                    />
                  ))}
                {view === "tasks" && (
                  <TasksWorkspace
                    leads={leads}
                    onCompleteTask={completeTask}
                    onCreateTask={createTask}
                    onDeleteTask={deleteTask}
                    onOpenLead={(lead) => setSelectedLeadId(lead.id)}
                    onRescheduleTask={rescheduleTask}
                    onScheduleLeadFollowup={scheduleFollowup}
                    onUpdateTask={updateTask}
                    tasks={tasks}
                  />
                )}
                {view === "conversations" && (
                  <Conversations
                    availableTags={tags}
                    columns={visiblePipelineStages}
                    leadTags={tagsByLeadId}
                    leads={leads}
                    organizationId={organizationId}
                    templates={templates}
                    onAudit={recordAuditLog}
                    onAssignTag={(lead, tagId) => void assignTagToLead(lead, tagId)}
                    onCreateTag={createLeadTag}
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
                    crmTheme={crmTheme}
                    initialTab={settingsInitialTab}
                    leads={leads}
                    memberRole={currentRole}
                    onAddTemplate={addTemplate}
                    onDeleteTemplate={(template) => setTemplatePendingDelete(template)}
                    onThemeChange={setCrmTheme}
                    organizationContext={organizationContext}
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
        <LeadCreateModal
          availableTags={tags}
          columns={visiblePipelineStages}
          onClose={() => setLeadFormOpen(false)}
          onSave={async (input, tagIds, newTagName) => {
            const createdLead = await saveLead(input);
            if (!createdLead) return null;
            for (const tagId of tagIds) {
              await assignTagToLead(createdLead, tagId);
            }
            if (newTagName.trim()) {
              const tag = await createLeadTag(newTagName);
              if (tag) await assignTagToLead(createdLead, tag.id);
            }
            setLeadFormOpen(false);
            setSelectedLeadId(createdLead.id);
            return createdLead;
          }}
        />
      )}

      {selectedLead && (
        <LeadDetails
          interactions={interactions.filter((item) => item.lead_id === selectedLead.id)}
          key={selectedLead.id}
          columns={visiblePipelineStages}
          availableTags={tags}
          leadTags={tagsByLeadId.get(selectedLead.id) ?? []}
          lead={selectedLead}
          onAddInteraction={addInteraction}
          onCompleteTask={completeTask}
          onCreateTask={createTask}
          onClose={() => setSelectedLeadId(null)}
          onDelete={requestDeleteLead}
          onCreateTag={(name) => createLeadTag(name)}
          onAssignTag={(tagId) => assignTagToLead(selectedLead, tagId)}
          onRemoveTag={(tagId) => removeTagFromLead(selectedLead, tagId)}
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
      {prospectingOpen && (
        <ProspectingModal
          campaignBatchLimit={currentPlanLimits.campaignBatchLimit}
          existingLeadPhones={existingLeadPhones}
          onAddLead={async (input) => {
            await saveLead(input);
            showToast("Lead adicionado ao CRM");
          }}
          onClose={() => setProspectingOpen(false)}
          onSendProspectingMessage={async (phoneNumber, message) => {
            const result = await sendWhatsAppConversationMessage(phoneNumber, message, null, {
              nextFollowupAt: null,
              moveStatus: null,
            });
            if (result.message) {
              setRemoteWhatsAppMessages((items) => upsertWhatsAppMessage(items, result.message as WhatsAppMessage));
            }
            return { success: result.success, error: result.error ?? "" };
          }}
          onCampaignCompleted={async (campaign) => {
            const result = await createProspectingCampaignAction(campaign);
            if (!result.success) {
              showToast(result.error ?? "Campanha enviada, mas não foi salva no histórico");
              return;
            }
            showToast("Campanha registrada no CRM");
          }}
          onValidateWhatsAppNumbers={async (phoneNumbers) => {
            const result = await checkWhatsAppNumbers(phoneNumbers);
            return {
              success: result.success,
              numbers: result.numbers ?? [],
              error: result.error ?? "",
            };
          }}
          searchLimit={currentPlanLimits.prospectingSearchLimit}
          templates={templates}
        />
      )}
    </main>
  );
}

function OnboardingPanel({
  checkoutSuccess,
  steps,
  onDismiss,
}: {
  checkoutSuccess: boolean;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    done: boolean;
    action: () => void;
    actionLabel: string;
  }>;
  onDismiss: () => void;
}) {
  const completed = steps.filter((step) => step.done).length;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#8B5CF6]/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.16),rgba(37,211,102,0.06),rgba(255,255,255,0.03))] shadow-2xl shadow-[#8B5CF6]/10">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#A78BFA]">
            <Sparkles className="h-4 w-4" />
            Primeiros passos
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {checkoutSuccess ? "Pagamento confirmado. Configure sua operação." : "Configure o essencial para começar a vender."}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Conecte o WhatsApp, organize o CRM e deixe a rotina pronta para responder leads, criar tarefas e acompanhar conversas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
            {completed}/{steps.length} concluídos
          </span>
          <button
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            onClick={onDismiss}
            type="button"
          >
            Dispensar
          </button>
        </div>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step) => (
          <div key={step.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${step.done ? "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]" : "border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#A78BFA]"}`}>
                <Check className="h-4 w-4" />
              </span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${step.done ? "bg-[#25D366]/10 text-[#25D366]" : "bg-white/[0.06] text-zinc-400"}`}>
                {step.done ? "Pronto" : "Pendente"}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
            <p className="mt-2 min-h-12 text-xs leading-5 text-zinc-500">{step.description}</p>
            <button
              className="mt-4 h-9 w-full rounded-lg border border-white/10 px-3 text-xs font-semibold text-zinc-200 transition hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={step.done}
              onClick={step.action}
              type="button"
            >
              {step.done ? "Concluído" : step.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </section>
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
  onCompleteTask: (task: Task, lead: Lead | null) => void;
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
    phoneNumber: string | null;
    profileName: string | null;
    error: string;
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
          error: data.error ?? (!response.ok ? "Não foi possível consultar a Evolution" : undefined),
        });
      } catch {
        if (mounted) {
          setWhatsappStatus({
            connected: false,
            state: "error",
            phoneNumber: null,
            profileName: null,
            error: "Não foi possível consultar a Evolution",
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
  const scopedLeads = useMemo(
    () => leads.filter((lead) => ownerFilter === "all" || lead.owner_name === ownerFilter),
    [leads, ownerFilter],
  );
  const openTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.status !== "open") return false;
        if (!task.lead_id) return ownerFilter === "all";
        const lead = leadById.get(task.lead_id);
        return lead ? ownerFilter === "all" || lead.owner_name === ownerFilter : false;
      }),
    [leadById, ownerFilter, tasks],
  );
  const taskAgenda: DashboardAgendaItem[] = useMemo(
    () =>
      openTasks
        .filter(isTaskDueToday)
        .map((task) => ({
          task,
          lead: task.lead_id ? leadById.get(task.lead_id) ?? null : null,
          dueAt: task.due_at,
          title: task.title,
        }))
        .filter((item): item is DashboardAgendaItem & { task: Task } => Boolean(item.task)),
    [leadById, openTasks],
  );
  const taskAgendaLeadIds = useMemo(
    () => new Set(taskAgenda.map((item) => item.lead?.id).filter((id): id is string => Boolean(id))),
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
          task: null,
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
    () => whatsappMessages.filter((message) => message.direction === "inbound").slice(0, 3),
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
    ...hotLeadsWithoutAction.slice(0, 2).map((lead) => ({ lead, reason: "Quente sem próxima ação" })),
    ...stuckProposals.slice(0, 2).map((lead) => ({ lead, reason: "Proposta parada há 3+ dias" })),
    ...noOwner.slice(0, 2).map((lead) => ({ lead, reason: "Sem responsável" })),
    ...noNextContact.slice(0, 2).map((lead) => ({ lead, reason: "Sem próximo contato" })),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.lead.id === item.lead.id) === index);
  const stagePerformance = columns.map((column) => {
    const stageLeads = scopedLeads.filter((lead) => lead.status === column.id);
    return {
      id: column.id,
      title: column.title,
      count: stageLeads.length,
      value: stageLeads.reduce((total, lead) => total + (lead.estimated_value ?? 0), 0),
      hot: stageLeads.filter((lead) => (lead.temperature ?? "morno") === "quente").length,
    };
  });
  const maxStageCount = Math.max(1, ...stagePerformance.map((stage) => stage.count));
  const activityDays = buildDashboardActivityDays({
    interactions,
    leads: scopedLeads,
    now: dashboardNow,
    whatsappMessages,
  });
  const maxActivityTotal = Math.max(1, ...activityDays.map((day) => day.created + day.replies + day.contacts));
  const funnelStages = stagePerformance.slice(0, 5);
  const maxFunnelCount = Math.max(1, ...funnelStages.map((stage) => stage.count));
  const whatsappOperationalStats = [
    { label: "Não lidas", value: conversationsWithPendingReplies.length, tone: "bg-[#25D366]" },
    { label: "Sem lead", value: unlinkedConversations.length, tone: "bg-amber-400" },
    { label: "Respondidas", value: groupedMessages.length - conversationsWithPendingReplies.length, tone: "bg-[#8B5CF6]" },
    { label: "Falhas", value: failedMessages.length, tone: "bg-red-400" },
  ];
  const totalWhatsappOperational = Math.max(
    1,
    whatsappOperationalStats.reduce((total, item) => total + item.value, 0),
  );
  const scopedTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.lead_id) return ownerFilter === "all";
        const lead = leadById.get(task.lead_id);
        return lead ? ownerFilter === "all" || lead.owner_name === ownerFilter : false;
      }),
    [leadById, ownerFilter, tasks],
  );
  const taskPerformanceStats = {
    open: scopedTasks.filter((task) => task.status === "open").length,
    completed: scopedTasks.filter((task) => task.status === "completed").length,
    overdue: scopedTasks.filter((task) => task.status === "open" && isTaskOverdue(task)).length,
    commercial: scopedTasks.filter(isCommercialTask).length,
    operational: scopedTasks.filter((task) => !isCommercialTask(task)).length,
  };
  const totalTaskPerformance = Math.max(
    1,
    Math.max(0, taskPerformanceStats.open - taskPerformanceStats.overdue) +
      taskPerformanceStats.overdue +
      taskPerformanceStats.completed,
  );
  const leadScoreStats = useMemo(() => {
    const scores = scopedLeads.map((lead) => calculateLeadScore(lead, dashboardClosedStageIds));
    return [
      { label: "Críticos", value: scores.filter((score) => score.label === "Crítico").length, tone: "bg-red-400" },
      { label: "Altos", value: scores.filter((score) => score.label === "Alto").length, tone: "bg-[#25D366]" },
      { label: "Médios", value: scores.filter((score) => score.label === "Médio").length, tone: "bg-amber-400" },
      { label: "Baixos", value: scores.filter((score) => score.label === "Baixo").length, tone: "bg-sky-400" },
    ];
  }, [dashboardClosedStageIds, scopedLeads]);
  const totalLeadScoreStats = Math.max(1, leadScoreStats.reduce((total, item) => total + item.value, 0));
  const scorePriorityLeads = useMemo(
    () =>
      [...operationalLeads]
        .map((lead) => ({ lead, score: calculateLeadScore(lead, dashboardClosedStageIds) }))
        .sort((a, b) => b.score.score - a.score.score)
        .slice(0, 3),
    [dashboardClosedStageIds, operationalLeads],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Central do dia</h2>
            <p className="mt-1 text-sm text-zinc-500">Prioridades comerciais, WhatsApp e riscos em uma única fila de decisão.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setOwnerFilter(event.target.value)}
              value={ownerFilter}
            >
              <option value="all">Todos responsáveis</option>
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
        <DashboardPriorityCard description="Ações fora do prazo" label="Follow-ups vencidos" value={overdueFollowups.length} tone="danger" />
        <DashboardPriorityCard description="Entradas que pedem resposta" label="Respostas novas" onClick={onViewConversations} value={conversationsWithPendingReplies.length} tone="success" />
        <DashboardPriorityCard description="Contatos para converter" label="Conversas sem lead" onClick={onViewConversations} value={unlinkedConversations.length} tone="warning" />
        <DashboardPriorityCard description="Saída bloqueada" label="Mensagens com falha" onClick={onViewConversations} value={failedMessages.length} tone="danger" />
        <DashboardPriorityCard description="Sem próximo passo" label="Quentes sem ação" value={hotLeadsWithoutAction.length} tone="warning" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="self-start rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Performance visual</h2>
              <p className="mt-1 text-sm text-zinc-500">Etapas, atividade recente e conversão do funil.</p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
              Atividade 7 dias
            </span>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
            <DashboardStageChart stages={stagePerformance} maxCount={maxStageCount} />
            <DashboardActivityChart days={activityDays} maxTotal={maxActivityTotal} />
          </div>
          <DashboardScoreChart
            onOpen={onOpen}
            scorePriorityLeads={scorePriorityLeads}
            stats={leadScoreStats}
            total={totalLeadScoreStats}
          />
        </section>

        <section className="self-start rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold">Funil e WhatsApp</h2>
          <p className="mt-1 text-sm text-zinc-500">Visão rapida da distribuição operacional.</p>
          <DashboardFunnelChart stages={funnelStages} maxCount={maxFunnelCount} />
          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">WhatsApp operacional</div>
                <div className="mt-1 text-xs text-zinc-500">{groupedMessages.length} conversas rastreadas</div>
              </div>
              <button className="text-xs text-[#9AF0B8] transition hover:text-[#25D366]" onClick={onViewConversations} type="button">
                Abrir inbox
              </button>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
              {whatsappOperationalStats.map((item) => (
                <div
                  className={item.tone}
                  key={item.label}
                  style={{ width: `${Math.max(3, (item.value / totalWhatsappOperational) * 100)}%` }}
                  title={`${item.label}: ${item.value}`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {whatsappOperationalStats.map((item) => (
                <DashboardMiniLegend key={item.label} label={item.label} tone={item.tone} value={item.value} />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="self-start rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tarefas de hoje</h2>
              <p className="mt-1 text-sm text-zinc-500">Operacionais e comerciais em uma fila de execução.</p>
            </div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">
              {todayAgenda.length}
            </span>
          </div>
          <DashboardTaskChart stats={taskPerformanceStats} total={totalTaskPerformance} />
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {todayAgenda.length === 0 && (
              <DashboardEmpty text="Nenhuma tarefa operacional ou comercial vencida/agendada para hoje." />
            )}
            {todayAgenda.map((item) => {
              const task = item.task;

              if (!item.lead) {
                return (
                  <DashboardOperationalTaskRow
                    dueAt={item.dueAt}
                    key={task?.id ?? item.dueAt}
                    onCompleteTask={task ? () => onCompleteTask(task, null) : undefined}
                    task={task}
                    title={item.title}
                  />
                );
              }
              const lead = item.lead;

              return (
                <DashboardLeadRow
                  dueAt={item.dueAt}
                  key={task?.id ?? `${lead.id}-${item.dueAt}`}
                  lead={lead}
                  onCompleteTask={task ? () => onCompleteTask(task, lead) : undefined}
                  onOpen={() => onOpen(lead)}
                  onQuickSchedule={() => onQuickSchedule(lead)}
                  onQuickWhatsApp={() => onQuickWhatsApp(lead)}
                  title={item.title}
                />
              );
            })}
          </div>
          {todayAgenda.length > 6 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-500">
              Mais {todayAgenda.length - 6} item(ns) em tarefas. Use a rolagem interna para revisar sem perder o contexto do dashboard.
            </div>
          )}
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

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
            Riscos comerciais
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <DashboardCompactMetric label="Leads quentes sem próxima ação" value={hotLeadsWithoutAction.length} />
            <DashboardCompactMetric label="Propostas paradas há 3+ dias" value={stuckProposals.length} />
            <DashboardCompactMetric label="Leads sem responsável" value={noOwner.length} />
            <DashboardCompactMetric label="Leads ativos sem próximo contato" value={noNextContact.length} />
          </div>
          <div className="mt-4 space-y-2">
            {riskRows.length === 0 && <DashboardEmpty text="Nenhum risco comercial crítico para este filtro." />}
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
          <p className="mt-1 text-sm text-zinc-500">Período selecionado e carteira aberta.</p>
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

function buildDashboardActivityDays({
  interactions,
  leads,
  now,
  whatsappMessages,
}: {
  interactions: Interaction[];
  leads: Lead[];
  now: number;
  whatsappMessages: WhatsAppMessage[];
}): DashboardActivityDay[] {
  const today = startOfDay(new Date(now));

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const start = day.getTime();
    const end = nextDay.getTime();
    const inRange = (value: string) => {
      const time = new Date(value).getTime();
      return time >= start && time < end;
    };

    return {
      key: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      created: leads.filter((lead) => inRange(lead.created_at)).length,
      replies: whatsappMessages.filter((message) => message.direction === "inbound" && inRange(message.created_at)).length,
      contacts: interactions.filter(
        (interaction) =>
          interaction.type === "whatsapp_sent" &&
          inRange(interaction.created_at),
      ).length,
    };
  });
}


function TasksView({
  tasks,
  leads,
  onOpenLead,
  onCompleteTask,
  onCreateTask,
  onRescheduleTask,
  onScheduleLeadFollowup,
  onUpdateTask,
  onDeleteTask,
}: {
  tasks: Task[];
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onCreateTask: (lead: Lead | null, input: TaskInput) => void;
  onRescheduleTask: (task: Task, lead: Lead | null, dueAt: string) => void;
  onScheduleLeadFollowup: (lead: Lead, dueAt: string) => void;
  onUpdateTask: (task: Task, lead: Lead | null, input: TaskInput) => void;
  onDeleteTask: (task: Task, lead: Lead | null) => void;
}) {
  const [scope, setScope] = useState<TaskScope>("open");
  const [owner, setOwner] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [taskEditor, setTaskEditor] = useState<TaskEditorState | null>(null);
  const [googleEventEditor, setGoogleEventEditor] = useState<GoogleCalendarEvent | null | "new">(null);
  const [googleEventDeleteTarget, setGoogleEventDeleteTarget] = useState<GoogleCalendarEvent | null>(null);
  const [googleEventActionLoading, setGoogleEventActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ task: Task; lead: Lead | null } | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [googleEventsFeedback, setGoogleEventsFeedback] = useState("");
  const owners = Array.from(
    new Set(leads.map((lead) => lead.owner_name?.trim()).filter((item): item is string => Boolean(item))),
  ).sort((a, b) => a.localeCompare(b));
  const sortedLeads = [...leads].sort((a, b) => a.name.localeCompare(b.name));
  const scopedTasks = tasks.filter((task) => {
    if (owner === "all") return true;
    const lead = task.lead_id ? leads.find((item) => item.id === task.lead_id) : null;
    return lead?.owner_name === owner;
  });
  const taskRows = tasks
    .map((task) => ({ task, lead: leads.find((lead) => lead.id === task.lead_id) ?? null }))
    .filter(({ task, lead }) => {
      if (owner !== "all" && lead?.owner_name !== owner) return false;
      if (scope === "completed") return task.status === "completed";
      if (task.status !== "open") return false;
      if (scope === "overdue") return isTaskOverdue(task);
      if (scope === "today") return isTaskDueOnDate(task, new Date());
      if (scope === "upcoming") return new Date(task.due_at).getTime() > endOfDay(new Date()).getTime();
      return true;
    })
    .sort((a, b) => new Date(a.task.due_at).getTime() - new Date(b.task.due_at).getTime());
  const agendaRows = leads
    .filter((lead) => {
      if (!lead.next_followup_at || isLeadClosed(lead)) return false;
      if (owner !== "all" && lead.owner_name !== owner) return false;
      const dueAt = new Date(lead.next_followup_at);
      if (Number.isNaN(dueAt.getTime())) return false;
      if (scope === "completed") return false;
      if (scope === "overdue") return dueAt.getTime() < startOfDay(new Date()).getTime();
      if (scope === "today") return startOfDay(dueAt).getTime() === startOfDay(new Date()).getTime();
      if (scope === "upcoming") return dueAt.getTime() > endOfDay(new Date()).getTime();
      return true;
    })
    .sort((a, b) => new Date(a.next_followup_at ?? "").getTime() - new Date(b.next_followup_at ?? "").getTime());
  const selectedRows = taskRows.filter(({ task }) => selectedIds.has(task.id));
  const counts = {
    open: scopedTasks.filter((task) => task.status === "open").length,
    overdue: scopedTasks.filter((task) => task.status === "open" && isTaskOverdue(task)).length,
    today: scopedTasks.filter((task) => task.status === "open" && isTaskDueOnDate(task, new Date())).length,
    upcoming: scopedTasks.filter((task) => task.status === "open" && new Date(task.due_at).getTime() > endOfDay(new Date()).getTime()).length,
    completed: scopedTasks.filter((task) => task.status === "completed").length,
  };
  const operationalCount = scopedTasks.filter((task) => !isCommercialTask(task)).length;
  const commercialCount = scopedTasks.filter(isCommercialTask).length;
  const agendaCount = agendaRows.length;

  const refreshGoogleEvents = useCallback(async () => {
    setGoogleEventsLoading(true);
    setGoogleEventsFeedback("");
    try {
      const response = await fetch("/api/integrations/google/events", { cache: "no-store" });
      const data = await response.json();
      setGoogleEvents((data.events as GoogleCalendarEvent[] | undefined) ?? []);
      if (!response.ok || data.error) {
        setGoogleEventsFeedback(data.error ?? "Não foi possível carregar a agenda Google.");
      } else if (!data.connected) {
        setGoogleEventsFeedback("Conecte o Google Calendar em Configurações > CRM para listar eventos aqui.");
      }
    } catch {
      setGoogleEventsFeedback("Não foi possível carregar a agenda Google.");
    } finally {
      setGoogleEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshGoogleEvents();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [refreshGoogleEvents]);

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

  function saveTask(input: TaskInput) {
    const editor = taskEditor;
    if (!editor) return;
    const lead = input.lead_id ? leads.find((item) => item.id === input.lead_id) ?? null : null;
    if (editor.task) onUpdateTask(editor.task, editor.lead ?? null, input);
    else onCreateTask(lead, input);
    setTaskEditor(null);
  }

  async function saveGoogleEvent(input: GoogleCalendarEventDraft, event?: GoogleCalendarEvent) {
    setGoogleEventActionLoading(true);
    setGoogleEventsFeedback("");
    const payload = {
      title: input.title.trim(),
      description: input.description.trim() || null,
      startsAt: fromDateTimeLocal(input.startsAt),
      endsAt: fromDateTimeLocal(input.endsAt),
      location: input.location.trim() || null,
      attendees: input.attendees
        .split(/[,\n;]/)
        .map((email) => email.trim())
        .filter(Boolean),
      createMeet: input.createMeet,
      durationMinutes: 30,
    };

    try {
      const response = await fetch(event ? `/api/integrations/google/events/${encodeURIComponent(event.id)}` : "/api/integrations/google/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        setGoogleEventsFeedback(data.error ?? "Não foi possível salvar o evento Google.");
        return;
      }

      setGoogleEventEditor(null);
      await refreshGoogleEvents();
    } catch {
      setGoogleEventsFeedback("Não foi possível salvar o evento Google.");
    } finally {
      setGoogleEventActionLoading(false);
    }
  }

  async function deleteGoogleEvent(event: GoogleCalendarEvent) {
    setGoogleEventActionLoading(true);
    setGoogleEventsFeedback("");
    try {
      const response = await fetch(`/api/integrations/google/events/${encodeURIComponent(event.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || data.error) {
        setGoogleEventsFeedback(data.error ?? "Não foi possível excluir o evento Google.");
        return;
      }

      setGoogleEventDeleteTarget(null);
      setGoogleEvents((items) => items.filter((item) => item.id !== event.id));
      await refreshGoogleEvents();
    } catch {
      setGoogleEventsFeedback("Não foi possível excluir o evento Google.");
    } finally {
      setGoogleEventActionLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-5">
        {([
          ["open", "Abertas"],
          ["overdue", "Vencidas"],
          ["today", "Hoje"],
          ["upcoming", "Próximas"],
          ["completed", "Concluídas"],
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
            <h2 className="text-lg font-semibold">Tarefas</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {commercialCount} comerciais e {operationalCount} operacionais. Conclua, edite, exclua ou reagende próximas ações.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setOwner(event.target.value)}
              value={owner}
            >
              <option value="all">Todos responsáveis</option>
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
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium transition hover:bg-[#7C3AED]"
              onClick={() => setTaskEditor({ lead: null })}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Criar nova tarefa
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {taskRows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">Nenhuma tarefa encontrada para este filtro.</div>
          ) : (
            <div className="max-h-[34rem] divide-y divide-white/10 overflow-y-auto">
              {taskRows.map(({ task, lead }) => {
                const due = getDueAtLabel(task.due_at);
                const repeat = getTaskRepeat(task);
                const visibleNotes = stripTaskMetadata(task.notes);
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
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          isCommercialTask(task)
                            ? "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]"
                            : "border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#DDD6FE]"
                        }`}>
                          {isCommercialTask(task) ? "Comercial" : "Operacional"}
                        </span>
                        {repeat !== "none" && (
                          <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                            Repete {taskRepeatLabel(repeat).toLowerCase()}
                          </span>
                        )}
                        {task.google_synced_at && (
                          <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-0.5 text-[11px] text-[#9AF0B8]">
                            Google sync
                          </span>
                        )}
                        {task.google_sync_error && (
                          <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200">
                            Google pendente
                          </span>
                        )}
                        <span className="font-medium text-zinc-100">{task.title}</span>
                      </div>
                      {lead ? (
                        <button
                          className="mt-1 text-left text-sm text-zinc-500 transition hover:text-zinc-200"
                          onClick={() => onOpenLead(lead)}
                          type="button"
                        >
                          {lead.name} - {lead.company || "Sem empresa"}
                        </button>
                      ) : (
                        <div className="mt-1 text-sm text-zinc-500">Tarefa operacional sem lead vinculado</div>
                      )}
                      {visibleNotes && <div className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{visibleNotes}</div>}
                    </div>
                      <div>
                        <div className={`text-sm ${due.tone}`}>{due.text}</div>
                      <div className="mt-1 text-xs text-zinc-500">{lead?.owner_name || "Sem responsável"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {lead && (
                        <button
                          className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                          onClick={() => onOpenLead(lead)}
                          type="button"
                        >
                          Abrir
                        </button>
                      )}
                      {task.status === "open" && (
                        <>
                          <button
                            className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
                            onClick={() => onRescheduleTask(task, lead, addDays(1))}
                            type="button"
                          >
                            Amanhã
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
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => setTaskEditor({ task, lead })}
                        type="button"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
                        onClick={() => openGoogleCalendarEvent({
                          title: task.title,
                          startsAt: task.due_at,
                          details: visibleNotes || `${taskTypeLabel(task.type)} criado no OrigoCRM`,
                          lead,
                        })}
                        type="button"
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        Google
                      </button>
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs text-red-200 transition hover:bg-red-500/20"
                        onClick={() => setDeleteTarget({ task, lead })}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agenda comercial</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Follow-ups salvos nos leads do CRM. Use esta fila para acompanhar os agendamentos ainda não convertidos em tarefa.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
            {agendaCount} agendamento(s)
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {agendaRows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">Nenhum agendamento encontrado para este filtro.</div>
          ) : (
            <div className="max-h-[28rem] divide-y divide-white/10 overflow-y-auto">
              {agendaRows.map((lead) => {
                const due = getDueAtLabel(lead.next_followup_at ?? "");

                return (
                  <div className="grid gap-3 bg-black/20 p-4 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center" key={lead.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-0.5 text-[11px] text-[#9AF0B8]">
                          Agenda CRM
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getTemperatureLabel(lead.temperature).tone}`}>
                          {getTemperatureLabel(lead.temperature).text}
                        </span>
                        <span className="font-medium text-zinc-100">{lead.name}</span>
                      </div>
                      <button
                        className="mt-1 text-left text-sm text-zinc-500 transition hover:text-zinc-200"
                        onClick={() => onOpenLead(lead)}
                        type="button"
                      >
                        {lead.company || "Sem empresa"} - {lead.phone}
                      </button>
                    </div>
                    <div>
                      <div className={`text-sm ${due.tone}`}>{due.text}</div>
                      <div className="mt-1 text-xs text-zinc-500">{lead.owner_name || "Sem responsável"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => onOpenLead(lead)}
                        type="button"
                      >
                        Abrir
                      </button>
                      <button
                        className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20"
                        onClick={() => onScheduleLeadFollowup(lead, addDays(1))}
                        type="button"
                      >
                        Reagendar
                      </button>
                      <button
                        className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => openGoogleCalendarEvent({
                          title: `Follow-up com ${lead.name}`,
                          startsAt: lead.next_followup_at ?? addDays(1),
                          details: "Agenda comercial criada no OrigoCRM",
                          lead,
                        })}
                        type="button"
                      >
                        Google
                      </button>
                      <button
                        className="h-9 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                        onClick={() =>
                          onCreateTask(lead, {
                            lead_id: lead.id,
                            type: "followup",
                            title: `Follow-up com ${lead.name}`,
                            notes: "Criado a partir da agenda comercial",
                            due_at: lead.next_followup_at ?? addDays(1),
                          })
                        }
                        type="button"
                      >
                        Criar tarefa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agenda Google</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Eventos da agenda conectada. Criar ou editar tarefas no Origo sincroniza novos eventos automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-3 text-xs font-semibold text-white transition hover:bg-[#7C3AED]"
              onClick={() => setGoogleEventEditor("new")}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Criar evento
            </button>
            <button
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
              disabled={googleEventsLoading}
              onClick={() => void refreshGoogleEvents()}
              type="button"
            >
              {googleEventsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar agenda
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          {googleEventsLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#8B5CF6]" />
              Carregando eventos do Google...
            </div>
          ) : googleEvents.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              {googleEventsFeedback || "Nenhum evento futuro encontrado na agenda conectada."}
            </div>
          ) : (
            <div className="max-h-[26rem] divide-y divide-white/10 overflow-y-auto">
              {googleEvents.map((event) => {
                const startsAt = event.startsAt ? new Date(event.startsAt) : null;
                const validDate = startsAt && !Number.isNaN(startsAt.getTime());
                return (
                  <div className="grid gap-3 bg-black/20 p-4 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center" key={event.id}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2 py-0.5 text-[11px] text-[#DDD6FE]">
                          Google Calendar
                        </span>
                        <span className="font-medium text-zinc-100">{event.title}</span>
                      </div>
                      {event.description && <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{event.description}</div>}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {validDate ? startsAt.toLocaleString("pt-BR") : "Sem data"}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {event.hangoutLink && (
                        <a
                          className="flex h-9 items-center gap-1 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                          href={event.hangoutLink}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Meet
                        </a>
                      )}
                      {event.htmlLink && (
                        <a
                          className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                          href={event.htmlLink}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir Google
                        </a>
                      )}
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                        onClick={() =>
                          setTaskEditor({
                            lead: null,
                            draft: {
                              lead_id: null,
                              type: "meeting",
                              title: event.title,
                              notes: event.description ?? "Criado a partir da Agenda Google",
                              due_at: event.startsAt ?? new Date().toISOString(),
                            },
                          })
                        }
                        type="button"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Nova tarefa
                      </button>
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
                        onClick={() => setGoogleEventEditor(event)}
                        type="button"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        className="flex h-9 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs text-red-200 transition hover:bg-red-500/20"
                        onClick={() => setGoogleEventDeleteTarget(event)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      {taskEditor && (
        <TaskEditorModal
          leads={sortedLeads}
          onClose={() => setTaskEditor(null)}
          onSave={saveTask}
          draft={taskEditor.draft}
          task={taskEditor.task}
        />
      )}
      {googleEventEditor && (
        <GoogleEventEditorModal
          event={googleEventEditor === "new" ? undefined : googleEventEditor}
          loading={googleEventActionLoading}
          onClose={() => setGoogleEventEditor(null)}
          onSave={(input) => void saveGoogleEvent(input, googleEventEditor === "new" ? undefined : googleEventEditor)}
        />
      )}
      {googleEventDeleteTarget && (
        <ConfirmDeleteGoogleEvent
          event={googleEventDeleteTarget}
          loading={googleEventActionLoading}
          onCancel={() => setGoogleEventDeleteTarget(null)}
          onConfirm={() => void deleteGoogleEvent(googleEventDeleteTarget)}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteTask
          task={deleteTarget.task}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeleteTask(deleteTarget.task, deleteTarget.lead);
            setDeleteTarget(null);
          }}
        />
      )}
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

function Conversations({
  availableTags,
  columns,
  leadTags,
  leads,
  organizationId,
  templates,
  onAudit,
  onAssignTag,
  onCreateTag,
  onLeadCreated,
  onOpenLead,
}: {
  availableTags: CrmTag[];
  columns: PipelineStage[];
  leadTags: Map<string, CrmTag[]>;
  leads: Lead[];
  organizationId: string | null;
  templates: MessageTemplate[];
  onAudit: (input: AuditLogInput) => Promise<void>;
  onAssignTag: (lead: Lead, tagId: string) => void;
  onCreateTag: (name: string) => Promise<CrmTag | null>;
  onLeadCreated: (lead: Lead) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const {
    loading,
    messages,
    readPhones,
    realtimeStatus,
    setMessages,
    setReadPhones,
    setStoredConversations,
    storedConversations,
  } = useConversationInbox(organizationId, selectedPhone);
  const [replyText, setReplyText] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>("all");
  const [leadFilter, setLeadFilter] = useState<ConversationLeadFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<ConversationPriorityFilter>("all");
  const [sortMode, setSortMode] = useState<ConversationSort>("recent");
  const [sending, setSending] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [conversationActionLoading, setConversationActionLoading] = useState<"resolved" | "archived" | null>(null);
  const [bulkConversationLoading, setBulkConversationLoading] = useState(false);
  const [replyMoveStatus, setReplyMoveStatus] = useState<LeadStatus>("");
  const [replyFollowupDays, setReplyFollowupDays] = useState("");
  const [actionError, setActionError] = useState("");
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const conversations = useMemo(() => {
    const grouped = new Map<string, WhatsAppMessage[]>();
    const repeatedOutboundNames = getRepeatedOutboundContactNames(messages);

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
        const hasInboundMessage = items.some((item) => item.direction === "inbound");
        const contactMessage = [...items]
          .reverse()
          .find((item) => item.direction === "inbound" && getSafeConversationContactName(item.contact_name, repeatedOutboundNames));
        const avatarMessage = [...items].reverse().find((item) => item.contact_avatar_url);
        const storedContactName = getSafeConversationContactName(storedConversation?.contact_name, repeatedOutboundNames);
        const inboundContactName = getSafeConversationContactName(contactMessage?.contact_name, repeatedOutboundNames);
        const contactName = lead?.name ?? existingLead?.name ?? inboundContactName ?? storedContactName ?? phone;
        const pendingInbound = countPendingInboundMessages(items);
        const unreadCount = readPhones.has(phone) ? 0 : Math.max(pendingInbound, storedConversation?.unread_count ?? 0);
        const status = conversationStatus(lastMessage.direction, Boolean(lead), unreadCount, storedConversation?.status ?? null);
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
          isGenuine: hasInboundMessage || Boolean(activeLead),
        };
      })
      .filter((conversation) => conversation.isGenuine)
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
    selectedPhone
      ? filteredConversations.find((conversation) => conversation.phone === selectedPhone) ??
        conversations.find((conversation) => conversation.phone === selectedPhone) ??
        null
      : null;
  const selectedConversationLead = selectedConversation?.activeLead ?? null;
  const realtimeBadge = {
    connected: {
      className: "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]",
      label: "Tempo real ativo",
    },
    connecting: {
      className: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]",
      label: "Conectando tempo real",
    },
    fallback: {
      className: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#F59E0B]",
      label: "Sincronizando",
    },
    disabled: {
      className: "border-white/10 bg-white/[0.04] text-zinc-500",
      label: "Realtime indisponível",
    },
  }[realtimeStatus];
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

      void updateWhatsAppConversationStatus(phone, status);
    },
    [setReadPhones],
  );

  function selectConversation(phone: string) {
    setSelectedPhone(phone);
    setDetailsOpen(false);
    const conversation = conversations.find((item) => item.phone === phone);
    if (!conversation) return;
    const currentStatus = conversation.status;
    if (currentStatus === "archived" || currentStatus === "resolved") return;
    markConversationAsRead(phone, conversation.lead ? "converted" : "responded");
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template || !selectedConversation) return;

    const now = new Date().toISOString();
    const virtualLead: Lead = selectedConversationLead ?? {
      id: "",
      user_id: null,
      organization_id: organizationId,
      name: selectedConversation.contactName,
      phone: selectedConversation.phone,
      company: "",
      source: "WhatsApp",
      status: "novo",
      estimated_value: null,
      owner_name: null,
      temperature: null,
      outcome_reason: null,
      sla_hours: null,
      last_contact_at: null,
      next_followup_at: null,
      lead_score: null,
      lead_score_label: null,
      lead_score_reasons: null,
      lead_score_updated_at: null,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };

    const rendered = renderTemplate(template.body, virtualLead);
    setReplyText((current) => (current.trim() ? `${current.trim()}\n${rendered}` : rendered));
  }

  async function sendReply(body: string) {
    if (!selectedConversation || !body.trim()) return;

    setActionError("");
    setSending(true);
    const selectedFollowupDays = replyFollowupDays;
    const selectedMoveStatus = replyMoveStatus;
    const nextFollowupAt = selectedFollowupDays
      ? addDays(Number(selectedFollowupDays))
      : null;
    const result = await sendWhatsAppConversationMessage(
      selectedConversation.phone,
      body.trim(),
      selectedConversationLead?.id ?? null,
      {
        nextFollowupAt,
        moveStatus: selectedMoveStatus || null,
      },
    );
    setSending(false);

    if (!result.success) {
      setActionError(result.error ?? "Não foi possível enviar a mensagem");
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
        move_status: selectedMoveStatus || null,
        followup_days: selectedFollowupDays || null,
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

  async function handleSaveLead(input: ConversationLeadSaveInput) {
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
      setActionError(result.error ?? "Não foi possível salvar o lead");
      return;
    }

    const savedLead = result.lead;
    onLeadCreated(savedLead);
    for (const tagId of input.tagIds) {
      onAssignTag(savedLead, tagId);
    }
    if (input.newTagName.trim()) {
      const tag = await onCreateTag(input.newTagName);
      if (tag) onAssignTag(savedLead, tag.id);
    }
    await onAudit({
      entity_type: "whatsapp",
      entity_id: savedLead.id,
      action: selectedConversation.existingLead ? "whatsapp.conversation_linked" : "whatsapp.conversation_converted",
      summary: selectedConversation.existingLead
        ? `Conversa vinculada ao lead ${savedLead.name}`
        : `Conversa convertida em lead: ${savedLead.name}`,
      metadata: { phone: selectedConversation.phone, status: input.status, temperature: input.temperature },
    });
    setLeadModalOpen(false);
    setMessages((current) =>
      current.map((message) =>
        message.phone_number === selectedConversation.phone
          ? { ...message, lead_id: savedLead.id ?? message.lead_id }
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
        organization_id: selectedConversation.storedConversation?.organization_id ?? organizationId,
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
      setActionError(result.error ?? "Não foi possível atualizar a conversa");
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

  async function archiveVisibleConversations() {
    const targets = filteredConversations.filter((conversation) => conversation.status !== "archived");
    if (targets.length === 0) return;

    const confirmed = window.confirm(
      `Arquivar ${targets.length} conversa(s) visíveis agora? Elas sairão da inbox principal, mas o histórico continuará salvo e poderá ser visto em Arquivadas.`,
    );
    if (!confirmed) return;

    const previous = storedConversations;
    const now = new Date().toISOString();
    setActionError("");
    setBulkConversationLoading(true);
    setStoredConversations((items) =>
      targets.reduce(
        (current, conversation) =>
          upsertLocalConversation(current, {
            id: conversation.storedConversation?.id ?? newId("conversation"),
            user_id: conversation.storedConversation?.user_id ?? "",
            organization_id: conversation.storedConversation?.organization_id ?? organizationId,
            lead_id: conversation.activeLead?.id ?? conversation.storedConversation?.lead_id ?? null,
            phone_number: conversation.phone,
            remote_jid: conversation.storedConversation?.remote_jid ?? null,
            contact_name: conversation.contactName,
            contact_avatar_url: conversation.avatarUrl,
            status: "archived",
            unread_count: 0,
            last_message: getWhatsAppMessageDisplay(conversation.lastMessage),
            last_message_direction: conversation.lastMessage.direction,
            last_message_at: conversation.lastMessage.created_at,
            last_read_at: now,
            created_at: conversation.storedConversation?.created_at ?? now,
            updated_at: now,
          }),
        items,
      ),
    );

    const results = await Promise.all(
      targets.map((conversation) => updateWhatsAppConversationStatus(conversation.phone, "archived")),
    );
    setBulkConversationLoading(false);

    const failed = results.filter((result) => !result.success);
    if (failed.length > 0) {
      setStoredConversations(previous);
      setActionError(failed[0]?.error ?? "Não foi possível arquivar as conversas visíveis");
      return;
    }

    if (selectedPhone && targets.some((conversation) => conversation.phone === selectedPhone)) {
      setSelectedPhone(null);
      setDetailsOpen(false);
    }

    await onAudit({
      entity_type: "whatsapp",
      entity_id: null,
      action: "whatsapp.conversations_bulk_archived",
      summary: `${targets.length} conversa(s) arquivadas pela limpeza da inbox`,
      metadata: { phones: targets.map((conversation) => conversation.phone), filter: statusFilter },
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
      setActionError(result.error ?? "Não foi possível mudar a etapa do lead");
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
    <div
      className={`crm-conversations -m-5 grid h-[calc(100vh-5.75rem)] min-h-[640px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden ${
        detailsOpen && selectedConversation ? "xl:grid-cols-[360px_minmax(0,1fr)_320px]" : "xl:grid-cols-[360px_minmax(0,1fr)]"
      }`}
    >
      <div className="crm-conversations-toolbar col-span-full border-b border-white/10 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-xs text-zinc-500">
                <MessageCircle className="h-3.5 w-3.5 text-[#8B5CF6]" />
                <span>
                  {conversationCounts.unread} não lidas de {conversations.length} conversas
                </span>
              </div>
              <span className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${realtimeBadge.className}`}>
                {realtimeStatus === "connecting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {realtimeStatus === "connected" && <Wifi className="h-3.5 w-3.5" />}
                {realtimeStatus === "fallback" && <RefreshCw className="h-3.5 w-3.5" />}
                {realtimeStatus === "disabled" && <WifiOff className="h-3.5 w-3.5" />}
                {realtimeBadge.label}
              </span>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_auto] 2xl:min-w-[980px]">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-zinc-400 shadow-sm transition focus-within:border-[#8B5CF6]/70 focus-within:shadow-[#8B5CF6]/10">
              <Search className="h-4 w-4" />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-600"
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Buscar nome, telefone ou mensagem"
                value={conversationQuery}
              />
            </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:flex">
              <select
                className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-medium text-zinc-300 outline-none transition focus:border-[#8B5CF6]/70 2xl:w-36"
                onChange={(event) => setLeadFilter(event.target.value as ConversationLeadFilter)}
                value={leadFilter}
              >
                <option value="all">Todos os leads</option>
                <option value="without">Sem lead</option>
                <option value="with">Com lead</option>
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-medium text-zinc-300 outline-none transition focus:border-[#8B5CF6]/70 2xl:w-40"
                onChange={(event) => setPriorityFilter(event.target.value as ConversationPriorityFilter)}
                value={priorityFilter}
              >
                <option value="all">Todas prioridades</option>
                <option value="failed">Com falha</option>
                <option value="hot">Lead quente</option>
                <option value="unassigned">Sem responsável</option>
                <option value="today">Recebidas hoje</option>
              </select>
              <select
                className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-medium text-zinc-300 outline-none transition focus:border-[#8B5CF6]/70 2xl:w-36"
                onChange={(event) => setSortMode(event.target.value as ConversationSort)}
                value={sortMode}
              >
                <option value="recent">Mais recentes</option>
                <option value="unread">Não lidas primeiro</option>
                <option value="oldestWaiting">Maior espera</option>
                <option value="hot">Quentes primeiro</option>
              </select>
              <button
                className="h-11 rounded-xl border border-white/10 px-3 text-xs font-semibold text-zinc-400 transition hover:border-[#8B5CF6]/30 hover:bg-white/[0.06] 2xl:w-32"
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
              <button
                className="h-11 rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40 2xl:w-36"
                disabled={bulkConversationLoading || filteredConversations.filter((conversation) => conversation.status !== "archived").length === 0}
                onClick={() => void archiveVisibleConversations()}
                type="button"
              >
                {bulkConversationLoading ? "Limpando..." : "Arquivar visíveis"}
              </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {conversationStatusTabs.map((tab) => (
              <button
                className={`h-8 rounded-full border px-3 text-[11px] font-semibold transition ${
                  statusFilter === tab.id
                    ? "border-[#8B5CF6] bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20"
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
      </div>
      <aside className="crm-conversations-list flex min-h-0 flex-col border-b border-white/10 xl:border-b-0 xl:border-r">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length === 0 && (
            <div className="p-5 text-center text-sm text-zinc-500">
              Nenhuma conversa encontrada.
            </div>
          )}
          {filteredConversations.map((conversation) => (
            <button
              className={`relative block w-full border-b border-white/10 p-3 text-left transition hover:bg-white/[0.05] ${
                selectedConversation?.phone === conversation.phone ? "bg-[#8B5CF6]/15" : ""
              }`}
              key={conversation.phone}
              onClick={() => selectConversation(conversation.phone)}
              type="button"
            >
              {selectedConversation?.phone === conversation.phone && (
                <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-[#8B5CF6]" />
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ContactAvatar
                    avatarUrl={conversation.avatarUrl}
                    label={conversation.contactName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{conversation.contactName}</div>
                    <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
                      {conversation.phone}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {new Date(conversation.lastMessage.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm text-zinc-500">
                  {getWhatsAppMessageDisplay(conversation.lastMessage)}
                </p>
                {conversation.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-semibold text-black">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

      <section className="crm-conversations-chat flex min-h-0 flex-col">
        <div className="shrink-0 border-b border-white/10 p-4">
          {selectedConversation ? (
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <ContactAvatar
                avatarUrl={selectedConversation.avatarUrl}
                label={selectedConversation.contactName}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-semibold">
                    {selectedConversation.contactName || selectedConversation.phone}
                  </div>
                  {selectedConversation && (
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                      {selectedConversation.statusLabel}
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-sm text-zinc-500">{selectedConversation.phone}</div>
                {selectedConversation && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{selectedConversationLead ? getStageTitle(columns, selectedConversationLead.status) : "sem lead"}</span>
                    <span>-</span>
                    <span>Última interação {new Date(selectedConversation.lastMessage.created_at).toLocaleString("pt-BR")}</span>
                    <a
                      className="text-[#25D366] transition hover:text-[#6EE7A8]"
                      href={`https://wa.me/${selectedConversation.phone}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      WhatsApp Web
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-sm font-semibold text-[#DDD6FE] transition hover:bg-[#8B5CF6]/15"
                onClick={() => setDetailsOpen((current) => !current)}
                type="button"
              >
                <Eye className="h-4 w-4" />
                {detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/15 disabled:opacity-60"
                disabled={conversationActionLoading === "resolved"}
                onClick={() => void updateSelectedConversationStatus("resolved")}
                type="button"
              >
                {conversationActionLoading === "resolved" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Resolver
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                disabled={conversationActionLoading === "archived"}
                onClick={() => void updateSelectedConversationStatus("archived")}
                type="button"
              >
                {conversationActionLoading === "archived" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Arquivar
              </button>
            </div>
          </div>
          ) : (
            <div className="flex min-h-16 items-center justify-between gap-4">
              <div>
                <div className="font-semibold">Selecione uma conversa</div>
                <p className="mt-1 text-sm text-zinc-500">Escolha um contato da lista para visualizar e responder mensagens.</p>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {!selectedConversation && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 text-[#8B5CF6]">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Selecione uma conversa</h2>
                <p className="mt-2 text-sm text-zinc-500">A conversa, histórico e composer aparecem aqui.</p>
              </div>
            </div>
          )}
          {selectedConversationLead && (
            <ConversationSystemEvent
              detail={`Etapa atual: ${getStageTitle(columns, selectedConversationLead.status)}${
                selectedConversationLead.next_followup_at
                  ? ` | Proximo follow-up ${new Date(selectedConversationLead.next_followup_at).toLocaleString("pt-BR")}`
                  : ""
              }`}
              title="Lead vinculado ao CRM"
            />
          )}
          {selectedConversation?.messages.map((message, index, allMessages) => {
            const previous = allMessages[index - 1];
            const shouldShowDate = !previous || !isSameDay(previous.created_at, new Date(message.created_at));
            return (
              <div key={message.id}>
                {shouldShowDate && <ConversationDateDivider value={message.created_at} />}
                <div className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 shadow-sm ${
                      message.direction === "outbound"
                        ? "rounded-br-md bg-[#25D366] text-black shadow-[#25D366]/10"
                        : "rounded-bl-md border border-white/10 bg-white/[0.07] text-zinc-100"
                    }`}
                  >
                    <div>{getWhatsAppMessageDisplay(message)}</div>
                    <div
                      className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${
                        message.direction === "outbound" ? "text-black/60" : "text-zinc-500"
                      }`}
                    >
                      <span>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
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
              </div>
            );
          })}
        </div>
        <form className="shrink-0 border-t border-white/10 bg-black/10 p-4" onSubmit={handleReply}>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 shadow-sm">
            {actionError && (
              <p className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {actionError}
              </p>
            )}
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[170px_190px_160px_160px]">
                <input
                  className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
                  onChange={(event) => setTemplateQuery(event.target.value)}
                  placeholder="Buscar template"
                  value={templateQuery}
                />
                <select
                  className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
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
                  className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
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
                <select
                  className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
                  disabled={!selectedConversationLead}
                  onChange={(event) => setReplyFollowupDays(event.target.value)}
                  value={replyFollowupDays}
                >
                  <option value="">Sem follow-up</option>
                  <option value="1">Amanhã</option>
                  <option value="2">2 dias</option>
                  <option value="5">5 dias</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  {replyText.length}/1024
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">Enter envia</span>
                <span className="rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 px-2.5 py-1 text-[#C4B5FD]">
                  Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{telefone}}"}
                </span>
              </div>
            </div>
            {replyText.includes("{{") && (
              <div className="mt-3 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-3 text-xs text-zinc-300">
                Preview: {previewTemplateText(replyText, selectedConversation ?? undefined)}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                className="min-h-12 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
                maxLength={1024}
                onChange={(event) => setReplyText(event.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Responder pelo WhatsApp"
                disabled={!selectedConversation}
                value={replyText}
              />
              <button
                className="flex h-12 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-bold text-black shadow-lg shadow-[#25D366]/10 transition hover:bg-[#20bd5a] disabled:opacity-60"
                disabled={sending || !selectedConversation || !replyText.trim()}
                type="submit"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Enviando" : "Enviar"}
              </button>
            </div>
          </div>
        </form>
      </section>
      {detailsOpen && selectedConversation && (
      <aside className="crm-conversations-detail flex min-h-0 flex-col border-t border-white/10 xl:border-l xl:border-t-0">
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
                value={selectedConversation.lead ? "Vinculado" : selectedConversation.existingLead ? "Existente não vinculado" : "Sem lead"}
              />
              <ConversationInfoRow label="Etapa" value={selectedConversationLead?.status ?? "-"} />
              <ConversationInfoRow
                label="Temperatura"
                value={selectedConversationLead ? getTemperatureLabel(selectedConversationLead.temperature).text : "-"}
              />
              <ConversationInfoRow label="Responsável" value={selectedConversationLead?.owner_name || "Não definido"} />
              <ConversationInfoRow
                label="Proximo follow-up"
                value={
                  selectedConversationLead?.next_followup_at
                    ? new Date(selectedConversationLead.next_followup_at).toLocaleString("pt-BR")
                    : "Sem follow-up"
                }
              />
              <ConversationInfoRow
                label="Última interação"
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
      )}
      {leadModalOpen && selectedConversation && (
        <ConversationLeadModal
          availableTags={availableTags}
          columns={columns}
          initialName={selectedConversation.contactName}
          phoneNumber={selectedConversation.phone}
          saving={savingLead}
          selectedLeadTags={selectedConversation.existingLead ? leadTags.get(selectedConversation.existingLead.id) ?? [] : []}
          existingLead={selectedConversation.existingLead ?? null}
          onClose={() => setLeadModalOpen(false)}
          onSave={handleSaveLead}
        />
      )}
    </div>
  );
}

function migrationChecksInitialState(configured: boolean): MigrationCheck[] {
  if (!configured) {
    return [
      {
        label: "Supabase",
        status: "missing",
        detail: "Supabase não configurado neste ambiente",
      },
    ];
  }

  return [
    {
      label: "Supabase",
      status: "checking",
      detail: "Verificando conexão autenticada",
    },
    {
      label: "Base SaaS",
      status: "checking",
      detail: "Verificando organizações, membros e assinatura",
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
      label: "Tags e campanhas",
      status: "checking",
      detail: "Verificando tags_and_prospecting_campaigns_migration.sql",
    },
    {
      label: "Google Calendar",
      status: "checking",
      detail: "Verificando OAuth e tabela google_calendar_connections",
    },
    {
      label: "Webhook WhatsApp",
      status: "checking",
      detail: "Verificando recebimento recente de eventos",
    },
  ];
}

function SettingsView({
  auditLogs,
  archivedLeads,
  crmTheme,
  initialTab,
  leads,
  onAddTemplate,
  onDeleteTemplate,
  onThemeChange,
  tasks,
  templates,
  user,
  whatsappLogs,
  whatsappMessages,
  onUnarchiveLead,
  memberRole,
  organizationContext,
}: {
  auditLogs: AuditLog[];
  archivedLeads: Lead[];
  crmTheme: CrmTheme;
  initialTab: SettingsTab;
  leads: Lead[];
  onAddTemplate: (title: string, body: string) => void;
  onDeleteTemplate: (template: MessageTemplate) => void;
  onThemeChange: (theme: CrmTheme) => void;
  tasks: Task[];
  templates: MessageTemplate[];
  user: AuthUser;
  whatsappLogs: WhatsAppLog[];
  whatsappMessages: WhatsAppMessage[];
  onUnarchiveLead: (lead: Lead) => void;
  memberRole: CrmRole;
  organizationContext: OrganizationContext | null;
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
    instanceName: string;
    phoneNumber: string | null;
    profileName: string | null;
    error: string;
  } | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [evolutionDisconnecting, setEvolutionDisconnecting] = useState(false);
  const [evolutionQrCode, setEvolutionQrCode] = useState<string | null>(null);
  const [evolutionPairingCode, setEvolutionPairingCode] = useState<string | null>(null);
  const [evolutionFeedback, setEvolutionFeedback] = useState("");
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false);
  const [googleCalendarFeedback, setGoogleCalendarFeedback] = useState("");
  const [role, setRole] = useState<CrmRole>(() => readUserRole());
  const [preferences, setPreferences] = useState<CrmPreferences>(() => readCrmPreferences());
  const [auditEntityFilter, setAuditEntityFilter] = useState<AuditLog["entity_type"] | "all">("all");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<WhatsAppLog["status"] | "all">("all");
  const [selectedWhatsAppLog, setSelectedWhatsAppLog] = useState<WhatsAppLog | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMemberRow[]>([]);
  const [organizationInvitations, setOrganizationInvitations] = useState<OrganizationInvitationRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CrmRole>("seller");
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [teamFeedback, setTeamFeedback] = useState("");
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<BillingPeriod>(() => organizationContext?.subscription?.billing_period ?? "monthly");
  const [selectedSeatCount, setSelectedSeatCount] = useState(() => Math.max(1, organizationContext?.subscription?.seat_count ?? 1));
  const [billingLoading, setBillingLoading] = useState<PlanSlug | "portal" | null>(null);
  const [billingFeedback, setBillingFeedback] = useState("");
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
  const effectiveRole = memberRole ?? role;
  const previewPermissions = useMemo(() => getPermissionsForRole(role), [role]);
  const effectivePermissions = useMemo(() => getPermissionsForRole(effectiveRole), [effectiveRole]);
  const canManageTeam = effectiveRole === "owner" || effectiveRole === "admin";
  const canManageBilling = effectivePermissions.has("billing:manage");
  const currentSubscription = organizationContext?.subscription ?? null;
  const currentPlan = getPlan(currentSubscription?.plan_slug ?? "manual");
  const teamUserLimit = getPlanUserLimit(currentSubscription?.plan_slug ?? "manual", currentSubscription?.seat_count);
  const activeTeamSeats = organizationMembers.filter((member) => member.status === "active").length;
  const pendingTeamSeats = organizationInvitations.filter((invite) => invite.status === "pending").length;
  const usedTeamSeats = activeTeamSeats + pendingTeamSeats;
  const availableTeamSeats = Math.max(teamUserLimit - usedTeamSeats, 0);

  const refreshOrganizationMembers = useCallback(async () => {
    setMembersLoading(true);
    setTeamFeedback("");
    const [membersResult, invitationsResult] = await Promise.all([
      listOrganizationMembers(),
      listOrganizationInvitations(),
    ]);
    if (!membersResult.success) {
      setTeamFeedback(membersResult.error ?? "Não foi possível carregar a equipe.");
      setMembersLoading(false);
      return;
    }

    if (!invitationsResult.success) {
      setTeamFeedback(invitationsResult.error ?? "Não foi possível carregar os convites.");
    }

    setOrganizationMembers(membersResult.data ?? []);
    setOrganizationInvitations(invitationsResult.success ? invitationsResult.data ?? [] : []);
    setMembersLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab !== "team") return;
    const timeout = window.setTimeout(() => {
      void refreshOrganizationMembers();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeTab, refreshOrganizationMembers]);

  async function changeOrganizationMemberRole(memberId: string, nextRole: CrmRole) {
    setTeamFeedback("");
    const result = await updateOrganizationMemberRole(memberId, nextRole);
    if (!result.success) {
      setTeamFeedback(result.error ?? "Não foi possível alterar o papel.");
      return;
    }

    setOrganizationMembers((items) => items.map((item) => (item.id === memberId ? result.data ?? item : item)));
    setTeamFeedback("Papel atualizado.");
  }

  async function deactivateOrganizationMember(memberId: string) {
    setTeamFeedback("");
    const result = await disableOrganizationMember(memberId);
    if (!result.success) {
      setTeamFeedback(result.error ?? "Não foi possível desativar o membro.");
      return;
    }

    setOrganizationMembers((items) => items.map((item) => (item.id === memberId ? result.data ?? item : item)));
    setTeamFeedback("Membro desativado.");
  }

  async function inviteOrganizationMember() {
    setTeamFeedback("");
    setInviteLoading(true);
    const result = await createOrganizationInvitation(inviteEmail, inviteRole);
    setInviteLoading(false);
    if (!result.success) {
      setTeamFeedback(result.error ?? "Não foi possível criar o convite.");
      return;
    }

    setInviteEmail("");
    setOrganizationInvitations((items) => [result.data!, ...items]);
    setTeamFeedback("Convite criado. O usuário será adicionado quando entrar com esse email.");
  }

  async function cancelPendingInvitation(invitationId: string) {
    setTeamFeedback("");
    const result = await cancelOrganizationInvitation(invitationId);
    if (!result.success) {
      setTeamFeedback(result.error ?? "Não foi possível cancelar o convite.");
      return;
    }

    setOrganizationInvitations((items) => items.filter((item) => item.id !== invitationId));
    setTeamFeedback("Convite cancelado.");
  }

  const runChecks = useCallback(async () => {
    if (!supabase) {
      setChecks(migrationChecksInitialState(false));
      return;
    }

    const client = supabase;
    setChecking(true);
    const [
      session,
      saasResult,
      commercial,
      tasksResult,
      googleTaskResult,
      auditResult,
      conversationResult,
      tagResult,
      campaignResult,
      webhookResult,
      evolutionResult,
      googleCalendarResult,
    ] = await Promise.all([
      client.auth.getUser(),
      client
        .from("organization_members")
        .select("id,organization_id,role,status")
        .limit(1),
      client
        .from("leads")
        .select("id,estimated_value,owner_name,temperature,outcome_reason,sla_hours,archived_at")
        .limit(1),
      client
        .from("tasks")
        .select("id,lead_id,type,title,due_at,status,completed_at")
        .limit(1),
      client
        .from("tasks")
        .select("id,google_event_id,google_calendar_id,google_synced_at,google_sync_error")
        .limit(1),
      client
        .from("audit_logs")
        .select("id,entity_type,entity_id,action,summary,metadata")
        .limit(1),
      client
        .from("whatsapp_conversations")
        .select("id,status,unread_count,last_read_at")
        .limit(1),
      client
        .from("tags")
        .select("id,name,color")
        .limit(1),
      client
        .from("prospecting_campaigns")
        .select("id,name,total_contacts,sent_count,failed_count")
        .limit(1),
      fetch("/api/webhooks/evolution", { cache: "no-store" }).then((response) => response.json()).catch(() => null),
      fetch("/api/evolution/status", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json() })).catch(() => null),
      fetch("/api/integrations/google/status", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json() })).catch(() => null),
    ]);
    const evolutionData = evolutionResult?.data;
    const googleCalendarData = googleCalendarResult?.data as GoogleCalendarStatus | undefined;

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

    if (googleCalendarData) {
      setGoogleCalendarStatus(googleCalendarData);
    }

    setChecks([
      {
        label: "Supabase",
        status: session.data.user ? "ok" : "missing",
        detail: session.data.user ? "Sessão autenticada e banco acessível" : "Usuário não autenticado ou RLS bloqueando leitura",
      },
      {
        label: "Base SaaS",
        status: saasResult.error ? "missing" : "ok",
        detail: saasResult.error
          ? "Aplique supabase/saas_base_migration.sql para ativar organizações, membros e assinaturas"
          : "Organizações, membros e assinatura disponíveis para venda recorrente",
      },
      {
        label: "Campos comerciais",
        status: commercial.error ? "missing" : "ok",
        detail: commercial.error
          ? "Aplique commercial_pipeline_migration.sql, lead_archiving_contracts_migration.sql e custom_pipeline_stages_migration.sql"
          : "Campos comerciais, arquivamento e etapas customizadas disponíveis",
      },
      {
        label: "Tabela de tarefas",
        status: tasksResult.error ? "missing" : "ok",
        detail: tasksResult.error
          ? "Aplique supabase/tasks_migration.sql, tasks_meeting_type_migration.sql e tasks_operational_migration.sql"
          : "Tabela tasks disponível para tarefas comerciais e operacionais",
      },
      {
        label: "Trilha de auditoria",
        status: auditResult.error ? "missing" : "ok",
        detail: auditResult.error
          ? "Aplique supabase/audit_logs_migration.sql"
          : "Tabela audit_logs pronta para ações sensíveis",
      },
      {
        label: "Conversas operacionais",
        status: conversationResult.error ? "missing" : "ok",
        detail: conversationResult.error
          ? "Aplique supabase/conversations_operational_migration.sql"
          : "Status resolvida/arquivada e inbox operacional disponíveis",
      },
      {
        label: "Tags e campanhas",
        status: tagResult.error || campaignResult.error ? "missing" : "ok",
        detail: tagResult.error || campaignResult.error
          ? "Aplique supabase/tags_and_prospecting_campaigns_migration.sql"
          : "Tags e histórico de campanhas de prospecção disponíveis",
      },
      {
        label: "Google Calendar",
        status: googleCalendarData?.configured && !googleTaskResult.error && googleCalendarData.migrated !== false ? "ok" : "missing",
        detail: !googleCalendarData?.configured
          ? "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_CALENDAR_REDIRECT_URI na Vercel"
          : googleTaskResult.error || googleCalendarData?.migrated === false
            ? "Aplique supabase/google_calendar_migration.sql para ativar conexão por usuário e eventos automáticos"
            : googleCalendarData?.connected
              ? `Agenda conectada${googleCalendarData.connection?.account_email ? ` em ${googleCalendarData.connection.account_email}` : ""}`
              : "OAuth configurado. Conecte uma conta Google na aba CRM",
      },
      {
        label: "Webhook WhatsApp",
        status: webhookResult?.status === "ok" ? "ok" : "missing",
        detail: webhookResult?.status === "ok"
          ? `Endpoint ativo com ${(webhookResult.events ?? []).length} eventos suportados`
          : "Não foi possível validar o endpoint público do webhook",
      },
      {
        label: "Evolution",
        status: evolutionData?.configured ? "ok" : "missing",
        detail: evolutionData?.configured
          ? `Instância ${evolutionData.instanceName || "configurada"} em estado ${evolutionData.state || "indefinido"}`
          : "Variáveis da Evolution ausentes ou não acessíveis",
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const googleCalendar = params.get("googleCalendar");
    const googleCalendarError = params.get("googleCalendarError");
    const billing = params.get("billing");

    const timeout = window.setTimeout(() => {
      if (googleCalendar === "connected") {
        setActiveTab("crm");
        setGoogleCalendarFeedback("Google Calendar conectado. Novas tarefas serão sincronizadas automaticamente.");
        void refreshGoogleCalendarStatus();
      } else if (googleCalendarError) {
        setActiveTab("crm");
        setGoogleCalendarFeedback(googleCalendarError);
      } else if (googleCalendar) {
        setActiveTab("crm");
        setGoogleCalendarFeedback(`Google Calendar: ${googleCalendar}`);
      }

      if (billing === "success") {
        setActiveTab("data");
        setBillingFeedback("Pagamento confirmado. A assinatura será atualizada assim que o Stripe enviar o webhook.");
      } else if (billing === "canceled") {
        setActiveTab("data");
        setBillingFeedback("Checkout cancelado. Nenhuma alteração foi feita.");
      }

      if (googleCalendar || googleCalendarError || billing) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

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
      if (!response.ok) setEvolutionFeedback(data.error ?? "Não foi possível consultar a Evolution");
    } catch {
      setEvolutionFeedback("Não foi possível consultar a Evolution");
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
        setEvolutionFeedback(data.error ?? "Não foi possível gerar QR Code");
        return;
      }

      setEvolutionQrCode(data.base64 ?? null);
      setEvolutionPairingCode(data.pairingCode ?? null);
      await refreshEvolutionStatus();
      setEvolutionFeedback(
        data.base64
          ? "QR gerado. Escaneie pelo WhatsApp e clique em Atualizar."
          : data.pairingCode
            ? "Código de pareamento gerado."
            : "A Evolution respondeu, mas não retornou QR ou código de pareamento.",
      );
    } catch {
      setEvolutionFeedback("Não foi possível gerar QR Code");
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
        setEvolutionFeedback(data.error ?? "Não foi possível desconectar");
        return;
      }

      setEvolutionQrCode(null);
      setEvolutionPairingCode(null);
      await refreshEvolutionStatus();
      setEvolutionFeedback("WhatsApp desconectado");
    } catch {
      setEvolutionFeedback("Não foi possível desconectar");
    } finally {
      setEvolutionDisconnecting(false);
    }
  }

  async function testWebhook() {
    const response = await fetch("/api/webhooks/evolution", { cache: "no-store" });
    const data = await response.json();
    setEvolutionFeedback(response.ok ? `Webhook ativo: ${(data.events ?? []).join(", ")}` : "Webhook não respondeu");
  }

  async function refreshGoogleCalendarStatus() {
    setGoogleCalendarLoading(true);
    try {
      const response = await fetch("/api/integrations/google/status", { cache: "no-store" });
      const data = await response.json();
      setGoogleCalendarStatus({
        configured: Boolean(data.configured),
        migrated: data.migrated,
        connected: Boolean(data.connected),
        error: data.error,
        connection: data.connection ?? null,
      });
      if (!response.ok || data.error) {
        setGoogleCalendarFeedback(data.error ?? "Não foi possível consultar Google Calendar");
      }
    } catch {
      setGoogleCalendarFeedback("Não foi possível consultar Google Calendar");
    } finally {
      setGoogleCalendarLoading(false);
    }
  }

  function connectGoogleCalendar() {
    window.location.href = "/api/integrations/google/connect";
  }

  async function disconnectGoogleCalendar() {
    setGoogleCalendarFeedback("");
    setGoogleCalendarLoading(true);
    try {
      const response = await fetch("/api/integrations/google/disconnect", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || data.error) {
        setGoogleCalendarFeedback(data.error ?? "Não foi possível desconectar Google Calendar");
        return;
      }

      setGoogleCalendarFeedback("Google Calendar desconectado");
      await refreshGoogleCalendarStatus();
    } catch {
      setGoogleCalendarFeedback("Não foi possível desconectar Google Calendar");
    } finally {
      setGoogleCalendarLoading(false);
    }
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

  async function startCheckout(planSlug: PlanSlug) {
    setBillingFeedback("");
    setBillingLoading(planSlug);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingPeriod: selectedBillingPeriod, seatCount: selectedSeatCount }),
      });
      const data = await response.json();
      if (!response.ok || data.error || !data.url) {
        setBillingFeedback(data.error ?? "Não foi possível iniciar o checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setBillingFeedback("Não foi possível iniciar o checkout.");
    } finally {
      setBillingLoading(null);
    }
  }

  async function openBillingPortal() {
    setBillingFeedback("");
    setBillingLoading("portal");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok || data.error || !data.url) {
        setBillingFeedback(data.error ?? "Não foi possível abrir o portal de cobrança.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setBillingFeedback("Não foi possível abrir o portal de cobrança.");
    } finally {
      setBillingLoading(null);
    }
  }

  const googleCalendarNeedsReconnect = Boolean(
    !googleCalendarStatus?.connected &&
      googleCalendarStatus?.connection &&
      (googleCalendarStatus.error || googleCalendarStatus.connection.last_error),
  );

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
              Último teste: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString("pt-BR") : "ainda não executado"}
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
          <SettingsMetric icon={ShieldCheck} label="Usuário" value={user.email ?? user.id} />
          <SettingsMetric icon={Settings} label="Ambiente" value={environmentHost} />
          <SettingsMetric icon={MessageCircle} label="WhatsApp" value={evolutionStatus?.connected ? "Conectado" : "Pendente"} />
        </div>
        {pendingChecks.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            {pendingChecks.length} item(ns) pedem ação. Copie o SQL pendente e aplique no SQL Editor do Supabase.
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
                <p className="mt-1 text-sm text-zinc-500">Estado da instância, webhook e ações operacionais.</p>
              </div>
              <SettingsStatusPill
                status={evolutionStatus?.connected ? "ok" : "missing"}
                okLabel={evolutionStatus?.connected ? "Conectado" : "Pendente"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsMetric icon={Wifi} label="Estado" value={evolutionStatus?.state ?? "não verificado"} />
              <SettingsMetric icon={UserRound} label="Número conectado" value={evolutionStatus?.phoneNumber ?? "Não informado"} />
              <SettingsMetric icon={MessageCircle} label="Perfil" value={evolutionStatus?.profileName ?? "Não informado"} />
              <SettingsMetric icon={Clock3} label="Último webhook" value={lastWebhook ? new Date(lastWebhook.created_at).toLocaleString("pt-BR") : "Sem eventos"} />
              <SettingsMetric icon={Send} label="Última mensagem" value={lastMessage ? new Date(lastMessage.created_at).toLocaleString("pt-BR") : "Sem mensagens"} />
              <SettingsMetric icon={AlertTriangle} label="Último erro" value={lastError?.error_message ?? lastError?.event_type ?? "Sem erros recentes"} />
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
                  // QR Code vem como data URL da Evolution, entao não passa pelo otimizador de imagem.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="QR Code para conectar WhatsApp"
                    className="h-72 w-72 rounded-lg bg-white p-3"
                    src={evolutionQrCode}
                  />
                ) : evolutionPairingCode ? (
                  <div className="text-center">
                    <div className="text-sm text-zinc-500">Código de pareamento</div>
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 px-5 py-3 font-mono text-2xl tracking-widest text-zinc-100">
                      {evolutionPairingCode}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-sm text-center text-sm leading-6 text-zinc-500">
                    Clique em Gerar QR ou Reconectar para iniciar o pareamento da instância.
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
        <h2 className="text-lg font-semibold">Usuários e segurança</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-zinc-500">Usuário logado</div>
            <div className="mt-1 font-medium text-zinc-100">{user.email ?? user.id}</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <div className="text-xs uppercase text-zinc-500">Organização</div>
                <div className="mt-1 font-medium text-zinc-100">
                  {organizationContext?.organization?.name ?? "Base SaaS pendente"}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <div className="text-xs uppercase text-zinc-500">Papel atual</div>
                <div className="mt-1 font-medium text-zinc-100">{crmRoleLabels[effectiveRole]}</div>
              </div>
            </div>
            <label className="mt-4 block text-sm text-zinc-300">
              Simular permissões por papel
              <select
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#8B5CF6]"
                onChange={(event) => {
                  const nextRole = event.target.value as CrmRole;
                  setRole(nextRole);
                  window.localStorage.setItem("origocrm:user-role", nextRole);
                }}
                value={role}
              >
                {roleOptions.map((option) => (
                  <option key={option} value={option}>{crmRoleLabels[option]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-medium text-zinc-100">Permissões por módulo</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {modulePermissionGroups.map((item) => {
                const enabled = item.permissions.some((permission) => effectivePermissions.has(permission));
                return (
                <span className={`rounded-full border px-2.5 py-1 text-xs ${enabled ? "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]" : "border-white/10 text-zinc-500"}`} key={item.label}>
                  {item.label}
                </span>
                );
              })}
            </div>
            <div className="mt-4 text-sm font-medium text-zinc-100">Ações sensíveis</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {sensitivePermissionGroups.map((item) => {
                const enabled = item.permissions.every((permission) => effectivePermissions.has(permission));
                return (
                <span className={`rounded-full border px-2.5 py-1 text-xs ${enabled ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-white/10 text-zinc-500"}`} key={item.label}>
                  {item.label}
                </span>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <div className="text-xs uppercase text-zinc-500">Permissões da simulação</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from(previewPermissions).map((permission) => (
                  <span className="rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2.5 py-1 text-xs text-[#C4B5FD]" key={permission}>
                    {crmPermissionLabels[permission]}
                  </span>
                ))}
                {previewPermissions.size === 0 && <span className="text-xs text-zinc-500">Apenas leitura.</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SettingsMetric icon={UserRound} label="Usuários ativos" value={`${activeTeamSeats}/${teamUserLimit}`} />
          <SettingsMetric icon={Clock3} label="Convites pendentes" value={String(pendingTeamSeats)} />
          <SettingsMetric icon={ShieldCheck} label="Vagas disponíveis" value={String(availableTeamSeats)} />
        </div>
        <div className="mt-5 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex-1 text-sm text-zinc-300">
              Email do novo usuário
              <input
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#8B5CF6]"
                disabled={!canManageTeam || inviteLoading || availableTeamSeats <= 0}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="nome@empresa.com"
                type="email"
                value={inviteEmail}
              />
            </label>
            <label className="w-full text-sm text-zinc-300 lg:w-52">
              Papel
              <select
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-[#8B5CF6]"
                disabled={!canManageTeam || inviteLoading || availableTeamSeats <= 0}
                onChange={(event) => setInviteRole(event.target.value as CrmRole)}
                value={inviteRole}
              >
                {roleOptions.filter((option) => option !== "owner").map((option) => (
                  <option key={option} value={option}>{crmRoleLabels[option]}</option>
                ))}
              </select>
            </label>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canManageTeam || inviteLoading || !inviteEmail.trim() || availableTeamSeats <= 0}
              onClick={() => void inviteOrganizationMember()}
              type="button"
            >
              {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Convidar
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            O convite fica pendente por 7 dias. Quando a pessoa entrar no OrigoCRM com o mesmo email, ela será vinculada automaticamente à organização.
          </p>
          {availableTeamSeats <= 0 && (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              Limite de usuários atingido para o plano atual.
            </p>
          )}
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold text-zinc-100">Membros da organização</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Controle papéis, convites e acessos ativos da equipe.
              </p>
            </div>
            <button
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
              disabled={membersLoading}
              onClick={() => void refreshOrganizationMembers()}
              type="button"
            >
              {membersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
          </div>
          {teamFeedback && <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-zinc-300">{teamFeedback}</p>}
          {organizationInvitations.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Convites pendentes
              </div>
              {organizationInvitations.map((invite) => (
                <div className="grid gap-3 border-b border-white/10 bg-black/20 p-3 text-sm last:border-b-0 lg:grid-cols-[1fr_0.5fr_0.6fr_auto]" key={invite.id}>
                  <div>
                    <div className="font-medium text-zinc-100">{invite.email}</div>
                    <div className="mt-1 text-xs text-zinc-500">Expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-zinc-500">Papel</div>
                    <div className="mt-1 font-medium text-zinc-100">{crmRoleLabels[invite.role]}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-zinc-500">Status</div>
                    <div className="mt-1 font-medium text-amber-100">Pendente</div>
                  </div>
                  <button
                    className="flex h-9 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                    disabled={!canManageTeam}
                    onClick={() => void cancelPendingInvitation(invite.id)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {organizationMembers.map((member) => (
              <div className="grid gap-3 bg-black/20 p-3 text-sm lg:grid-cols-[1.2fr_0.7fr_0.8fr_auto]" key={member.id}>
                <div>
                  <div className="font-medium text-zinc-100">{member.user_id === user.id ? user.email ?? member.user_id : member.user_id}</div>
                  <div className="mt-1 text-xs text-zinc-500">ID {member.user_id}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-zinc-500">Status</div>
                  <div className={`mt-1 font-medium ${member.status === "active" ? "text-[#9AF0B8]" : "text-zinc-500"}`}>
                    {member.status === "active" ? "Ativo" : member.status === "invited" ? "Convidado" : "Desativado"}
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs uppercase text-zinc-500">Papel</span>
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-[#8B5CF6] disabled:opacity-60"
                    disabled={!canManageTeam || member.status !== "active" || member.role === "owner"}
                    onChange={(event) => void changeOrganizationMemberRole(member.id, event.target.value as CrmRole)}
                    value={member.role}
                  >
                    {member.role === "owner" && <option value="owner">{crmRoleLabels.owner}</option>}
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>{crmRoleLabels[option]}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="flex h-9 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canManageTeam || member.user_id === user.id || member.status !== "active" || member.role === "owner"}
                  onClick={() => void deactivateOrganizationMember(member.id)}
                  type="button"
                >
                  Desativar
                </button>
              </div>
            ))}
            {organizationMembers.length === 0 && (
              <div className="p-4 text-sm text-zinc-500">Nenhum membro carregado.</div>
            )}
          </div>
        </div>
      </section>
      )}

      {activeTab === "crm" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold">Preferências do CRM</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-medium text-zinc-100">Aparência</div>
            <p className="mt-1 text-sm text-zinc-500">
              Alterne o conteúdo do sistema entre escuro e claro. A barra lateral permanece escura para preservar a identidade OrigoCRM.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {([
                ["dark", Moon, "Escuro", "Operação em ambiente dark premium."],
                ["light", Sun, "Claro", "Leitura clara com menu lateral dark."],
              ] as Array<[CrmTheme, typeof Moon, string, string]>).map(([theme, Icon, title, description]) => (
                <button
                  className={`rounded-lg border p-4 text-left transition ${
                    crmTheme === theme
                      ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/15 shadow-lg shadow-[#8B5CF6]/10"
                      : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                  }`}
                  key={theme}
                  onClick={() => onThemeChange(theme)}
                  type="button"
                >
                  <Icon className="h-4 w-4 text-[#A78BFA]" />
                  <div className="mt-3 font-medium text-zinc-100">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          <SettingsInput label="Nome da empresa" value={preferences.companyName} onChange={(value) => updatePreference("companyName", value)} />
          <SettingsInput label="Marca exibida" value={preferences.brandName} onChange={(value) => updatePreference("brandName", value)} />
          <SettingsInput label="SLA padrão (horas)" value={preferences.defaultSlaHours} onChange={(value) => updatePreference("defaultSlaHours", value)} />
          <SettingsInput label="Horário comercial" value={preferences.businessHours} onChange={(value) => updatePreference("businessHours", value)} />
          <SettingsInput label="Follow-up padrão (dias)" value={preferences.defaultFollowupDays} onChange={(value) => updatePreference("defaultFollowupDays", value)} />
          <SettingsInput label="Origem padrão WhatsApp" value={preferences.defaultWhatsAppSource} onChange={(value) => updatePreference("defaultWhatsAppSource", value)} />
          <SettingsInput label="Responsável padrão" value={preferences.defaultOwnerName} onChange={(value) => updatePreference("defaultOwnerName", value)} />
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-zinc-100">Funil e temperaturas</div>
          <p className="mt-1 text-sm text-zinc-500">Etapas seguem configuraveis na tela CRM. Temperaturas atuais: frio, morno e quente.</p>
        </div>
        <div className="mt-4 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <CalendarClock className="h-4 w-4 text-[#A78BFA]" />
                Google Calendar
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Conecte sua conta Google para criar e atualizar eventos automaticamente quando uma tarefa for criada,
                editada ou reagendada no OrigoCRM.
              </p>
            </div>
            <SettingsStatusPill
              status={googleCalendarStatus?.connected ? "ok" : "missing"}
              okLabel={googleCalendarStatus?.connected ? "Conectado" : "Pendente"}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SettingsMetric
              icon={ShieldCheck}
              label="OAuth"
              value={googleCalendarStatus?.configured ? "Configurado" : "Pendente"}
            />
            <SettingsMetric
              icon={UserRound}
              label="Conta"
              value={googleCalendarStatus?.connection?.account_email ?? user.email ?? "Não conectada"}
            />
            <SettingsMetric
              icon={Clock3}
              label="Ultima sync"
              value={
                googleCalendarStatus?.connection?.last_synced_at
                  ? new Date(googleCalendarStatus.connection.last_synced_at).toLocaleString("pt-BR")
                  : "Sem sincronização"
              }
            />
          </div>

          {(googleCalendarFeedback || googleCalendarStatus?.error || googleCalendarStatus?.connection?.last_error) && (
            <p className={`mt-4 rounded-lg border p-3 text-sm ${
              googleCalendarNeedsReconnect
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                : "border-white/10 bg-black/20 text-zinc-300"
            }`}>
              {googleCalendarFeedback || googleCalendarStatus?.error || googleCalendarStatus?.connection?.last_error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
              disabled={googleCalendarLoading}
              onClick={() => void refreshGoogleCalendarStatus()}
              type="button"
            >
              {googleCalendarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar status
            </button>
            {googleCalendarStatus?.connected ? (
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
                disabled={googleCalendarLoading}
                onClick={() => void disconnectGoogleCalendar()}
                type="button"
              >
                <WifiOff className="h-4 w-4" />
                Desconectar agenda
              </button>
            ) : (
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-60"
                disabled={googleCalendarLoading || googleCalendarStatus?.migrated === false || googleCalendarStatus?.configured === false}
                onClick={connectGoogleCalendar}
                type="button"
              >
                <ExternalLink className="h-4 w-4" />
                {googleCalendarNeedsReconnect ? "Reconectar Google Calendar" : "Conectar Google Calendar"}
              </button>
            )}
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
              onClick={() => openGoogleCalendarEvent({
                title: "Tarefa OrigoCRM",
                startsAt: addDays(1),
                details: "Teste de evento pre-preenchido pelo OrigoCRM",
                lead: null,
              })}
              type="button"
            >
              <CalendarClock className="h-4 w-4" />
              Testar link manual
            </button>
          </div>
        </div>
      </section>
      )}

      {activeTab === "audit" && (
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Auditoria profissional</h2>
            <p className="mt-1 text-sm text-zinc-500">Ações sensiveis registradas para rastreabilidade operacional.</p>
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
            placeholder="Buscar resumo, ação ou metadata"
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
            <option value="all">Todas ações</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {filteredAuditLogs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">
              Nenhum registro carregado. Se a migração estiver pendente, aplique audit_logs_migration.sql.
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
            <p className="mt-1 text-sm text-zinc-500">Webhooks, falhas e eventos de sincronização em linguagem operacional.</p>
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
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 xl:col-span-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#A78BFA]">
              <CreditCard className="h-4 w-4" />
              Assinatura e planos
            </div>
            <h2 className="mt-2 text-lg font-semibold">Plano atual: {currentPlan?.name ?? "Acesso manual"}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {currentSubscription
                ?
                 `${currentSubscription.status} - ${getBillingPeriod(currentSubscription.billing_period).label}`
                : "Nenhuma assinatura vinculada à organização."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-500">Período</div>
              <div className="flex flex-wrap gap-2">
                {billingPeriods.map((period) => (
                  <button
                    className={`h-9 rounded-lg border px-3 text-sm transition ${
                      selectedBillingPeriod === period.key
                        ?
                         "border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-white"
                        : "border-white/10 text-zinc-400 hover:bg-white/[0.06]"
                    }`}
                    key={period.key}
                    onClick={() => setSelectedBillingPeriod(period.key)}
                    type="button"
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Assentos</span>
              <input
                className="h-9 w-24 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]/60"
                max={50}
                min={1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedSeatCount(Math.min(50, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1)));
                }}
                type="number"
                value={selectedSeatCount}
              />
            </label>
            {currentSubscription?.provider_customer_id && (
              <button
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                disabled={!canManageBilling || billingLoading === "portal"}
                onClick={() => void openBillingPortal()}
                type="button"
              >
                {billingLoading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Gerenciar cobrança
              </button>
            )}
          </div>
        </div>
        {billingFeedback && <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">{billingFeedback}</p>}
        {!canManageBilling && (
          <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            Seu papel atual não permite gerenciar assinatura.
          </p>
        )}
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentSubscription?.plan_slug === plan.slug;
            const price = getPlanPriceCents(plan.slug, selectedBillingPeriod);
            const monthly = getPlanMonthlyEquivalentCents(plan.slug, selectedBillingPeriod);
            const periodTotal = price * selectedSeatCount;
            const monthlyTotal = monthly * selectedSeatCount;
            return (
              <div
                className={`flex min-h-80 flex-col rounded-xl border p-4 transition ${
                  plan.featured
                    ?
                     "border-[#8B5CF6]/45 bg-[#8B5CF6]/10 shadow-lg shadow-[#8B5CF6]/10"
                    : "border-white/10 bg-black/20"
                }`}
                key={plan.slug}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{plan.name}</h3>
                    <p className="mt-1 min-h-10 text-sm leading-5 text-zinc-500">{plan.description}</p>
                  </div>
                  {isCurrent && <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-1 text-xs text-[#9AF0B8]">Atual</span>}
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-semibold text-zinc-100">{formatMoneyFromCents(monthly)}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    por usuário/mês, cobrado {getBillingPeriod(selectedBillingPeriod).shortLabel}
                  </div>
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                      <span>{selectedSeatCount} assento(s)</span>
                      <span className="font-semibold text-zinc-100">{formatMoneyFromCents(monthlyTotal)}/mês</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span>Total do período</span>
                      <span className="font-semibold text-zinc-100">{formatMoneyFromCents(periodTotal)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {plan.highlights.map((item) => (
                    <div className="flex items-center gap-2 text-sm text-zinc-300" key={item}>
                      <Check className="h-4 w-4 text-[#25D366]" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-5">
                  <button
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-3 text-sm font-semibold text-white transition hover:bg-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canManageBilling || billingLoading !== null || isCurrent}
                    onClick={() => void startCheckout(plan.slug)}
                    type="button"
                  >
                    {billingLoading === plan.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {isCurrent ? "Plano atual" : "Assinar plano"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
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
        <p className="mt-4 text-sm text-zinc-500">Retenção atual: manter histórico operacional. Importação CSV entra em fase posterior.</p>
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

function friendlyWhatsAppLogLabel(log: WhatsAppLog) {
  if (log.status === "error") return log.error_message || "Falha na integração WhatsApp";
  if (log.event_type.includes("messages.upsert.ignored")) return "Mensagem ignorada pelo webhook";
  if (log.event_type.includes("messages.upsert.unmatched_saved")) return "Conversa criada sem lead vinculado";
  if (log.event_type.includes("messages.upsert")) return "Mensagem recebida pelo webhook";
  if (log.event_type.includes("messages.update")) return "Status de entrega atualizado";
  if (log.event_type.includes("connection")) return "Estado da conexão atualizado";
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

function LeadCreateModal({
  availableTags,
  columns,
  onClose,
  onSave,
}: {
  availableTags: CrmTag[];
  columns: PipelineStage[];
  onClose: () => void;
  onSave: (input: LeadInput, tagIds: string[], newTagName: string) => Promise<Lead | null>;
}) {
  const [form, setForm] = useState<LeadInput>({ ...emptyLead });
  const [activeTab, setActiveTab] = useState<LeadCreateTab>("summary");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const tabs: { id: LeadCreateTab; label: string; helper: string; locked: boolean }[] = [
    { id: "summary", label: "Resumo", helper: "Cadastro rapido", locked: false },
    { id: "commercial", label: "Comercial", helper: "Campos avancados", locked: false },
    { id: "tasks", label: "Tarefas", helper: "Liberado após salvar", locked: true },
    { id: "contact", label: "Contato", helper: "Liberado após salvar", locked: true },
    { id: "history", label: "Histórico", helper: "Liberado após salvar", locked: true },
  ];

  function updateField<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form, Array.from(selectedTagIds), newTagName);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="crm-modal-surface reveal-up relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#8B5CF6]/25 bg-[#0F0F16]/95 text-white shadow-2xl shadow-[#8B5CF6]/15">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,0.85),rgba(37,211,102,0.3),transparent)]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 opacity-[0.04]">
          <Image alt="" className="object-contain" fill sizes="256px" src="/origocrm-icon.png" />
        </div>
        <header className="relative flex shrink-0 flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold">Novo lead</h2>
              <span className="rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-3 py-1 text-xs font-semibold text-[#DDD6FE]">
                Cadastro manual
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Cadastre o essencial agora. Depois de salvar, o Lead 360 abre para tarefas, WhatsApp e histórico.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              onClick={onClose}
              type="button"
            >
              Fechar
            </button>
            <button
              className="shine-cta flex h-10 items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-4 text-sm font-semibold text-white shadow-lg shadow-[#8B5CF6]/20 transition hover:bg-[#7C3AED] disabled:opacity-60"
              disabled={saving}
              form="lead-create-form"
              type="submit"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando" : "Salvar lead"}
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-2">
              {tabs.map((tab) => (
                <button
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    activeTab === tab.id
                      ?
                       "border-[#8B5CF6]/65 bg-[#8B5CF6]/18 text-white"
                      : "border-white/10 bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    {tab.locked && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400">após salvar</span>}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{tab.helper}</div>
                </button>
              ))}
            </aside>

            <form id="lead-create-form" className="min-w-0" onSubmit={submit}>
              {activeTab === "summary" && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-zinc-100">Cadastro rapido</h3>
                    <p className="mt-1 text-sm text-zinc-500">Preencha os campos que colocam o lead no CRM sem atrito.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
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
                      Etapa
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
                    <label className="block text-sm text-zinc-300">
                      Temperatura
                      <select
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
                        onChange={(event) => updateField("temperature", event.target.value as Lead["temperature"])}
                        value={form.temperature ?? "morno"}
                      >
                        <option value="frio">Frio</option>
                        <option value="morno">Morno</option>
                        <option value="quente">Quente</option>
                      </select>
                    </label>
                    <Input label="Responsável" onChange={(value) => updateField("owner_name", value)} value={form.owner_name ?? ""} />
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">Tags</div>
                        <p className="text-xs text-zinc-500">Organize a origem, perfil e prioridade desde o cadastro.</p>
                      </div>
                      <span className="text-xs text-zinc-500">{selectedTagIds.size} selecionada(s)</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableTags.length === 0 && <span className="text-sm text-zinc-500">Nenhuma tag cadastrada ainda.</span>}
                      {availableTags.map((tag) => (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selectedTagIds.has(tag.id) ? "ring-1 ring-white/25" : "opacity-70 hover:opacity-100"
                          }`}
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}18`, color: tag.color }}
                          type="button"
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                    <input
                      className="mt-3 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
                      onChange={(event) => setNewTagName(event.target.value)}
                      placeholder="Criar nova tag ao salvar"
                      value={newTagName}
                    />
                  </div>
                </section>
              )}

              {activeTab === "commercial" && (
                <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-zinc-100">Dados comerciais avancados</h3>
                    <p className="mt-1 text-sm text-zinc-500">Campos que ajudam na qualificação, SLA e fechamento.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Valor estimado"
                      onChange={(value) => updateField("estimated_value", value ? Number(value.replace(",", ".")) : null)}
                      type="number"
                      value={form.estimated_value?.toString() ?? ""}
                    />
                    <Input
                      label="SLA de retorno (h)"
                      onChange={(value) => updateField("sla_hours", value ? Number(value) : null)}
                      type="number"
                      value={form.sla_hours?.toString() ?? ""}
                    />
                  </div>
                  <label className="mt-4 block text-sm text-zinc-300">
                    Observações comerciais / motivo futuro
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none transition focus:border-[#8B5CF6]"
                      onChange={(event) => updateField("outcome_reason", event.target.value)}
                      value={form.outcome_reason ?? ""}
                    />
                  </label>
                </section>
              )}

              {activeTab !== "summary" && activeTab !== "commercial" && (
                <section className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center">
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#8B5CF6]">
                      {activeTab === "tasks" ? (
                        <CalendarClock className="h-6 w-6" />
                      ) : activeTab === "contact" ? (
                        <MessageCircle className="h-6 w-6" />
                      ) : (
                        <Clock3 className="h-6 w-6" />
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-zinc-100">
                      Salve o lead para liberar esta área
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-zinc-500">
                      Depois do cadastro, o Lead 360 abre automaticamente com tarefas, WhatsApp, histórico e follow-up vinculados ao lead real.
                    </p>
                    <button
                      className="mt-5 rounded-xl bg-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7C3AED]"
                      type="submit"
                    >
                      Salvar e abrir Lead 360
                    </button>
                  </div>
                </section>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

type LeadDetailsTab = "summary" | "commercial" | "tasks" | "contact" | "history";

function LeadDetails({
  columns,
  availableTags,
  leadTags,
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
  onCreateTag,
  onAssignTag,
  onRemoveTag,
  onScheduleFollowup,
  onSaveLead,
  onUpdateTemperature,
  onDelete,
}: {
  columns: PipelineStage[];
  availableTags: CrmTag[];
  leadTags: CrmTag[];
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
  onCreateTag: (name: string) => Promise<CrmTag | null>;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
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
    lead_id: lead.id,
    type: "followup",
    title: `Follow-up com ${lead.name}`,
    notes: "",
    due_at: addDays(1),
  }));
  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState<NonNullable<Interaction["type"]>>("note");
  const [interactionChannel, setInteractionChannel] = useState<Interaction["channel"]>("whatsapp");
  const [newTagName, setNewTagName] = useState("");
  const nextFollowupAt = fromDateTimeLocal(followupAt);
  const openTasks = tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const currentStage = columns.find((column) => column.id === lead.status)?.title ?? lead.status;
  const temperatureLabel = getTemperatureLabel(lead.temperature);
  const leadScore = calculateLeadScore(lead);
  const nextTask = openTasks[0] ?? null;
  const lastInteraction = [...interactions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
  const leadTabs: { id: LeadDetailsTab; label: string; count?: number }[] = [
    { id: "summary", label: "Resumo" },
    { id: "commercial", label: "Comercial" },
    { id: "tasks", label: "Tarefas", count: openTasks.length },
    { id: "contact", label: "Contato" },
    { id: "history", label: "Histórico", count: interactions.length + whatsappMessages.length },
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

  async function submitNewTag() {
    const tag = await onCreateTag(newTagName);
    if (!tag) return;
    onAssignTag(tag.id);
    setNewTagName("");
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
                  {lead.owner_name || "Sem responsável"}
                </span>
                {leadTags.map((tag) => (
                  <button
                    className="rounded-full border px-2 py-0.5 text-xs"
                    key={tag.id}
                    onClick={() => onRemoveTag(tag.id)}
                    style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}18`, color: tag.color }}
                    title="Remover tag"
                    type="button"
                  >
                    {tag.name} x
                  </button>
                ))}
              </div>
              <div className="mt-2 truncate text-sm text-zinc-500">
                {lead.company || "Sem empresa"} - {lead.phone}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:w-[650px]">
              <LeadMetric label="Score" value={`${leadScore.score}`} />
              <LeadMetric label="Tarefas" value={String(openTasks.length)} />
              <LeadMetric label="WhatsApp" value={String(whatsappMessages.length)} />
              <LeadMetric label="Valor" value={formatCurrency(lead.estimated_value) ?? "R$ 0"} />
              <LeadMetric
                label="Proximo"
                value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR") : "Sem data"}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto]">
            <select
              className="h-10 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-zinc-300 outline-none transition focus:border-[#8B5CF6]"
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                onAssignTag(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Aplicar tag existente</option>
              {availableTags
                .filter((tag) => !leadTags.some((item) => item.id === tag.id))
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
            </select>
            <input
              className="h-10 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
              onChange={(event) => setNewTagName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitNewTag();
                }
              }}
              placeholder="Nova tag"
              value={newTagName}
            />
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-3 text-sm text-[#DDD6FE] transition hover:bg-[#8B5CF6]/25 disabled:opacity-50"
              disabled={!newTagName.trim()}
              onClick={() => void submitNewTag()}
              type="button"
            >
              <Tag className="h-4 w-4" />
              Criar tag
            </button>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {leadTabs.map((tab) => (
              <button
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                  activeTab === tab.id
                    ?
                     "border-[#8B5CF6]/70 bg-[#8B5CF6]/20 text-white"
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
                  <p className="mt-1 text-sm text-zinc-500">Próxima melhor ação e contexto essencial do lead.</p>
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
                <LeadSummaryItem label="Origem" value={lead.source || "Não informada"} />
                <LeadSummaryItem label="Responsável" value={lead.owner_name || "Não definido"} />
                <LeadSummaryItem label="Valor estimado" value={formatCurrency(lead.estimated_value) ?? "Não informado"} />
                <LeadSummaryItem
                  label="Proximo contato"
                  value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString("pt-BR") : "Não agendado"}
                />
                <LeadSummaryItem
                  label="Ultimo contato"
                  value={lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleString("pt-BR") : "Sem contato"}
                />
              </div>
              <div className={`mt-4 rounded-lg border p-3 ${leadScore.tone}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs uppercase opacity-80">Lead Scoring</div>
                    <div className="mt-1 text-2xl font-semibold">{leadScore.score}/100</div>
                    <div className="mt-1 text-sm font-medium">{leadScore.label} - {leadScore.action}</div>
                  </div>
                  <div className="grid gap-1 text-xs sm:min-w-[260px]">
                    {leadScore.reasons.map((reason) => (
                      <span className="rounded-md bg-black/15 px-2 py-1" key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
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
                <div className="text-sm font-semibold text-zinc-100">Próxima ação</div>
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
                    Nenhuma tarefa aberta. Crie uma tarefa para manter o lead em cadência.
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
                  <div className="mt-3 text-sm text-zinc-500">Nenhuma interação registrada.</div>
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
                <p className="mt-1 text-sm text-zinc-500">Edite qualificação, responsável e etapa sem sair do lead.</p>
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
              <Input label="Responsável" onChange={(value) => updateCommercialField("owner_name", value)} value={commercialForm.owner_name ?? ""} />
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
                <p className="mt-1 text-xs text-zinc-500">Próximas ações deste lead.</p>
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
                const repeat = getTaskRepeat(task);
                const visibleNotes = stripTaskMetadata(task.notes);
                return (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3" key={task.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                            {taskTypeLabel(task.type)}
                          </span>
                          {repeat !== "none" && (
                            <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                              Repete {taskRepeatLabel(repeat).toLowerCase()}
                            </span>
                          )}
                          <span className="text-sm font-medium text-zinc-100">{task.title}</span>
                        </div>
                        <div className={`mt-2 text-xs ${due.tone}`}>{due.text}</div>
                        {visibleNotes && <p className="mt-2 text-xs leading-5 text-zinc-500">{visibleNotes}</p>}
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
                lead_id: lead.id,
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
                  <option value="call">Ligação</option>
                  <option value="email">Email</option>
                  <option value="meeting">Reunião</option>
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
            <Input label="Título" onChange={(value) => updateTaskField("title", value)} required value={taskForm.title} />
            <label className="mt-3 block text-sm text-zinc-300">
              Observação
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
                ?
                 new Date(lead.next_followup_at).toLocaleString("pt-BR")
                : "Não agendado"}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 5].map((days) => (
              <button
                className={`h-10 rounded-lg border text-sm transition ${
                  isSameFollowupDay(followupAt, days)
                    ?
                     "border-[#8B5CF6] bg-[#8B5CF6] text-white"
                    : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"
                }`}
                key={days}
                onClick={() => setFollowupAt(toDateTimeLocal(addDays(days)))}
                type="button"
              >
                {days === 1 ? "Amanhã" : `${days} dias`}
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
              Tipo de interação
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
                <option value="call">Ligação</option>
                <option value="email">Email</option>
                <option value="other">Outro</option>
              </select>
            </label>
          </div>
          <textarea
            className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resumo objetivo do contato, combinados, objeções ou próximo passo"
            required
            value={note}
          />
          <button className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm text-zinc-300 transition hover:bg-white/[0.06]">
            <Edit3 className="h-4 w-4" />
            Registrar interação
          </button>
        </form>

        <LeadHistory interactions={interactions} whatsappMessages={whatsappMessages} />
        </section>
        )}
      </div>
    </Modal>
  );
}

