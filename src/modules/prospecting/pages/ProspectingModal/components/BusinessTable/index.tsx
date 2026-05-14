"use client";

import { CheckCircle2, ExternalLink, MessageCircle, Phone, Plus, Star, XCircle } from "lucide-react";

import type { ProspectBusiness, ProspectingDispatchState, ProspectingWhatsAppValidationState } from "../../../../types";
import { normalizeProspectingWhatsAppPhone } from "../../../../utils/phone";

function statusLabel(state?: ProspectingDispatchState, isAdded?: boolean, isDuplicate?: boolean, isSelected?: boolean) {
  if (isAdded) return { label: "Lead criado", className: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]" };
  if (isDuplicate) return { label: "Ja esta no CRM", className: "border-amber-400/25 bg-amber-500/10 text-amber-100" };
  if (isSelected && !state) return { label: "No lote", className: "border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#DDD6FE]" };
  if (!state) return { label: "Novo", className: "border-white/10 bg-white/[0.04] text-zinc-300" };
  if (state.status === "queued") return { label: "Na fila", className: "border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#DDD6FE]" };
  if (state.status === "sending") return { label: "Enviando", className: "border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#DDD6FE]" };
  if (state.status === "sent") return { label: "Enviado", className: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]" };
  if (state.status === "failed") return { label: "Falhou", className: "border-red-400/25 bg-red-500/10 text-red-200" };
  if (state.status === "ignored") return { label: "Ignorado", className: "border-zinc-500/25 bg-zinc-500/10 text-zinc-300" };
  if (state.status === "lead_added") return { label: "Lead criado", className: "border-[#25D366]/25 bg-[#25D366]/10 text-[#9AF0B8]" };
  return { label: "Novo", className: "border-white/10 bg-white/[0.04] text-zinc-300" };
}

function validationLabel(status: string) {
  if (status === "valid") return "WhatsApp validado";
  if (status === "invalid") return "Nao tem WhatsApp";
  if (status === "checking") return "Validando WhatsApp";
  if (status === "error") return "Erro na validacao";
  return "WhatsApp nao validado";
}

function validationClass(status: string) {
  if (status === "valid") return "text-[#9AF0B8]";
  if (status === "invalid" || status === "error") return "text-red-200";
  if (status === "checking") return "text-[#DDD6FE]";
  return "text-zinc-500";
}

export function BusinessTable({
  addedLeadIds,
  businesses,
  dispatchStates,
  existingLeadPhones,
  onlyWhatsApp,
  onAddLead,
  onSelectBusiness,
  onToggleBusiness,
  selectionLimit,
  selectedIds,
  validationStates,
}: {
  addedLeadIds: Set<string>;
  businesses: ProspectBusiness[];
  dispatchStates: Record<string, ProspectingDispatchState>;
  existingLeadPhones: Set<string>;
  onlyWhatsApp: boolean;
  onAddLead: (business: ProspectBusiness) => void;
  onSelectBusiness: (business: ProspectBusiness) => void;
  onToggleBusiness: (business: ProspectBusiness) => void;
  selectionLimit: number;
  selectedIds: Set<string>;
  validationStates: Record<string, ProspectingWhatsAppValidationState>;
}) {
  const visibleBusinesses = onlyWhatsApp
    ? businesses.filter((business) => validationStates[business.id]?.status === "valid")
    : businesses;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="grid grid-cols-[2.5rem_minmax(15rem,1.5fr)_11rem_10rem_7rem_8rem_8rem] border-b border-white/10 bg-white/[0.035] px-3 py-3 text-xs uppercase text-zinc-500">
        <span />
        <span>Empresa</span>
        <span>Telefone</span>
        <span>Cidade/UF</span>
        <span>Score</span>
        <span>Status</span>
        <span>Acoes</span>
      </div>
      <div className="max-h-[52vh] overflow-y-auto">
        {visibleBusinesses.map((business) => {
          const normalizedPhone = normalizeProspectingWhatsAppPhone(business.phone);
          const isDuplicate = Boolean(normalizedPhone && existingLeadPhones.has(normalizedPhone));
          const isAdded = addedLeadIds.has(business.id);
          const isSelected = selectedIds.has(business.id);
          const dispatchStatus = dispatchStates[business.id]?.status;
          const isFinished = dispatchStatus === "sent" || dispatchStatus === "lead_added" || dispatchStatus === "ignored";
          const label = statusLabel(dispatchStates[business.id], isAdded, isDuplicate, isSelected);
          const validation = validationStates[business.id]?.status ?? "unknown";

          return (
            <div
              className="grid grid-cols-[2.5rem_minmax(15rem,1.5fr)_11rem_10rem_7rem_8rem_8rem] items-center border-b border-white/[0.06] px-3 py-3 text-sm transition hover:bg-white/[0.035]"
              key={business.id}
            >
              <input
                aria-label={`Selecionar ${business.name}`}
                checked={isSelected}
                className="h-4 w-4 rounded border-white/20 bg-black accent-[#8B5CF6]"
                disabled={
                  !business.phone ||
                  isDuplicate ||
                  isAdded ||
                  isFinished ||
                  validation === "invalid" ||
                  validation === "error" ||
                  validation === "checking" ||
                  (!isSelected && selectedIds.size >= selectionLimit)
                }
                onChange={() => onToggleBusiness(business)}
                type="checkbox"
              />
              <button className="min-w-0 text-left" onClick={() => onSelectBusiness(business)} type="button">
                <div className="truncate font-semibold text-white">{business.name}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">{business.category}</div>
                {business.website ? (
                  <div className="mt-1 text-xs text-zinc-500">Site ativo</div>
                ) : (
                  <div className="mt-1 text-xs text-amber-200">Sem site</div>
                )}
              </button>
              <div className="flex items-center gap-2 text-zinc-100">
                <Phone className="h-3.5 w-3.5 text-[#25D366]" />
                <span className="truncate">{business.phone || "Sem telefone"}</span>
              </div>
              <div className="truncate text-zinc-300">
                {business.city || "Cidade"} / {business.state || "UF"}
              </div>
              <div className="flex items-center gap-1 text-amber-100">
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                {business.leadScore ?? 0}
              </div>
              <div className="space-y-1">
                <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs ${label.className}`}>{label.label}</span>
                <span className={`block text-[11px] ${validationClass(validation)}`}>{validationLabel(validation)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                  disabled={isAdded}
                  onClick={() => onAddLead(business)}
                  title="Adicionar como lead"
                  type="button"
                >
                  {isAdded ? <CheckCircle2 className="h-4 w-4 text-[#25D366]" /> : <Plus className="h-4 w-4" />}
                </button>
                {business.phone && (
                  <a
                    className="rounded-lg border border-[#25D366]/20 p-2 text-[#9AF0B8] transition hover:bg-[#25D366]/10"
                    href={`https://wa.me/${normalizedPhone}`}
                    rel="noreferrer"
                    target="_blank"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
                {business.googleMapsUrl ? (
                  <a
                    className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                    href={business.googleMapsUrl}
                    rel="noreferrer"
                    target="_blank"
                    title="Abrir Google Maps"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <XCircle className="h-4 w-4 text-zinc-700" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
