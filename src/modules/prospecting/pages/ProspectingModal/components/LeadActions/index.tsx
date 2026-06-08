"use client";

import { Bot, ExternalLink, MessageCircle, Plus, SlidersHorizontal } from "lucide-react";

import type { ProspectBusiness } from "../../../../types";

export function LeadActions({
  business,
  isAdded,
  onAddLead,
  onGenerateApproach,
  onViewDetails,
}: {
  business: ProspectBusiness;
  isAdded: boolean;
  onAddLead: () => void;
  onGenerateApproach: () => void;
  onViewDetails: () => void;
}) {
  const phone = business.phone.replace(/\D/g, "");

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <a
        className={`flex h-10 items-center justify-center gap-2 rounded-xl border border-[#25D366]/25 bg-[#25D366]/10 px-3 text-xs font-medium text-[#9AF0B8] transition hover:bg-[#25D366]/20 ${!phone ? "pointer-events-none opacity-50" : ""}`}
        href={phone ? `https://wa.me/55${phone}` : "#"}
        rel="noreferrer"
        target="_blank"
      >
        <MessageCircle className="h-4 w-4" />
        Abrir WhatsApp
      </a>
      <button
        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#8B5CF6] px-3 text-xs font-semibold text-white shadow-lg shadow-[#8B5CF6]/20 transition hover:bg-[#7C3AED] disabled:opacity-60"
        disabled={isAdded}
        onClick={onAddLead}
        type="button"
      >
        <Plus className="h-4 w-4" />
        {isAdded ? "Adicionado" : "Adicionar Pipeline"}
      </button>
      <button
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-200 transition hover:bg-white/[0.08]"
        onClick={onGenerateApproach}
        type="button"
      >
        <Bot className="h-4 w-4" />
        Gerar abordagem IA
      </button>
      <button
        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-200 transition hover:bg-white/[0.08]"
        onClick={onViewDetails}
        type="button"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Ver detalhes
      </button>
      {business.googleMapsUrl && (
        <a
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 sm:col-span-2"
          href={business.googleMapsUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir Google Maps
        </a>
      )}
    </div>
  );
}
