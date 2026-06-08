"use client";

import { DashboardCompactMetric, DashboardEmpty } from "@/components/crm/dashboard-widgets";
import type { WhatsAppLog, WhatsAppMessage } from "@/lib/types";

export function DashboardWhatsAppHealth({
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
    phoneNumber: string | null;
    profileName: string | null;
    error: string;
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
          <h2 className="text-lg font-semibold">Saúde do WhatsApp</h2>
          <p className="mt-1 text-sm text-zinc-500">Status da Evolution, inbox e últimas entradas.</p>
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
          Último webhook:{" "}
          {lastWebhook ? new Date(lastWebhook.created_at).toLocaleString("pt-BR") : "sem registro"}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <DashboardCompactMetric label="Não lidas" value={unreadConversations} />
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
