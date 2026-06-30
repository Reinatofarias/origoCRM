"use client";

import { Bot, Building2, Globe2, MapPin, Phone, Star } from "lucide-react";
import type { ComponentType } from "react";

import type { ProspectBusiness } from "../../../../types";

export function BusinessDetails({
  approach,
  business,
  onGenerateApproach,
}: {
  approach: string;
  business: ProspectBusiness | null;
  onGenerateApproach: (business: ProspectBusiness) => void;
}) {
  if (!business) {
    return (
      <aside className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 text-sm text-zinc-500 backdrop-blur-xl">
        Selecione uma empresa para ver enriquecimento, sinais e abordagem sugerida.
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-[#8B5CF6]/25 bg-white/[0.055] p-5 shadow-2xl shadow-[#8B5CF6]/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{business.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">{business.category}</p>
        </div>
        <div className="rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3 py-1 text-sm text-[#DDD6FE]">
          {business.leadScore ?? 0}/100
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        <DetailRow icon={Phone} label="Telefone" value={business.phone || "Não informado"} />
        <DetailRow icon={Globe2} label="Website" value={business.website || "Empresa sem site"} />
        <DetailRow icon={MapPin} label="Endereço" value={business.address || "Não informado"} />
        <DetailRow icon={Star} label="Google" value={`${business.rating ?? "-"} estrelas · ${business.reviewsCount ?? 0} reviews`} />
        <DetailRow icon={Building2} label="Status" value={business.businessStatus ?? "operational"} />
      </div>
      <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase text-zinc-500">Abordagem IA</div>
          {onGenerateApproach && (
            <button
              className="flex h-8 items-center gap-2 rounded-lg border border-white/10 px-2 text-xs text-zinc-200 transition hover:bg-white/[0.06]"
              onClick={() => onGenerateApproach(business)}
              type="button"
            >
              <Bot className="h-3.5 w-3.5" />
              Gerar
            </button>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-200">
          {approach || "Clique em Gerar para criar uma mensagem consultiva para este contato."}
        </p>
      </div>
    </aside>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#A78BFA]" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase text-zinc-500">{label}</div>
        <div className="mt-1 break-words text-sm text-zinc-100">{value}</div>
      </div>
    </div>
  );
}
