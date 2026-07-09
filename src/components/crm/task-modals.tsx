"use client";

import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  buildTaskNotes,
  fromDateTimeLocal,
  getTaskRepeat,
  stripTaskMetadata,
  toDateTimeLocal,
  type TaskRepeat,
} from "@/components/crm/lead-helpers";
import { Input, Modal } from "@/components/crm/ui";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventDraft,
  TaskPriority,
  TaskInput,
  TaskWorkflowStatus,
} from "@/components/crm/tasks-types";
import type { Lead, Task } from "@/lib/types";

export function TaskEditorModal({
  leads,
  task,
  draft,
  onClose,
  onSave,
}: {
  leads: Lead[];
  task?: Task | null;
  draft?: Partial<TaskInput>;
  onClose: () => void;
  onSave: (input: TaskInput) => void;
}) {
  const [leadId, setLeadId] = useState(task?.lead_id ?? draft?.lead_id ?? "");
  const [type, setType] = useState<Task["type"]>(task?.type ?? draft?.type ?? "other");
  const [title, setTitle] = useState(task?.title ?? draft?.title ?? "");
  const [notes, setNotes] = useState(stripTaskMetadata(task?.notes ?? draft?.notes ?? null));
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? draft?.priority ?? "medium");
  const [workflowStatus, setWorkflowStatus] = useState<TaskWorkflowStatus>(
    task?.workflow_status ?? draft?.workflow_status ?? "todo",
  );
  const [startAt, setStartAt] = useState(toDateTimeLocal(task?.start_at ?? draft?.start_at ?? ""));
  const [dueAt, setDueAt] = useState(toDateTimeLocal(task?.due_at ?? draft?.due_at ?? new Date().toISOString()));
  const [repeat, setRepeat] = useState<TaskRepeat>(task ? getTaskRepeat(task) : "none");

  return (
    <Modal onClose={onClose} title={task ? "Editar tarefa" : "Criar nova tarefa"}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onSave({
            lead_id: leadId || null,
            type,
            title: title.trim(),
            notes: buildTaskNotes(notes, repeat),
            priority,
            workflow_status: workflowStatus,
            start_at: startAt ? fromDateTimeLocal(startAt) : null,
            position: task?.position ?? draft?.position ?? 0,
            due_at: fromDateTimeLocal(dueAt),
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Título" onChange={setTitle} required value={title} />
          <label className="block text-sm text-zinc-300">
            Status
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setWorkflowStatus(event.target.value as TaskWorkflowStatus)}
              value={workflowStatus}
            >
              <option value="todo">A fazer</option>
              <option value="in_progress">Em andamento</option>
              <option value="waiting">Aguardando</option>
              <option value="review">Em revisão</option>
              <option value="blocked">Bloqueado</option>
              <option value="completed">Concluído</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Tipo
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setType(event.target.value as Task["type"])}
              value={type}
            >
              <option value="other">Operacional</option>
              <option value="followup">Follow-up</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="call">Ligação</option>
              <option value="email">Email</option>
              <option value="meeting">Reunião</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Prioridade
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              value={priority}
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Lead vinculado
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setLeadId(event.target.value)}
              value={leadId}
            >
              <option value="">Sem lead</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Início
            <input
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setStartAt(event.target.value)}
              type="datetime-local"
              value={startAt}
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Quando
            <input
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setDueAt(event.target.value)}
              required
              type="datetime-local"
              value={dueAt}
            />
          </label>
          <label className="block text-sm text-zinc-300 sm:col-span-2">
            Repetir
            <select
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(event) => setRepeat(event.target.value as TaskRepeat)}
              value={repeat}
            >
              <option value="none">Não repetir</option>
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensalmente</option>
            </select>
          </label>
        </div>
        <label className="block text-sm text-zinc-300">
          Observação
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Detalhe o que precisa ser feito, contexto ou critério de conclusão"
            value={notes}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED]">
            <Save className="h-4 w-4" />
            Salvar tarefa
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function GoogleEventEditorModal({
  event,
  loading,
  onClose,
  onSave,
}: {
  event?: GoogleCalendarEvent;
  loading: boolean;
  onClose: () => void;
  onSave: (input: GoogleCalendarEventDraft) => void;
}) {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const defaultEnd = new Date(now);
  defaultEnd.setMinutes(defaultEnd.getMinutes() + 30);

  const [form, setForm] = useState<GoogleCalendarEventDraft>(() => ({
    title: event?.title ?? "",
    description: event?.description ?? "",
    startsAt: toDateTimeLocal(event?.startsAt ?? now.toISOString()),
    endsAt: toDateTimeLocal(event?.endsAt ?? defaultEnd.toISOString()),
    location: event?.location ?? "",
    attendees: "",
    createMeet: Boolean(event?.hangoutLink),
  }));

  function updateField<K extends keyof GoogleCalendarEventDraft>(key: K, value: GoogleCalendarEventDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal onClose={onClose} title={event ? "Editar evento Google" : "Criar evento Google"}>
      <form
        className="space-y-4"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (!form.title.trim()) return;
          onSave(form);
        }}
      >
        <Input label="Título" onChange={(value) => updateField("title", value)} required value={form.title} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-300">
            Início
            <input
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(inputEvent) => updateField("startsAt", inputEvent.target.value)}
              required
              type="datetime-local"
              value={form.startsAt}
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Fim
            <input
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-[#8B5CF6]"
              onChange={(inputEvent) => updateField("endsAt", inputEvent.target.value)}
              required
              type="datetime-local"
              value={form.endsAt}
            />
          </label>
        </div>
        <Input label="Local ou link externo" onChange={(value) => updateField("location", value)} value={form.location} />
        <label className="flex items-start gap-3 rounded-lg border border-[#25D366]/20 bg-[#25D366]/10 p-3 text-sm text-zinc-200">
          <input
            checked={form.createMeet}
            className="mt-1 h-4 w-4 accent-[#25D366]"
            onChange={(inputEvent) => updateField("createMeet", inputEvent.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-medium text-[#9AF0B8]">Criar chamada Google Meet</span>
            <span className="mt-1 block text-xs text-zinc-400">
              O Google gera o link da reunião e envia junto no convite quando houver convidados.
            </span>
          </span>
        </label>
        <label className="block text-sm text-zinc-300">
          Convidados
          <textarea
            className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
            onChange={(inputEvent) => updateField("attendees", inputEvent.target.value)}
            placeholder="email@empresa.com, outro@empresa.com"
            value={form.attendees}
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Descrição
          <textarea
            className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
            onChange={(inputEvent) => updateField("description", inputEvent.target.value)}
            placeholder="Contexto, pauta, objetivo da reunião ou observações."
            value={form.description}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#8B5CF6] px-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED] disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {event ? "Salvar evento" : "Criar evento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmDeleteGoogleEvent({
  event,
  loading,
  onCancel,
  onConfirm,
}: {
  event: GoogleCalendarEvent;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title="Excluir evento Google">
      <div className="space-y-4">
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
            <div>
              <p className="font-medium text-red-100">Excluir {event.title}</p>
              <p className="mt-1 text-sm text-red-200/80">
                O evento será removido da agenda Google conectada. Convidados podem receber atualização de cancelamento.
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
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:opacity-60"
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir evento
          </button>
        </div>
      </div>
    </Modal>
  );
}
