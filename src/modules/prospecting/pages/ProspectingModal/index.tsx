"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { LeadInput, MessageTemplate, ProspectingCampaignInput } from "@/lib/types";

import { useProspecting } from "../../hooks";
import type {
  ProspectBusiness,
  ProspectingDispatchState,
  ProspectingSearchInput,
  ProspectingWhatsAppValidationState,
} from "../../types";
import { normalizeProspectingWhatsAppPhone } from "../../utils/phone";
import { ProspectingDesktop } from "./desktop";
import { ProspectingMobile } from "./mobile";

const DEFAULT_CAMPAIGN_BATCH_LIMIT = 20;
const DEFAULT_SEARCH_LIMIT = 60;

export function ProspectingModal({
  campaignBatchLimit = DEFAULT_CAMPAIGN_BATCH_LIMIT,
  existingLeadPhones,
  onAddLead,
  onClose,
  onSendProspectingMessage,
  onValidateWhatsAppNumbers,
  onCampaignCompleted,
  searchLimit = DEFAULT_SEARCH_LIMIT,
  templates,
}: {
  campaignBatchLimit?: number;
  existingLeadPhones: Set<string>;
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
  onSendProspectingMessage: (phoneNumber: string, message: string) => Promise<{ success: boolean; error: string }>;
  onCampaignCompleted: (input: ProspectingCampaignInput) => Promise<void> | void;
  onValidateWhatsAppNumbers: (phoneNumbers: string[]) => Promise<{
    success: boolean;
    numbers: Array<{ number: string; exists: boolean; jid: string }>;
    error: string;
  }>;
  templates: MessageTemplate[];
  searchLimit?: number;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ProspectingModalContent
        campaignBatchLimit={campaignBatchLimit}
        existingLeadPhones={existingLeadPhones}
        onAddLead={onAddLead}
        onClose={onClose}
        onSendProspectingMessage={onSendProspectingMessage}
        onCampaignCompleted={onCampaignCompleted}
        onValidateWhatsAppNumbers={onValidateWhatsAppNumbers}
        searchLimit={searchLimit}
        templates={templates}
      />
    </QueryClientProvider>
  );
}

function ProspectingModalContent({
  campaignBatchLimit,
  existingLeadPhones,
  onAddLead,
  onClose,
  onSendProspectingMessage,
  onCampaignCompleted,
  onValidateWhatsAppNumbers,
  searchLimit,
  templates,
}: {
  campaignBatchLimit: number;
  existingLeadPhones: Set<string>;
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
  onSendProspectingMessage: (phoneNumber: string, message: string) => Promise<{ success: boolean; error: string }>;
  onCampaignCompleted: (input: ProspectingCampaignInput) => Promise<void> | void;
  onValidateWhatsAppNumbers: (phoneNumbers: string[]) => Promise<{
    success: boolean;
    numbers: Array<{ number: string; exists: boolean; jid: string }>;
    error: string;
  }>;
  searchLimit: number;
  templates: MessageTemplate[];
}) {
  const prospecting = useProspecting();
  const effectiveBatchLimit = Math.max(1, campaignBatchLimit || DEFAULT_CAMPAIGN_BATCH_LIMIT);
  const effectiveSearchLimit = Math.max(20, searchLimit || DEFAULT_SEARCH_LIMIT);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<Set<string>>(() => new Set());
  const [dispatchStates, setDispatchStates] = useState<Record<string, ProspectingDispatchState>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => templates[0]?.id ?? "");
  const [intervalSeconds, setIntervalSeconds] = useState(12);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isValidatingWhatsApp, setIsValidatingWhatsApp] = useState(false);
  const [onlyWhatsApp, setOnlyWhatsApp] = useState(false);
  const [validationStates, setValidationStates] = useState<Record<string, ProspectingWhatsAppValidationState>>({});
  const [campaignNotice, setCampaignNotice] = useState("");
  const [lastSearchInput, setLastSearchInput] = useState<ProspectingSearchInput | null>(null);

  const selectedBusinesses = useMemo(
    () => prospecting.businesses.filter((business) => selectedBusinessIds.has(business.id)),
    [prospecting.businesses, selectedBusinessIds],
  );
  const selectedTemplateIdForUi = selectedTemplateId || templates[0]?.id || "";
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateIdForUi) ?? null;
  const sendableBusinesses = selectedBusinesses.filter((business) => {
    const phone = normalizeProspectingWhatsAppPhone(business.phone);
    const state = dispatchStates[business.id]?.status ?? "new";
    const validation = validationStates[business.id]?.status ?? "unknown";
    return (
      Boolean(phone) &&
      validation === "valid" &&
      !existingLeadPhones.has(phone) &&
      state !== "sent" &&
      state !== "lead_added" &&
      state !== "ignored"
    );
  });
  const sentCount = Object.values(dispatchStates).filter((item) => item.status === "sent").length;
  const ignoredCount = Object.values(dispatchStates).filter((item) => item.status === "ignored").length;
  const failedCount = Object.values(dispatchStates).filter((item) => item.status === "failed").length;
  const validWhatsAppCount = Object.values(validationStates).filter((item) => item.status === "valid").length;
  const previewMessage = selectedTemplate && selectedBusinesses[0]
    ? renderProspectingTemplate(selectedTemplate.body, selectedBusinesses[0])
    : "";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function search(input: ProspectingSearchInput) {
    setSelectedBusinessIds(new Set());
    setDispatchStates({});
    setValidationStates({});
    setOnlyWhatsApp(false);
    setCampaignNotice("");
    setLastSearchInput(input);
    prospecting.searchBusinesses.mutate(input, {
      onSuccess: () => {
        prospecting.setSelectedBusiness(null);
      },
    });
  }

  async function addBusinessLead(business: ProspectBusiness) {
    await onAddLead({
      name: business.name,
      phone: business.phone ?? "",
      company: business.name,
      source: "Prospecção Inteligente",
      status: "novo",
      estimated_value: business.leadScore && business.leadScore >= 85 ? 4500 : 2200,
      owner_name: "",
      temperature: business.leadScore && business.leadScore >= 85 ? "quente" : "morno",
      outcome_reason: "",
      sla_hours: 24,
    });
    prospecting.markLeadAdded(business.id);
    setDispatchStates((current) => ({ ...current, [business.id]: { status: "lead_added", sentAt: new Date().toISOString() } }));
  }

  function generateApproach(business: ProspectBusiness) {
    prospecting.setSelectedBusiness(business);
    prospecting.enrichCompany.mutate({ business });
  }

  function exportBusinessesCsv() {
    const rows = prospecting.businesses.map((business) => ({
      nome: business.name,
      estado: business.state ?? "",
      telefone: business.phone ?? "",
      cidade: business.city ?? "",
      categoria: business.category,
      website: business.website ?? "",
      google_maps: business.googleMapsUrl ?? "",
    }));

    downloadProspectingCsv("origocrm-prospeccao.csv", rows);
  }

  function toggleBusiness(business: ProspectBusiness) {
    const phone = normalizeProspectingWhatsAppPhone(business.phone);
    if (!phone || existingLeadPhones.has(phone) || prospecting.addedLeadIds.has(business.id)) return;
    if (isFinishedDispatch(dispatchStates[business.id]?.status ?? "new")) return;
    setSelectedBusinessIds((current) => {
      const next = new Set(current);
      if (next.has(business.id)) next.delete(business.id);
      else {
        if (next.size >= effectiveBatchLimit) {
          setCampaignNotice(`Lote limitado a ${effectiveBatchLimit} contatos. Envie ou limpe para selecionar novos.`);
          return current;
        }
        next.add(business.id);
        setCampaignNotice("");
      }
      return next;
    });
    prospecting.setSelectedBusiness(business);
  }

  function selectPhoneProspects() {
    const selected = prospecting.businesses
      .filter((business) => canEnterCampaignBatch({
        business,
        dispatchState: dispatchStates[business.id],
        existingLeadPhones,
        isAdded: prospecting.addedLeadIds.has(business.id),
        onlyWhatsApp,
        validationState: validationStates[business.id],
      }))
      .slice(0, effectiveBatchLimit);

    setSelectedBusinessIds(new Set(selected.map((business) => business.id)));
    setCampaignNotice(
      selected.length === 0
        ? "Nenhum contato elegivel para o proximo lote."
        : `Lote preparado com ${selected.length}/${effectiveBatchLimit} contatos elegíveis.`,
    );
  }

  function selectFailedProspects() {
    const selected = prospecting.businesses
      .filter((business) => dispatchStates[business.id]?.status === "failed")
      .slice(0, effectiveBatchLimit);

    setSelectedBusinessIds(new Set(selected.map((business) => business.id)));
    setCampaignNotice(selected.length === 0 ? "Nenhuma falha disponivel para reenviar." : `${selected.length} falhas selecionadas para reenvio.`);
  }

  async function validateSelectedWhatsApp() {
    const toValidate = selectedBusinesses.filter((business) => {
      const phone = normalizeProspectingWhatsAppPhone(business.phone);
      return Boolean(phone) && !existingLeadPhones.has(phone);
    });
    if (toValidate.length === 0 || isValidatingWhatsApp) return;

    setIsValidatingWhatsApp(true);
    setValidationStates((current) => {
      const next = { ...current };
      for (const business of toValidate) next[business.id] = { status: "checking" };
      return next;
    });

    const result = await onValidateWhatsAppNumbers(toValidate.map((business) => normalizeProspectingWhatsAppPhone(business.phone)));
    if (!result.success) {
      setValidationStates((current) => {
        const next = { ...current };
        for (const business of toValidate) next[business.id] = { status: "error", error: result.error };
        return next;
      });
      setIsValidatingWhatsApp(false);
      return;
    }

    const checked = new Map((result.numbers ?? []).map((item) => [normalizeProspectingWhatsAppPhone(item.number), item]));
    setValidationStates((current) => {
      const next = { ...current };
      for (const business of toValidate) {
        const phone = normalizeProspectingWhatsAppPhone(business.phone);
        const item = checked.get(phone);
        next[business.id] = item?.exists ? { status: "valid", jid: item.jid } : { status: "invalid" };
      }
      return next;
    });
    setSelectedBusinessIds(new Set(toValidate.filter((business) => {
      const item = checked.get(normalizeProspectingWhatsAppPhone(business.phone));
      return item?.exists;
    }).slice(0, effectiveBatchLimit).map((business) => business.id)));
    setOnlyWhatsApp(true);
    setCampaignNotice(`Validacao concluida. ${validWhatsAppCountAfterCheck(toValidate, checked)} contatos com WhatsApp encontrados.`);
    setIsValidatingWhatsApp(false);
  }

  function ignoreSelected() {
    setDispatchStates((current) => {
      const next = { ...current };
      for (const id of selectedBusinessIds) next[id] = { status: "ignored" };
      return next;
    });
    setSelectedBusinessIds(new Set());
    setCampaignNotice("Contatos ignorados não entram nos próximos lotes.");
  }

  async function startCampaign() {
    if (!selectedTemplate || sendableBusinesses.length === 0 || isSendingCampaign) return;
    const campaignBusinesses = sendableBusinesses.slice(0, effectiveBatchLimit);

    setIsSendingCampaign(true);
    setCampaignNotice(`Campanha iniciada para ${campaignBusinesses.length} contatos validados.`);
    setDispatchStates((current) => {
      const next = { ...current };
      for (const business of campaignBusinesses) next[business.id] = { status: "queued" };
      return next;
    });

    const campaignContacts: ProspectingCampaignInput["contacts"] = [];

    for (const [index, business] of campaignBusinesses.entries()) {
      const phone = business.phone ?? "";
      const message = renderProspectingTemplate(selectedTemplate.body, business);

      setDispatchStates((current) => ({ ...current, [business.id]: { status: "sending" } }));
      const result = await onSendProspectingMessage(normalizeProspectingWhatsAppPhone(phone), message);
      const sentAt = result.success ? new Date().toISOString() : null;
      campaignContacts.push({
        business_name: business.name,
        phone: normalizeProspectingWhatsAppPhone(phone),
        category: business.category,
        city: business.city,
        state: business.state,
        lead_score: business.leadScore ?? null,
        dispatch_status: result.success ? "sent" : "failed",
        message,
        error: result.error ?? null,
        sent_at: sentAt,
      });
      setDispatchStates((current) => ({
        ...current,
        [business.id]: result.success
          ? { status: "sent", sentAt: sentAt ? new Date().toISOString() : undefined }
          : { status: "failed", error: result.error ?? "Falha ao enviar" },
      }));

      if (index < campaignBusinesses.length - 1) {
        await sleep(Math.max(intervalSeconds, 5) * 1000);
      }
    }

    setIsSendingCampaign(false);
    setSelectedBusinessIds(new Set());
    if (onCampaignCompleted) {
      const sent = campaignContacts.filter((contact) => contact.dispatch_status === "sent").length;
      const failed = campaignContacts.filter((contact) => contact.dispatch_status === "failed").length;
      const searchInput = lastSearchInput;
      await onCampaignCompleted({
        name: `Prospeccao ${searchInput?.niche ?? "Google"} - ${new Date().toLocaleDateString("pt-BR")}`,
        niche: searchInput?.niche ?? "",
        state: searchInput?.state ?? "",
        city: searchInput?.city ?? "",
        template_id: selectedTemplate.id,
        total_contacts: campaignContacts.length,
        whatsapp_validated_count: campaignBusinesses.filter((business) => validationStates[business.id]?.status === "valid").length,
        sent_count: sent,
        failed_count: failed,
        ignored_count: ignoredCount,
        status: failed > 0 && sent === 0 ? "failed" : "completed",
        contacts: campaignContacts,
      });
    }
    setCampaignNotice(`Campanha finalizada. Use Selecionar próximos ${effectiveBatchLimit} para montar outro lote sem repetir enviados.`);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black/70 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,211,102,0.12),transparent_28%)]" />
      <div className="relative h-dvh">
        <ProspectingDesktop
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          batchLimit={effectiveBatchLimit}
          campaignNotice={campaignNotice}
          dispatchStates={dispatchStates}
          existingLeadPhones={existingLeadPhones}
          intervalSeconds={intervalSeconds}
          isLoading={prospecting.isLoading}
          isSendingCampaign={isSendingCampaign}
          isValidatingWhatsApp={isValidatingWhatsApp}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClearSelection={() => setSelectedBusinessIds(new Set())}
          onClose={onClose}
          onIgnoreSelected={ignoreSelected}
          onGenerateApproach={generateApproach}
          onExportBusinesses={exportBusinessesCsv}
          onIntervalChange={setIntervalSeconds}
          onSearch={search}
          searchLimit={effectiveSearchLimit}
          onSelectFailedProspects={selectFailedProspects}
          onSelectPhoneProspects={selectPhoneProspects}
          onSelectBusiness={prospecting.setSelectedBusiness}
          onStartCampaign={() => void startCampaign()}
          onTemplateChange={setSelectedTemplateId}
          onToggleOnlyWhatsApp={() => setOnlyWhatsApp((value) => !value)}
          onToggleBusiness={toggleBusiness}
          onValidateWhatsApp={() => void validateSelectedWhatsApp()}
          onlyWhatsApp={onlyWhatsApp}
          previewMessage={previewMessage}
          selectedBusinessIds={selectedBusinessIds}
          selectedTemplateId={selectedTemplateIdForUi}
          selectedBusiness={prospecting.selectedBusiness}
          sendableCount={sendableBusinesses.length}
          sentCount={sentCount}
          ignoredCount={ignoredCount}
          failedCount={failedCount}
          templates={templates}
          validationStates={validationStates}
          validWhatsAppCount={validWhatsAppCount}
        />
        <ProspectingMobile
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          batchLimit={effectiveBatchLimit}
          campaignNotice={campaignNotice}
          dispatchStates={dispatchStates}
          existingLeadPhones={existingLeadPhones}
          intervalSeconds={intervalSeconds}
          isLoading={prospecting.isLoading}
          isSendingCampaign={isSendingCampaign}
          isValidatingWhatsApp={isValidatingWhatsApp}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClearSelection={() => setSelectedBusinessIds(new Set())}
          onClose={onClose}
          onIgnoreSelected={ignoreSelected}
          onGenerateApproach={generateApproach}
          onExportBusinesses={exportBusinessesCsv}
          onIntervalChange={setIntervalSeconds}
          onSearch={search}
          searchLimit={effectiveSearchLimit}
          onSelectFailedProspects={selectFailedProspects}
          onSelectPhoneProspects={selectPhoneProspects}
          onSelectBusiness={prospecting.setSelectedBusiness}
          onStartCampaign={() => void startCampaign()}
          onTemplateChange={setSelectedTemplateId}
          onToggleOnlyWhatsApp={() => setOnlyWhatsApp((value) => !value)}
          onToggleBusiness={toggleBusiness}
          onValidateWhatsApp={() => void validateSelectedWhatsApp()}
          onlyWhatsApp={onlyWhatsApp}
          previewMessage={previewMessage}
          selectedBusinessIds={selectedBusinessIds}
          selectedTemplateId={selectedTemplateIdForUi}
          selectedBusiness={prospecting.selectedBusiness}
          sendableCount={sendableBusinesses.length}
          sentCount={sentCount}
          ignoredCount={ignoredCount}
          failedCount={failedCount}
          templates={templates}
          validationStates={validationStates}
          validWhatsAppCount={validWhatsAppCount}
        />
      </div>
    </div>
  );
}

function downloadProspectingCsv(filename: string, rows: Record<string, string>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderProspectingTemplate(template: string, business: ProspectBusiness) {
  return template
    .replaceAll("{{nome}}", business.name)
    .replaceAll("{{telefone}}", normalizeProspectingWhatsAppPhone(business.phone))
    .replaceAll("{{empresa}}", business.name)
    .replaceAll("{{origem}}", "Prospeccao Inteligente")
    .replaceAll("{{cidade}}", business.city ?? "")
    .replaceAll("{{estado}}", business.state ?? "");
}

function isFinishedDispatch(status: ProspectingDispatchState["status"]) {
  return status === "sent" || status === "lead_added" || status === "ignored";
}

function canEnterCampaignBatch({
  business,
  dispatchState,
  existingLeadPhones,
  isAdded,
  onlyWhatsApp,
  validationState,
}: {
  business: ProspectBusiness;
  dispatchState?: ProspectingDispatchState;
  existingLeadPhones: Set<string>;
  isAdded: boolean;
  onlyWhatsApp: boolean;
  validationState?: ProspectingWhatsAppValidationState;
}) {
  const phone = normalizeProspectingWhatsAppPhone(business.phone);
  if (!phone || existingLeadPhones.has(phone) || isAdded) return false;
  if (isFinishedDispatch(dispatchState?.status ?? "new")) return false;
  const status = validationState?.status ?? "unknown";
  if (status === "invalid" || status === "error" || status === "checking") return false;
  if (onlyWhatsApp) return status === "valid";
  return true;
}

function validWhatsAppCountAfterCheck(
  businesses: ProspectBusiness[],
  checked: Map<string, { number: string; exists: boolean; jid: string }>,
) {
  return businesses.filter((business) => checked.get(normalizeProspectingWhatsAppPhone(business.phone))?.exists).length;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default ProspectingModal;
