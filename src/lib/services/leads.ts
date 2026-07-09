import type { Lead, LeadInput, Interaction } from "@/lib/types";
import { newId } from "@/lib/utils";

/**
 * Cria uma nova interação local para um lead.
 */
export function makeInteraction(
  leadId: string,
  note: string,
  type: Interaction["type"],
): Interaction {
  return {
    id: newId("interaction"),
    user_id: null,
    organization_id: null,
    lead_id: leadId,
    note,
    message: note,
    type,
    channel: "whatsapp",
    created_at: new Date().toISOString(),
  };
}

/**
 * Encontra o próximo lead para contato depois do envio atual.
 */
export function getNextLeadAfterSend(
  currentLead: Lead,
  leads: Lead[],
  priorityLeads: Lead[],
): Lead | null {
  const priority = priorityLeads.filter((lead) => lead.id !== currentLead.id);
  if (priority[0]) return priority[0];

  const currentColumn = leads.filter(
    (lead) => lead.status === currentLead.status && lead.id !== currentLead.id,
  );
  if (currentColumn[0]) return currentColumn[0];

  return leads.find((lead) => lead.id !== currentLead.id && lead.status !== "fechado") ?? null;
}

export function validateLead(input: LeadInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name.trim()) errors.push("Nome é obrigatório");
  if (!input.phone.trim()) errors.push("Telefone é obrigatório");
  if (!input.company.trim()) errors.push("Empresa é obrigatória");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatLeadForDisplay(lead: Lead): {
  nameAndCompany: string;
  status: string;
  lastContactFormatted: string;
  nextFollowupFormatted: string;
} {
  return {
    nameAndCompany: `${lead.name} - ${lead.company || "Sem empresa"}`,
    status: lead.status.charAt(0).toUpperCase() + lead.status.slice(1),
    lastContactFormatted: lead.last_contact_at
      ? new Date(lead.last_contact_at).toLocaleDateString("pt-BR")
      : "Nunca",
    nextFollowupFormatted: lead.next_followup_at
      ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR")
      : "Não agendado",
  };
}
