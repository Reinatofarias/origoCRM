"use client";

import { CheckCircle2, Loader2, MessageCircle, PauseCircle, Send, ShieldCheck, Trash2 } from "lucide-react";

import type { MessageTemplate } from "@/lib/types";

import type { ProspectingDispatchState } from "../../../../types";

export function CampaignPanel({
  dispatchStates,
  intervalSeconds,
  isValidatingWhatsApp,
  isRunning,
  onClearSelection,
  onIgnoreSelected,
  onIntervalChange,
  onSelectPhoneProspects,
  onStartCampaign,
  onTemplateChange,
  onToggleOnlyWhatsApp,
  onValidateWhatsApp,
  previewMessage,
  selectedCount,
  selectedTemplateId,
  sendableCount,
  templates,
  onlyWhatsApp,
  validWhatsAppCount,
}: {
  dispatchStates: Record<string, ProspectingDispatchState>;
  intervalSeconds: number;
  isValidatingWhatsApp: boolean;
  isRunning: boolean;
  onClearSelection: () => void;
  onIgnoreSelected: () => void;
  onIntervalChange: (value: number) => void;
  onSelectPhoneProspects: () => void;
  onStartCampaign: () => void;
  onTemplateChange: (templateId: string) => void;
  onToggleOnlyWhatsApp: () => void;
  onValidateWhatsApp: () => void;
  previewMessage: string;
  selectedCount: number;
  selectedTemplateId: string;
  sendableCount: number;
  templates: MessageTemplate[];
  onlyWhatsApp: boolean;
  validWhatsAppCount: number;
}) {
  const sent = Object.values(dispatchStates).filter((item) => item.status === "sent").length;
  const failed = Object.values(dispatchStates).filter((item) => item.status === "failed").length;
  const queued = Object.values(dispatchStates).filter((item) => item.status === "queued" || item.status === "sending").length;

  return (
    <aside className="rounded-2xl border border-[#25D366]/20 bg-[#07130D]/80 p-5 shadow-2xl shadow-[#25D366]/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#9AF0B8]">
            <MessageCircle className="h-4 w-4" />
            Campanha WhatsApp
          </div>
          <h3 className="mt-2 text-lg font-semibold text-white">Disparo para prospects</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-400">Envia sem criar lead. Quem responder aparece em Conversas.</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-[#25D366]" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric label="Selecionados" value={selectedCount} />
        <Metric label="Enviaveis" value={sendableCount} />
        <Metric label="Enviados" value={sent} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Na fila" value={queued} />
        <Metric label="Falhas" value={failed} />
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase text-zinc-500">WhatsApp validado</div>
              <div className="mt-1 text-lg font-semibold text-white">{validWhatsAppCount}</div>
            </div>
            <button
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs text-[#9AF0B8] transition hover:bg-[#25D366]/20 disabled:opacity-50"
              disabled={isRunning || isValidatingWhatsApp || selectedCount === 0}
              onClick={onValidateWhatsApp}
              type="button"
            >
              {isValidatingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Validar selecionados
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
            <input
              checked={onlyWhatsApp}
              className="h-4 w-4 rounded border-white/20 bg-black accent-[#25D366]"
              onChange={onToggleOnlyWhatsApp}
              type="checkbox"
            />
            Mostrar apenas contatos com WhatsApp validado
          </label>
        </div>

        <label className="block text-sm text-zinc-300">
          Mensagem pronta
          <select
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-[#A78BFA]"
            disabled={templates.length === 0 || isRunning}
            onChange={(event) => onTemplateChange(event.target.value)}
            value={selectedTemplateId}
          >
            <option value="">Selecione uma mensagem</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-300">
          Intervalo entre envios
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-[#A78BFA]"
            disabled={isRunning}
            max={120}
            min={5}
            onChange={(event) => onIntervalChange(Number(event.target.value))}
            type="number"
            value={intervalSeconds}
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <div className="text-xs uppercase text-zinc-500">Previa</div>
          <p className="mt-2 max-h-40 overflow-y-auto text-sm leading-6 text-zinc-200">
            {previewMessage || "Selecione contatos e uma mensagem pronta para visualizar o disparo."}
          </p>
        </div>

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-black transition hover:bg-[#1FB85A] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRunning || sendableCount === 0 || !selectedTemplateId}
          onClick={onStartCampaign}
          type="button"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isRunning ? "Enviando campanha" : "Iniciar campanha"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
            disabled={isRunning}
            onClick={onSelectPhoneProspects}
            type="button"
          >
            <MessageCircle className="h-4 w-4" />
            Selecionar telefones
          </button>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
            disabled={isRunning || selectedCount === 0}
            onClick={onClearSelection}
            type="button"
          >
            <PauseCircle className="h-4 w-4" />
            Limpar
          </button>
          <button
            className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-xs text-red-200 transition hover:bg-red-500/20"
            disabled={isRunning || selectedCount === 0}
            onClick={onIgnoreSelected}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Ignorar selecionados
          </button>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-[11px] uppercase text-zinc-500">{label}</div>
    </div>
  );
}
