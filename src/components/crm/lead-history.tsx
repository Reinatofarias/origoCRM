"use client";

import type { Interaction, WhatsAppMessage } from "@/lib/types";

export function LeadHistory({
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
        emptyText="Nenhuma interação manual registrada."
        interactions={operationalInteractions}
        title="Interações"
      />
      <WhatsAppHistory interactions={whatsappInteractions} messages={whatsappMessages} />
      <Timeline
        emptyText="Nenhuma mudança comercial registrada."
        interactions={commercialChanges}
        title="Mudanças comerciais"
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
  title = "Histórico comercial",
  emptyText = "Nenhuma interação registrada. Use notas objetivas para manter contexto, combinados e próximos passos do lead.",
}: {
  interactions: Interaction[];
  title: string;
  emptyText: string;
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

export function timelineTitle(interaction: Interaction) {
  if (interaction.type === "whatsapp_sent") return "Mensagem enviada";
  if (interaction.type === "status_changed") return "Mudança de status";
  if (interaction.type === "followup_created") return "Follow-up criado";
  return "Interação registrada";
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
  if (channel === "call") return "Ligação";
  if (channel === "email") return "Email";
  if (channel === "other") return "Outro";
  return "WhatsApp";
}
