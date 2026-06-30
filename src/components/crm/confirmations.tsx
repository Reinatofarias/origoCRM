import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/crm/ui";
import type { Lead, MessageTemplate, Task } from "@/lib/types";

export function ConfirmDeleteLead({
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
              <p className="font-medium text-red-100">Esta ação remove o lead da base.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                O lead {lead.name}, suas tarefas e interações serão apagadas. O histórico de
                WhatsApp será preservado desvinculado.
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

export function ConfirmDeleteTemplate({
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
              <p className="font-medium text-red-100">A mensagem pronta será removida.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                {template.title} deixará de aparecer nas seleções de atendimento e follow-up.
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

export function ConfirmDeleteTask({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel} title="Excluir tarefa">
      <div className="space-y-4">
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <p className="font-medium text-red-100">Esta tarefa será removida.</p>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                {task.title} deixará de aparecer no Dashboard, em Tarefas e no lead vinculado.
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
            Excluir tarefa
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CloseLeadModal({
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
            placeholder={`Ex.: ${lead.name} fechou com outro fornecedor, sem budget agora, ou venda concluída.`}
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
