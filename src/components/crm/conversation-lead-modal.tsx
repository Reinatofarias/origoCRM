"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

import type { PipelineStage } from "@/components/crm/pipeline-state";
import { Input, Modal } from "@/components/crm/ui";
import type { Lead, LeadStatus, Tag as CrmTag } from "@/lib/types";

export type ConversationLeadSaveInput = {
  name: string;
  company: string;
  source: string;
  status: LeadStatus;
  temperature: NonNullable<Lead["temperature"]>;
  ownerName: string;
  nextFollowupAt: string;
  tagIds: string[];
  newTagName: string;
};

export function ConversationLeadModal({
  availableTags,
  columns,
  initialName,
  phoneNumber,
  saving,
  selectedLeadTags,
  existingLead,
  onClose,
  onSave,
}: {
  availableTags: CrmTag[];
  columns: PipelineStage[];
  initialName: string;
  phoneNumber: string;
  saving: boolean;
  selectedLeadTags: CrmTag[];
  existingLead: Lead | null;
  onClose: () => void;
  onSave: (input: ConversationLeadSaveInput) => void;
}) {
  const [name, setName] = useState(existingLead?.name ?? initialName);
  const [company, setCompany] = useState(existingLead?.company ?? "");
  const [source, setSource] = useState(existingLead?.source ?? "WhatsApp");
  const [status, setStatus] = useState<LeadStatus>(existingLead?.status ?? columns[0]?.id ?? "novo");
  const [temperature, setTemperature] = useState<NonNullable<Lead["temperature"]>>(existingLead?.temperature ?? "morno");
  const [ownerName, setOwnerName] = useState(existingLead?.owner_name ?? "");
  const [nextFollowupAt, setNextFollowupAt] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    () => new Set(selectedLeadTags.map((tag) => tag.id)),
  );
  const [newTagName, setNewTagName] = useState("");

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <Modal onClose={onClose} title={existingLead ? "Vincular conversa ao lead" : "Salvar conversa como lead"}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name,
            company,
            source,
            status,
            temperature,
            ownerName,
            nextFollowupAt,
            tagIds: Array.from(selectedTagIds),
            newTagName,
          });
        }}
      >
        {existingLead && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
            Já existe um lead com este telefone. A conversa será vinculada a ele, evitando duplicidade.
          </div>
        )}
        <Input label="Nome" onChange={setName} required value={name} />
        <label className="block text-sm text-zinc-300">
          Telefone
          <input
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-zinc-400 outline-none"
            readOnly
            value={phoneNumber}
          />
        </label>
        <Input label="Empresa" onChange={setCompany} value={company} />
        <Input label="Origem" onChange={setSource} value={source} />
        <Input label="Responsável" onChange={setOwnerName} value={ownerName} />
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="text-sm font-medium text-zinc-200">Tags</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTags.length === 0 && (
              <span className="text-xs text-zinc-500">Nenhuma tag cadastrada ainda.</span>
            )}
            {availableTags.map((tag) => (
              <button
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selectedTagIds.has(tag.id) ? "ring-1 ring-white/25" : "opacity-70 hover:opacity-100"
                }`}
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}18`, color: tag.color }}
                type="button"
              >
                {tag.name}
              </button>
            ))}
          </div>
          <input
            className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#8B5CF6]"
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Criar nova tag ao salvar"
            value={newTagName}
          />
        </div>
        <label className="block text-sm text-zinc-300">
          Status inicial
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
            value={status}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Temperatura
          <select
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#14131B] px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setTemperature(event.target.value as NonNullable<Lead["temperature"]>)}
            value={temperature}
          >
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Próximo follow-up
          <input
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none transition focus:border-[#8B5CF6]"
            onChange={(event) => setNextFollowupAt(event.target.value)}
            type="datetime-local"
            value={nextFollowupAt}
          />
        </label>
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] font-semibold text-black transition hover:bg-[#20bd5a] disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {existingLead ? "Vincular conversa" : "Criar lead e vincular conversa"}
        </button>
      </form>
    </Modal>
  );
}
