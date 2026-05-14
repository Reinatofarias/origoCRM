"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { LeadInput, MessageTemplate } from "@/lib/types";
import { normalizePhone } from "@/lib/utils";

import { useProspecting } from "../../hooks";
import type { ProspectBusiness, ProspectingDispatchState, ProspectingSearchInput } from "../../types";
import { ProspectingDesktop } from "./desktop";
import { ProspectingMobile } from "./mobile";

export function ProspectingModal({
  existingLeadPhones,
  onAddLead,
  onClose,
  onSendProspectingMessage,
  templates,
}: {
  existingLeadPhones: Set<string>;
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
  onSendProspectingMessage: (phoneNumber: string, message: string) => Promise<{ success: boolean; error?: string }>;
  templates: MessageTemplate[];
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
        existingLeadPhones={existingLeadPhones}
        onAddLead={onAddLead}
        onClose={onClose}
        onSendProspectingMessage={onSendProspectingMessage}
        templates={templates}
      />
    </QueryClientProvider>
  );
}

function ProspectingModalContent({
  existingLeadPhones,
  onAddLead,
  onClose,
  onSendProspectingMessage,
  templates,
}: {
  existingLeadPhones: Set<string>;
  onAddLead: (input: LeadInput) => Promise<void> | void;
  onClose: () => void;
  onSendProspectingMessage: (phoneNumber: string, message: string) => Promise<{ success: boolean; error?: string }>;
  templates: MessageTemplate[];
}) {
  const prospecting = useProspecting();
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<Set<string>>(() => new Set());
  const [dispatchStates, setDispatchStates] = useState<Record<string, ProspectingDispatchState>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => templates[0]?.id ?? "");
  const [intervalSeconds, setIntervalSeconds] = useState(12);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);

  const selectedBusinesses = useMemo(
    () => prospecting.businesses.filter((business) => selectedBusinessIds.has(business.id)),
    [prospecting.businesses, selectedBusinessIds],
  );
  const selectedTemplateIdForUi = selectedTemplateId || templates[0]?.id || "";
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateIdForUi) ?? null;
  const sendableBusinesses = selectedBusinesses.filter((business) => {
    const phone = normalizePhone(business.phone ?? "");
    const state = dispatchStates[business.id]?.status;
    return Boolean(phone) && !existingLeadPhones.has(phone) && state !== "sent" && state !== "lead_added" && state !== "ignored";
  });
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
    prospecting.searchBusinesses.mutate(input, {
      onSuccess: (result) => {
        prospecting.setSelectedBusiness(result.businesses[0] ?? null);
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
    const phone = normalizePhone(business.phone ?? "");
    if (!phone || existingLeadPhones.has(phone) || prospecting.addedLeadIds.has(business.id)) return;
    setSelectedBusinessIds((current) => {
      const next = new Set(current);
      if (next.has(business.id)) next.delete(business.id);
      else next.add(business.id);
      return next;
    });
    prospecting.setSelectedBusiness(business);
  }

  function selectPhoneProspects() {
    setSelectedBusinessIds(
      new Set(
        prospecting.businesses
          .filter((business) => {
            const phone = normalizePhone(business.phone ?? "");
            return Boolean(phone) && !existingLeadPhones.has(phone) && !prospecting.addedLeadIds.has(business.id);
          })
          .map((business) => business.id),
      ),
    );
  }

  function ignoreSelected() {
    setDispatchStates((current) => {
      const next = { ...current };
      for (const id of selectedBusinessIds) next[id] = { status: "ignored" };
      return next;
    });
    setSelectedBusinessIds(new Set());
  }

  async function startCampaign() {
    if (!selectedTemplate || sendableBusinesses.length === 0 || isSendingCampaign) return;

    setIsSendingCampaign(true);
    setDispatchStates((current) => {
      const next = { ...current };
      for (const business of sendableBusinesses) next[business.id] = { status: "queued" };
      return next;
    });

    for (const [index, business] of sendableBusinesses.entries()) {
      const phone = business.phone ?? "";
      const message = renderProspectingTemplate(selectedTemplate.body, business);

      setDispatchStates((current) => ({ ...current, [business.id]: { status: "sending" } }));
      const result = await onSendProspectingMessage(phone, message);
      setDispatchStates((current) => ({
        ...current,
        [business.id]: result.success
          ? { status: "sent", sentAt: new Date().toISOString() }
          : { status: "failed", error: result.error ?? "Falha ao enviar" },
      }));

      if (index < sendableBusinesses.length - 1) {
        await sleep(Math.max(intervalSeconds, 5) * 1000);
      }
    }

    setIsSendingCampaign(false);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black/70 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,211,102,0.12),transparent_28%)]" />
      <div className="relative h-dvh">
        <ProspectingDesktop
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          dispatchStates={dispatchStates}
          existingLeadPhones={existingLeadPhones}
          intervalSeconds={intervalSeconds}
          isLoading={prospecting.isLoading}
          isSendingCampaign={isSendingCampaign}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClearSelection={() => setSelectedBusinessIds(new Set())}
          onClose={onClose}
          onIgnoreSelected={ignoreSelected}
          onExportBusinesses={exportBusinessesCsv}
          onIntervalChange={setIntervalSeconds}
          onSearch={search}
          onSelectPhoneProspects={selectPhoneProspects}
          onSelectBusiness={prospecting.setSelectedBusiness}
          onStartCampaign={() => void startCampaign()}
          onTemplateChange={setSelectedTemplateId}
          onToggleBusiness={toggleBusiness}
          previewMessage={previewMessage}
          selectedBusinessIds={selectedBusinessIds}
          selectedTemplateId={selectedTemplateIdForUi}
          selectedBusiness={prospecting.selectedBusiness}
          sendableCount={sendableBusinesses.length}
          templates={templates}
        />
        <ProspectingMobile
          addedLeadIds={prospecting.addedLeadIds}
          approach={prospecting.generatedApproach}
          businesses={prospecting.businesses}
          dispatchStates={dispatchStates}
          existingLeadPhones={existingLeadPhones}
          intervalSeconds={intervalSeconds}
          isLoading={prospecting.isLoading}
          isSendingCampaign={isSendingCampaign}
          metrics={prospecting.metrics}
          onAddBusinessLead={(business) => void addBusinessLead(business)}
          onClearSelection={() => setSelectedBusinessIds(new Set())}
          onClose={onClose}
          onIgnoreSelected={ignoreSelected}
          onGenerateApproach={generateApproach}
          onExportBusinesses={exportBusinessesCsv}
          onIntervalChange={setIntervalSeconds}
          onSearch={search}
          onSelectPhoneProspects={selectPhoneProspects}
          onSelectBusiness={prospecting.setSelectedBusiness}
          onStartCampaign={() => void startCampaign()}
          onTemplateChange={setSelectedTemplateId}
          onToggleBusiness={toggleBusiness}
          previewMessage={previewMessage}
          selectedBusinessIds={selectedBusinessIds}
          selectedTemplateId={selectedTemplateIdForUi}
          selectedBusiness={prospecting.selectedBusiness}
          sendableCount={sendableBusinesses.length}
          templates={templates}
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
    .replaceAll("{{telefone}}", business.phone ?? "")
    .replaceAll("{{empresa}}", business.name)
    .replaceAll("{{origem}}", "Prospeccao Inteligente")
    .replaceAll("{{cidade}}", business.city ?? "")
    .replaceAll("{{estado}}", business.state ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default ProspectingModal;
