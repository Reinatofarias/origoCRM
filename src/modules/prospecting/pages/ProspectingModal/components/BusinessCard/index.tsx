"use client";

import { MapPin, Phone, Star, TrendingUp } from "lucide-react";
import Image from "next/image";

import type { ProspectBusiness } from "../../../../types";
import { LeadActions } from "../LeadActions";

function signalClass(tone: string) {
  if (tone === "hot") return "border-red-400/25 bg-red-500/10 text-red-100";
  if (tone === "warning") return "border-amber-400/25 bg-amber-500/10 text-amber-100";
  if (tone === "positive") return "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]";
  return "border-white/10 bg-white/[0.05] text-zinc-300";
}

export function BusinessCard({
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
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-xl shadow-black/30 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-[#8B5CF6]/50 hover:shadow-[#8B5CF6]/20">
      <div className="relative h-32 overflow-hidden">
        <Image
          alt=""
          className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-95"
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          src={business.photoUrl ?? "https://images.unsplash.com/photo-1497366754035-f200968a6e72auto=format&fit=crop&w=600&q=80"}
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090D] via-[#09090D]/20 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-black/45 px-3 py-1 text-xs text-[#DDD6FE] backdrop-blur-md">
          <TrendingUp className="h-3.5 w-3.5" />
          Score {business.leadScore ?? 0}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-white">{business.name}</h3>
              <p className="mt-1 text-sm text-zinc-400">{business.category}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {business.rating.toFixed(1) ?? "-"}
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#A78BFA]" />
            <span>{business.state || business.city || "Estado não informado"}</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#25D366]/20 bg-[#25D366]/10 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase text-[#9AF0B8]">
            <Phone className="h-3.5 w-3.5" />
            Telefone capturado
          </div>
          <div className="mt-1 truncate text-base font-semibold text-white">{business.phone || "Não informado"}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase text-zinc-500">Estado</div>
            <div className="mt-1 truncate text-sm text-zinc-100">{business.state || "Não informado"}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase text-zinc-500">Cidade</div>
            <div className="mt-1 truncate text-sm text-zinc-100">{business.city || "Não informado"}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {business.signals.map((signal) => (
            <span className={`rounded-full border px-2 py-1 text-[11px] ${signalClass(signal.tone)}`} key={signal.id}>
              {signal.label}
            </span>
          ))}
        </div>
        <LeadActions
          business={business}
          isAdded={isAdded}
          onAddLead={onAddLead}
          onGenerateApproach={onGenerateApproach}
          onViewDetails={onViewDetails}
        />
      </div>
    </article>
  );
}
