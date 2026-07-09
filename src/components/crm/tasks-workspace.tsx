"use client";

import {
  Check,
  ChevronDown,
  Clock3,
  Edit3,
  ExternalLink,
  GripVertical,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  endOfDay,
  fromDateTimeLocal,
  getDueAtLabel,
  getTaskRepeat,
  getTemperatureLabel,
  isLeadClosed,
  isTaskDueOnDate,
  isTaskOverdue,
  openGoogleCalendarEvent,
  startOfDay,
  stripTaskMetadata,
  taskRepeatLabel,
  taskTypeLabel,
} from "@/components/crm/lead-helpers";
import { ConfirmDeleteTask } from "@/components/crm/confirmations";
import {
  ConfirmDeleteGoogleEvent,
  GoogleEventEditorModal,
  TaskEditorModal,
} from "@/components/crm/task-modals";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventDraft,
  TaskEditorState,
  TaskGroupMode,
  TaskInput,
  TaskPriority,
  TaskScope,
  TaskSortMode,
  TaskViewMode,
  TaskWorkflowStatus,
} from "@/components/crm/tasks-types";
import type { Lead, Task } from "@/lib/types";

type TaskRow = {
  task: Task;
  lead: Lead | null;
};

type TasksWorkspaceProps = {
  tasks: Task[];
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onCreateTask: (lead: Lead | null, input: TaskInput) => void;
  onRescheduleTask: (task: Task, lead: Lead | null, dueAt: string) => void;
  onScheduleLeadFollowup: (lead: Lead, dueAt: string) => void;
  onUpdateTask: (task: Task, lead: Lead | null, input: TaskInput) => void;
  onDeleteTask: (task: Task, lead: Lead | null) => void;
};

const workflowColumns: Array<{ id: TaskWorkflowStatus; label: string; helper: string }> = [
  { id: "todo", label: "A fazer", helper: "Próximas ações ainda não iniciadas" },
  { id: "in_progress", label: "Em andamento", helper: "Atividades em execução" },
  { id: "waiting", label: "Aguardando", helper: "Depende de retorno ou terceiro" },
  { id: "review", label: "Em revisão", helper: "Precisa validar antes de fechar" },
  { id: "completed", label: "Concluído", helper: "Finalizadas no período" },
  { id: "blocked", label: "Bloqueado", helper: "Impedidas de avançar" },
];

const priorityLabels: Record<TaskPriority, { label: string; tone: string; weight: number }> = {
  low: { label: "Baixa", tone: "border-sky-400/25 bg-sky-500/10 text-sky-200", weight: 1 },
  medium: { label: "Média", tone: "border-amber-400/25 bg-amber-500/10 text-amber-100", weight: 2 },
  high: { label: "Alta", tone: "border-orange-400/25 bg-orange-500/10 text-orange-100", weight: 3 },
  urgent: { label: "Urgente", tone: "border-red-400/25 bg-red-500/10 text-red-200", weight: 4 },
};

function normalizeWorkflowStatus(task: Task): TaskWorkflowStatus {
  if (task.status === "completed") return "completed";
  return task.workflow_status ?? "todo";
}

function normalizePriority(task: Task): TaskPriority {
  return task.priority ?? "medium";
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getTaskInput(task: Task, patch: Partial<TaskInput> = {}): TaskInput {
  return {
    lead_id: patch.lead_id ?? task.lead_id ?? null,
    type: patch.type ?? task.type,
    title: patch.title ?? task.title,
    notes: patch.notes ?? task.notes ?? null,
    priority: patch.priority ?? normalizePriority(task),
    workflow_status: patch.workflow_status ?? normalizeWorkflowStatus(task),
    start_at: patch.start_at ?? task.start_at ?? null,
    position: patch.position ?? task.position ?? 0,
    due_at: patch.due_at ?? task.due_at,
  };
}

export function TasksWorkspace({
  tasks,
  leads,
  onOpenLead,
  onCompleteTask,
  onCreateTask,
  onRescheduleTask,
  onScheduleLeadFollowup,
  onUpdateTask,
  onDeleteTask,
}: TasksWorkspaceProps) {
  const [scope, setScope] = useState<TaskScope>("open");
  const [viewMode, setViewMode] = useState<TaskViewMode>("list");
  const [owner, setOwner] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TaskWorkflowStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [leadFilter, setLeadFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<TaskSortMode>("due");
  const [groupMode, setGroupMode] = useState<TaskGroupMode>("none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [taskEditor, setTaskEditor] = useState<TaskEditorState | null>(null);
  const [taskDetails, setTaskDetails] = useState<TaskRow | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);
  const [googleEventEditor, setGoogleEventEditor] = useState<GoogleCalendarEvent | null | "new">(null);
  const [googleEventDeleteTarget, setGoogleEventDeleteTarget] = useState<GoogleCalendarEvent | null>(null);
  const [googleEventActionLoading, setGoogleEventActionLoading] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [googleEventsFeedback, setGoogleEventsFeedback] = useState("");

  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const sortedLeads = useMemo(() => [...leads].sort((a, b) => a.name.localeCompare(b.name)), [leads]);
  const owners = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.owner_name?.trim()).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b)),
    [leads],
  );

  const rows = useMemo<TaskRow[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks
      .map((task) => ({ task, lead: task.lead_id ? leadById.get(task.lead_id) ?? null : null }))
      .filter(({ task, lead }) => {
        const workflowStatus = normalizeWorkflowStatus(task);
        const priority = normalizePriority(task);
        if (owner !== "all" && lead?.owner_name !== owner) return false;
        if (statusFilter !== "all" && workflowStatus !== statusFilter) return false;
        if (priorityFilter !== "all" && priority !== priorityFilter) return false;
        if (leadFilter === "with_lead" && !lead) return false;
        if (leadFilter === "without_lead" && lead) return false;
        if (leadFilter !== "all" && leadFilter !== "with_lead" && leadFilter !== "without_lead" && task.lead_id !== leadFilter) return false;
        if (scope === "completed") {
          if (task.status !== "completed" && workflowStatus !== "completed") return false;
        } else {
          if (task.status !== "open") return false;
          if (scope === "overdue" && !isTaskOverdue(task)) return false;
          if (scope === "today" && !isTaskDueOnDate(task, new Date())) return false;
          if (scope === "upcoming" && new Date(task.due_at).getTime() <= endOfDay(new Date()).getTime()) return false;
        }
        if (!normalizedSearch) return true;
        const haystack = [
          task.title,
          task.notes,
          taskTypeLabel(task.type),
          priorityLabels[priority].label,
          workflowColumns.find((column) => column.id === workflowStatus)?.label,
          lead?.name,
          lead?.company,
          lead?.phone,
          lead?.owner_name,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortMode === "priority") return priorityLabels[normalizePriority(b.task)].weight - priorityLabels[normalizePriority(a.task)].weight;
        if (sortMode === "status") return normalizeWorkflowStatus(a.task).localeCompare(normalizeWorkflowStatus(b.task));
        if (sortMode === "owner") return (a.lead?.owner_name ?? "zz").localeCompare(b.lead?.owner_name ?? "zz");
        return new Date(a.task.due_at).getTime() - new Date(b.task.due_at).getTime();
      });
  }, [leadById, leadFilter, owner, priorityFilter, scope, search, sortMode, statusFilter, tasks]);

  const agendaRows = useMemo(
    () =>
      leads
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
        .sort((a, b) => new Date(a.next_followup_at ?? "").getTime() - new Date(b.next_followup_at ?? "").getTime()),
    [leads, owner, scope],
  );

  const counts = useMemo(() => {
    const ownerTasks = tasks.filter((task) => {
      if (owner === "all") return true;
      const lead = task.lead_id ? leadById.get(task.lead_id) : null;
      return lead?.owner_name === owner;
    });
    return {
      open: ownerTasks.filter((task) => task.status === "open").length,
      overdue: ownerTasks.filter((task) => task.status === "open" && isTaskOverdue(task)).length,
      today: ownerTasks.filter((task) => task.status === "open" && isTaskDueOnDate(task, new Date())).length,
      upcoming: ownerTasks.filter((task) => task.status === "open" && new Date(task.due_at).getTime() > endOfDay(new Date()).getTime()).length,
      completed: ownerTasks.filter((task) => task.status === "completed").length,
    };
  }, [leadById, owner, tasks]);

  const commercialCount = rows.filter((row) => row.lead).length;
  const operationalCount = rows.length - commercialCount;
  const selectedRows = rows.filter(({ task }) => selectedIds.has(task.id));

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

  function toggleTaskSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveTask(input: TaskInput) {
    const editor = taskEditor;
    if (!editor) return;
    const lead = input.lead_id ? leads.find((item) => item.id === input.lead_id) ?? null : null;
    if (editor.task) onUpdateTask(editor.task, editor.lead ?? lead, input);
    else onCreateTask(lead, input);
    setTaskEditor(null);
  }

  function moveTask(task: Task, lead: Lead | null, workflowStatus: TaskWorkflowStatus) {
    if (workflowStatus === "completed") {
      onCompleteTask(task, lead);
      return;
    }
    if (task.status === "completed") onRescheduleTask(task, lead, task.due_at);
    onUpdateTask(task, lead, getTaskInput(task, { workflow_status: workflowStatus }));
  }

  function bulkReschedule(days: number) {
    for (const { task, lead } of selectedRows) {
      onRescheduleTask(task, lead, addDays(days));
    }
    setSelectedIds(new Set());
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
      attendees: input.attendees.split(/[,\n;]/).map((email) => email.trim()).filter(Boolean),
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
      const response = await fetch(`/api/integrations/google/events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
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
              scope === key ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/15" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
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

      <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Tarefas</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {commercialCount} comerciais e {operationalCount} operacionais. Organize por lista, quadro ou calendário.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["list", "board", "calendar"] as TaskViewMode[]).map((mode) => (
                <button
                  className={`h-10 rounded-lg border px-3 text-sm transition ${
                    viewMode === mode
                      ? "border-[#8B5CF6]/50 bg-[#8B5CF6] text-white"
                      : "border-white/10 text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {mode === "list" ? "Lista" : mode === "board" ? "Quadro" : "Calendário"}
                </button>
              ))}
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
                type="button"
              >
                <Settings className="h-4 w-4" />
                Visualização
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-medium text-white transition hover:bg-[#7C3AED]"
                onClick={() => setTaskEditor({ lead: null })}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Nova tarefa
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-zinc-400">
              <Search className="h-4 w-4" />
              <input
                className="w-full bg-transparent outline-none placeholder:text-zinc-600"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar tarefa, lead ou contexto"
                value={search}
              />
            </label>
            <TaskSelect label="Responsável" onChange={setOwner} value={owner}>
              <option value="all">Todos</option>
              {owners.map((item) => <option key={item} value={item}>{item}</option>)}
            </TaskSelect>
            <TaskSelect label="Status" onChange={(value) => setStatusFilter(value as TaskWorkflowStatus | "all")} value={statusFilter}>
              <option value="all">Todos status</option>
              {workflowColumns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
            </TaskSelect>
            <TaskSelect label="Prioridade" onChange={(value) => setPriorityFilter(value as TaskPriority | "all")} value={priorityFilter}>
              <option value="all">Todas</option>
              {Object.entries(priorityLabels).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </TaskSelect>
            <TaskSelect label="Lead" onChange={setLeadFilter} value={leadFilter}>
              <option value="all">Todos leads</option>
              <option value="with_lead">Com lead</option>
              <option value="without_lead">Sem lead</option>
              {sortedLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
            </TaskSelect>
            <TaskSelect label="Ordenar" onChange={(value) => setSortMode(value as TaskSortMode)} value={sortMode}>
              <option value="due">Vencimento</option>
              <option value="priority">Prioridade</option>
              <option value="status">Status</option>
              <option value="owner">Responsável</option>
            </TaskSelect>
            <TaskSelect label="Agrupar" onChange={(value) => setGroupMode(value as TaskGroupMode)} value={groupMode}>
              <option value="none">Sem grupo</option>
              <option value="status">Por status</option>
              <option value="owner">Por responsável</option>
              <option value="lead">Por lead</option>
            </TaskSelect>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-400">{selectedIds.size} selecionada(s)</span>
            <button
              className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-50"
              disabled={selectedRows.length === 0}
              onClick={() => bulkReschedule(1)}
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
              Reagendar amanhã
            </button>
          </div>
        </div>

        {viewMode === "list" && (
          <TaskListView
            groupMode={groupMode}
            onCompleteTask={onCompleteTask}
            onDelete={(row) => setDeleteTarget(row)}
            onEdit={(row) => setTaskEditor({ task: row.task, lead: row.lead })}
            onOpenDetails={setTaskDetails}
            onOpenLead={onOpenLead}
            onRescheduleTask={onRescheduleTask}
            onSelect={toggleTaskSelection}
            rows={rows}
            selectedIds={selectedIds}
          />
        )}
        {viewMode === "board" && (
          <TaskBoardView
            draggingTaskId={draggingTaskId}
            onCreateInColumn={(workflowStatus) => setTaskEditor({ lead: null, draft: { workflow_status: workflowStatus } })}
            onDragStart={setDraggingTaskId}
            onDrop={(workflowStatus) => {
              const row = rows.find((item) => item.task.id === draggingTaskId);
              if (row) moveTask(row.task, row.lead, workflowStatus);
              setDraggingTaskId(null);
            }}
            onEdit={(row) => setTaskEditor({ task: row.task, lead: row.lead })}
            onOpenDetails={setTaskDetails}
            rows={rows}
          />
        )}
        {viewMode === "calendar" && (
          <TaskCalendarView onOpenDetails={setTaskDetails} rows={rows} />
        )}
      </section>

      <AgendaSections
        agendaRows={agendaRows}
        googleEvents={googleEvents}
        googleEventsFeedback={googleEventsFeedback}
        googleEventsLoading={googleEventsLoading}
        onCreateGoogleEvent={() => setGoogleEventEditor("new")}
        onCreateTask={onCreateTask}
        onDeleteGoogleEvent={setGoogleEventDeleteTarget}
        onEditGoogleEvent={setGoogleEventEditor}
        onOpenLead={onOpenLead}
        onRefreshGoogleEvents={() => void refreshGoogleEvents()}
        onScheduleLeadFollowup={onScheduleLeadFollowup}
        onTaskFromGoogle={(event) =>
          setTaskEditor({
            lead: null,
            draft: {
              lead_id: null,
              type: "meeting",
              title: event.title,
              notes: event.description ?? "Criado a partir da Agenda Google",
              priority: "medium",
              workflow_status: "todo",
              due_at: event.startsAt ?? new Date().toISOString(),
            },
          })
        }
      />

      {taskDetails && (
        <TaskDetailsDrawer
          onClose={() => setTaskDetails(null)}
          onCompleteTask={onCompleteTask}
          onDelete={(row) => setDeleteTarget(row)}
          onEdit={(row) => setTaskEditor({ task: row.task, lead: row.lead })}
          onOpenGoogle={(row) =>
            openGoogleCalendarEvent({
              title: row.task.title,
              startsAt: row.task.due_at,
              details: stripTaskMetadata(row.task.notes),
              lead: row.lead,
            })
          }
          onOpenLead={onOpenLead}
          row={taskDetails}
        />
      )}

      {taskEditor && (
        <TaskEditorModal
          draft={taskEditor.draft}
          leads={sortedLeads}
          onClose={() => setTaskEditor(null)}
          onSave={saveTask}
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

function TaskSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-black/25 px-3 pr-8 text-sm text-zinc-200 outline-none transition focus:border-[#8B5CF6]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-500" />
    </label>
  );
}

function TaskListView({
  rows,
  groupMode,
  selectedIds,
  onSelect,
  onOpenDetails,
  onOpenLead,
  onCompleteTask,
  onRescheduleTask,
  onEdit,
  onDelete,
}: {
  rows: TaskRow[];
  groupMode: TaskGroupMode;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpenDetails: (row: TaskRow) => void;
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onRescheduleTask: (task: Task, lead: Lead | null, dueAt: string) => void;
  onEdit: (row: TaskRow) => void;
  onDelete: (row: TaskRow) => void;
}) {
  const groups = groupRows(rows, groupMode);
  if (rows.length === 0) return <EmptyTaskState text="Nenhuma tarefa encontrada para este filtro." />;

  return (
    <div className="max-h-[44rem] overflow-y-auto">
      {groups.map((group) => (
        <div className="border-b border-white/10" key={group.label}>
          {groupMode !== "none" && (
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[#101018]/95 px-4 py-2 text-xs uppercase tracking-wide text-zinc-500 backdrop-blur">
              <span>{group.label}</span>
              <span>{group.rows.length}</span>
            </div>
          )}
          <div className="divide-y divide-white/10">
            {group.rows.map((row) => (
              <TaskRowItem
                key={row.task.id}
                onCompleteTask={onCompleteTask}
                onDelete={onDelete}
                onEdit={onEdit}
                onOpenDetails={onOpenDetails}
                onOpenLead={onOpenLead}
                onRescheduleTask={onRescheduleTask}
                onSelect={onSelect}
                row={row}
                selected={selectedIds.has(row.task.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskRowItem({
  row,
  selected,
  onSelect,
  onOpenDetails,
  onOpenLead,
  onCompleteTask,
  onRescheduleTask,
  onEdit,
  onDelete,
}: {
  row: TaskRow;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpenDetails: (row: TaskRow) => void;
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onRescheduleTask: (task: Task, lead: Lead | null, dueAt: string) => void;
  onEdit: (row: TaskRow) => void;
  onDelete: (row: TaskRow) => void;
}) {
  const { task, lead } = row;
  const due = getDueAtLabel(task.due_at);
  const repeat = getTaskRepeat(task);
  const priority = normalizePriority(task);
  const workflowStatus = normalizeWorkflowStatus(task);
  const workflow = workflowColumns.find((column) => column.id === workflowStatus);
  const notes = stripTaskMetadata(task.notes);
  const completed = task.status === "completed" || workflowStatus === "completed";

  return (
    <div className={`grid gap-3 px-4 py-3 transition hover:bg-white/[0.04] lg:grid-cols-[auto_1.4fr_0.8fr_0.75fr_0.8fr_auto] lg:items-center ${completed ? "opacity-60" : ""}`}>
      <input
        checked={selected}
        className="mt-1 h-4 w-4 accent-[#8B5CF6] lg:mt-0"
        onChange={() => onSelect(task.id)}
        type="checkbox"
      />
      <button className="min-w-0 text-left" onClick={() => onOpenDetails(row)} type="button">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-100">{task.title}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityLabels[priority].tone}`}>{priorityLabels[priority].label}</span>
          {isTaskOverdue(task) && task.status === "open" && <span className="rounded-full border border-red-400/25 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200">Atrasada</span>}
        </div>
        {notes && <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{notes}</p>}
      </button>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-300">{workflow?.label ?? "A fazer"}</span>
        <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-400">{taskTypeLabel(task.type)}</span>
      </div>
      <div>
        <div className={`text-sm ${due.tone}`}>{due.text}</div>
        {repeat !== "none" && <div className="mt-1 text-xs text-amber-200">Repete {taskRepeatLabel(repeat).toLowerCase()}</div>}
      </div>
      <div className="min-w-0">
        {lead ? (
          <button className="truncate text-left text-sm text-zinc-300 hover:text-white" onClick={() => onOpenLead(lead)} type="button">
            {lead.name}
          </button>
        ) : (
          <span className="text-sm text-zinc-500">Sem lead</span>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
          <UserRound className="h-3.5 w-3.5" />
          {lead?.owner_name || "Sem responsável"}
        </div>
      </div>
      <TaskQuickActions onCompleteTask={onCompleteTask} onDelete={onDelete} onEdit={onEdit} onRescheduleTask={onRescheduleTask} row={row} />
    </div>
  );
}

function TaskQuickActions({
  row,
  onCompleteTask,
  onRescheduleTask,
  onEdit,
  onDelete,
}: {
  row: TaskRow;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onRescheduleTask: (task: Task, lead: Lead | null, dueAt: string) => void;
  onEdit: (row: TaskRow) => void;
  onDelete: (row: TaskRow) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      {row.task.status === "open" && (
        <>
          <button className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20" onClick={() => onRescheduleTask(row.task, row.lead, addDays(1))} type="button">
            Amanhã
          </button>
          <button className="flex h-9 items-center gap-1 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20" onClick={() => onCompleteTask(row.task, row.lead)} type="button">
            <Check className="h-3.5 w-3.5" />
            Concluir
          </button>
        </>
      )}
      <button className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]" onClick={() => onEdit(row)} type="button">
        <Edit3 className="h-3.5 w-3.5" />
        Editar
      </button>
      <button className="flex h-9 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs text-red-200 transition hover:bg-red-500/20" onClick={() => onDelete(row)} type="button">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TaskBoardView({
  rows,
  draggingTaskId,
  onDragStart,
  onDrop,
  onCreateInColumn,
  onOpenDetails,
  onEdit,
}: {
  rows: TaskRow[];
  draggingTaskId: string | null;
  onDragStart: (taskId: string | null) => void;
  onDrop: (workflowStatus: TaskWorkflowStatus) => void;
  onCreateInColumn: (workflowStatus: TaskWorkflowStatus) => void;
  onOpenDetails: (row: TaskRow) => void;
  onEdit: (row: TaskRow) => void;
}) {
  return (
    <div className="grid min-h-[34rem] gap-3 overflow-x-auto p-4 xl:grid-cols-6">
      {workflowColumns.map((column) => {
        const columnRows = rows.filter(({ task }) => normalizeWorkflowStatus(task) === column.id);
        return (
          <div
            className={`min-w-64 rounded-lg border border-white/10 bg-black/20 transition ${draggingTaskId ? "ring-1 ring-[#8B5CF6]/30" : ""}`}
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(column.id)}
          >
            <div className="border-b border-white/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-100">{column.label}</h3>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{columnRows.length}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{column.helper}</p>
            </div>
            <div className="space-y-3 p-3">
              <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 text-xs text-zinc-400 transition hover:border-[#8B5CF6]/40 hover:text-zinc-100" onClick={() => onCreateInColumn(column.id)} type="button">
                <Plus className="h-4 w-4" />
                Criar nesta coluna
              </button>
              {columnRows.length === 0 && <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-600">Sem tarefas</div>}
              {columnRows.map((row) => (
                <TaskBoardCard key={row.task.id} onDragStart={onDragStart} onEdit={onEdit} onOpenDetails={onOpenDetails} row={row} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskBoardCard({
  row,
  onDragStart,
  onOpenDetails,
  onEdit,
}: {
  row: TaskRow;
  onDragStart: (taskId: string | null) => void;
  onOpenDetails: (row: TaskRow) => void;
  onEdit: (row: TaskRow) => void;
}) {
  const priority = normalizePriority(row.task);
  const due = getDueAtLabel(row.task.due_at);
  return (
    <div
      className="cursor-grab rounded-lg border border-white/10 bg-[#12121A] p-3 shadow-lg shadow-black/15 transition hover:border-[#8B5CF6]/35 hover:bg-[#151522]"
      draggable
      onDragEnd={() => onDragStart(null)}
      onDragStart={() => onDragStart(row.task.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <button className="min-w-0 text-left" onClick={() => onOpenDetails(row)} type="button">
          <div className="font-medium text-zinc-100">{row.task.title}</div>
          <div className="mt-1 text-xs text-zinc-500">{row.lead?.name ?? "Operacional"}</div>
        </button>
        <GripVertical className="h-4 w-4 shrink-0 text-zinc-600" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityLabels[priority].tone}`}>{priorityLabels[priority].label}</span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">{taskTypeLabel(row.task.type)}</span>
      </div>
      <div className={`mt-3 flex items-center gap-1 text-xs ${due.tone}`}>
        <Clock3 className="h-3.5 w-3.5" />
        {due.text}
      </div>
      <button className="mt-3 text-xs text-zinc-500 hover:text-zinc-200" onClick={() => onEdit(row)} type="button">Editar tarefa</button>
    </div>
  );
}

function TaskCalendarView({ rows, onOpenDetails }: { rows: TaskRow[]; onOpenDetails: (row: TaskRow) => void }) {
  const days = useMemo(() => {
    const first = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, []);

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-7">
      {days.map((day) => {
        const dayRows = rows.filter(({ task }) => isTaskDueOnDate(task, day));
        return (
          <div className="min-h-40 rounded-lg border border-white/10 bg-black/20 p-3" key={day.toISOString()}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{day.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
                <div className="text-xs text-zinc-500">{day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-300">{dayRows.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {dayRows.length === 0 && <div className="text-xs text-zinc-600">Sem tarefas</div>}
              {dayRows.map((row) => (
                <button className="w-full rounded-lg border border-white/10 bg-white/[0.035] p-2 text-left text-xs transition hover:border-[#8B5CF6]/35 hover:bg-[#8B5CF6]/10" key={row.task.id} onClick={() => onOpenDetails(row)} type="button">
                  <div className="font-medium text-zinc-100">{row.task.title}</div>
                  <div className="mt-1 text-zinc-500">{new Date(row.task.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaSections({
  agendaRows,
  googleEvents,
  googleEventsLoading,
  googleEventsFeedback,
  onOpenLead,
  onScheduleLeadFollowup,
  onCreateTask,
  onRefreshGoogleEvents,
  onCreateGoogleEvent,
  onEditGoogleEvent,
  onDeleteGoogleEvent,
  onTaskFromGoogle,
}: {
  agendaRows: Lead[];
  googleEvents: GoogleCalendarEvent[];
  googleEventsLoading: boolean;
  googleEventsFeedback: string;
  onOpenLead: (lead: Lead) => void;
  onScheduleLeadFollowup: (lead: Lead, dueAt: string) => void;
  onCreateTask: (lead: Lead | null, input: TaskInput) => void;
  onRefreshGoogleEvents: () => void;
  onCreateGoogleEvent: () => void;
  onEditGoogleEvent: (event: GoogleCalendarEvent) => void;
  onDeleteGoogleEvent: (event: GoogleCalendarEvent) => void;
  onTaskFromGoogle: (event: GoogleCalendarEvent) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Agenda comercial</h2>
            <p className="mt-1 text-sm text-zinc-500">Follow-ups salvos nos leads do CRM.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{agendaRows.length} agendamento(s)</span>
        </div>
        <div className="mt-4 max-h-[26rem] divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
          {agendaRows.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">Nenhum agendamento encontrado para este filtro.</div>
          ) : agendaRows.map((lead) => {
            const due = getDueAtLabel(lead.next_followup_at ?? "");
            return (
              <div className="grid gap-3 bg-black/20 p-4 lg:grid-cols-[1fr_auto] lg:items-center" key={lead.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-2 py-0.5 text-[11px] text-[#9AF0B8]">Agenda CRM</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${getTemperatureLabel(lead.temperature).tone}`}>{getTemperatureLabel(lead.temperature).text}</span>
                    <span className="font-medium text-zinc-100">{lead.name}</span>
                  </div>
                  <div className={`mt-2 text-sm ${due.tone}`}>{due.text}</div>
                  <div className="mt-1 text-xs text-zinc-500">{lead.owner_name || "Sem responsável"}</div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button className="h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]" onClick={() => onOpenLead(lead)} type="button">Abrir</button>
                  <button className="h-9 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-3 text-xs text-[#DDD6FE] transition hover:bg-[#8B5CF6]/20" onClick={() => onScheduleLeadFollowup(lead, addDays(1))} type="button">Reagendar</button>
                  <button
                    className="h-9 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20"
                    onClick={() => onCreateTask(lead, { lead_id: lead.id, type: "followup", title: `Follow-up com ${lead.name}`, notes: "Criado a partir da agenda comercial", priority: "medium", workflow_status: "todo", due_at: lead.next_followup_at ?? addDays(1) })}
                    type="button"
                  >
                    Criar tarefa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Agenda Google</h2>
            <p className="mt-1 text-sm text-zinc-500">Eventos conectados, reuniões e tarefas convertidas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="flex h-9 items-center gap-2 rounded-lg bg-[#8B5CF6] px-3 text-xs font-semibold text-white transition hover:bg-[#7C3AED]" onClick={onCreateGoogleEvent} type="button"><Plus className="h-4 w-4" />Criar evento</button>
            <button className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]" disabled={googleEventsLoading} onClick={onRefreshGoogleEvents} type="button">
              {googleEventsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-[26rem] divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
          {googleEventsLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin text-[#8B5CF6]" />Carregando eventos...</div>
          ) : googleEvents.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">{googleEventsFeedback || "Nenhum evento futuro encontrado na agenda conectada."}</div>
          ) : googleEvents.map((event) => (
            <div className="grid gap-3 bg-black/20 p-4 lg:grid-cols-[1fr_auto] lg:items-center" key={event.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 px-2 py-0.5 text-[11px] text-[#DDD6FE]">Google Calendar</span>
                  <span className="font-medium text-zinc-100">{event.title}</span>
                </div>
                <div className="mt-2 text-sm text-zinc-400">{event.startsAt ? new Date(event.startsAt).toLocaleString("pt-BR") : "Sem data"}</div>
                {event.description && <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{event.description}</div>}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {event.hangoutLink && <a className="flex h-9 items-center gap-1 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8]" href={event.hangoutLink} rel="noreferrer" target="_blank"><ExternalLink className="h-3.5 w-3.5" />Meet</a>}
                {event.htmlLink && <a className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300" href={event.htmlLink} rel="noreferrer" target="_blank"><ExternalLink className="h-3.5 w-3.5" />Google</a>}
                <button className="flex h-9 items-center gap-1 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8]" onClick={() => onTaskFromGoogle(event)} type="button"><Plus className="h-3.5 w-3.5" />Tarefa</button>
                <button className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-zinc-300" onClick={() => onEditGoogleEvent(event)} type="button"><Edit3 className="h-3.5 w-3.5" />Editar</button>
                <button className="flex h-9 items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-xs text-red-200" onClick={() => onDeleteGoogleEvent(event)} type="button"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TaskDetailsDrawer({
  row,
  onClose,
  onOpenLead,
  onCompleteTask,
  onEdit,
  onDelete,
  onOpenGoogle,
}: {
  row: TaskRow;
  onClose: () => void;
  onOpenLead: (lead: Lead) => void;
  onCompleteTask: (task: Task, lead: Lead | null) => void;
  onEdit: (row: TaskRow) => void;
  onDelete: (row: TaskRow) => void;
  onOpenGoogle: (row: TaskRow) => void;
}) {
  const priority = normalizePriority(row.task);
  const workflowStatus = normalizeWorkflowStatus(row.task);
  const workflow = workflowColumns.find((column) => column.id === workflowStatus);
  const notes = stripTaskMetadata(row.task.notes);
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-[#8B5CF6]/25 bg-[#0F0F16]/95 p-5 text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-[#C4B5FD]">Detalhes da tarefa</div>
          <h2 className="mt-2 text-2xl font-semibold">{row.task.title}</h2>
        </div>
        <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white" onClick={onClose} type="button">Fechar</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TaskDetailMetric label="Status" value={workflow?.label ?? "A fazer"} />
        <TaskDetailMetric label="Prioridade" value={priorityLabels[priority].label} />
        <TaskDetailMetric label="Tipo" value={taskTypeLabel(row.task.type)} />
        <TaskDetailMetric label="Vencimento" value={getDueAtLabel(row.task.due_at).text} />
        <TaskDetailMetric label="Início" value={formatDate(row.task.start_at)} />
        <TaskDetailMetric label="Responsável" value={row.lead?.owner_name || "Sem responsável"} />
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <h3 className="font-semibold">Relacionamento</h3>
        {row.lead ? (
          <button className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#8B5CF6]/35" onClick={() => onOpenLead(row.lead!)} type="button">
            <div className="font-medium">{row.lead.name}</div>
            <div className="mt-1 text-sm text-zinc-500">{row.lead.company || "Sem empresa"} - {row.lead.phone}</div>
          </button>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Tarefa operacional sem lead vinculado.</p>
        )}
      </div>
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
        <h3 className="font-semibold">Descrição</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{notes || "Sem descrição registrada."}</p>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-[#25D366]" /> Checklist</div>
          <p className="mt-2 text-sm text-zinc-500">Estrutura de checklist pronta na migration. A edição por item entra na próxima iteração sem alterar o contrato principal.</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-[#C4B5FD]" /> Comentários e atividade</div>
          <p className="mt-2 text-sm text-zinc-500">Comentários e histórico já têm tabelas preparadas para persistência.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
        <button className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 hover:bg-white/[0.06]" onClick={() => onOpenGoogle(row)} type="button">Google</button>
        <button className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 hover:bg-white/[0.06]" onClick={() => onEdit(row)} type="button">Editar</button>
        {row.task.status === "open" && <button className="h-10 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-4 text-sm text-[#9AF0B8]" onClick={() => onCompleteTask(row.task, row.lead)} type="button">Concluir</button>}
        <button className="h-10 rounded-lg border border-red-400/20 bg-red-500/10 px-4 text-sm text-red-200" onClick={() => onDelete(row)} type="button">Excluir</button>
      </div>
    </div>
  );
}

function TaskDetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function EmptyTaskState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-zinc-500">{text}</div>;
}

function groupRows(rows: TaskRow[], groupMode: TaskGroupMode) {
  if (groupMode === "none") return [{ label: "Todas", rows }];
  const groups = new Map<string, TaskRow[]>();
  for (const row of rows) {
    const label =
      groupMode === "status"
        ? workflowColumns.find((column) => column.id === normalizeWorkflowStatus(row.task))?.label ?? "A fazer"
        : groupMode === "owner"
          ? row.lead?.owner_name || "Sem responsável"
          : row.lead?.name || "Sem lead";
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([label, groupRows]) => ({ label, rows: groupRows }));
}
