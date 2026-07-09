import type { Lead, LeadInput, Interaction } from "@/lib/types";
import { newId } from "@/lib/utils";

/**
 * Cria uma nova interação para um lead
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
 * Encontra o próximo lead para contato após enviar mensagem para o atual
 */
export function getNextLeadAfterSend(
  currentLead: Lead,
  leads: Lead[],
  priorityLeads: Lead[],
): Lead | null {
  // Primeiro tenta pegar um lead de prioridade que não seja o atual
  const priority = priorityLeads.filter((lead) => lead.id !== currentLead.id);
  if (priority[0]) return priority[0];

  // Depois tenta outro lead na mesma coluna do pipeline
  const currentColumn = leads.filter(
    (lead) => lead.status === currentLead.status && lead.id !== currentLead.id,
  );
  if (currentColumn[0]) return currentColumn[0];

  // Por fim, tenta qualquer lead que não seja fechado
  return (
    leads.find((lead) => lead.id !== currentLead.id && lead.status !== "fechado") ?? null
  );
}

/**
 * Valida se um lead tem todos os dados necessários
 */
export function validateLead(input: LeadInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("Nome é obrigatório");
  }

  if (!input.phone.trim()) {
    errors.push("Telefone é obrigatório");
  }

  if (!input.company.trim()) {
    errors.push("Empresa é obrigatória");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formata lead para exibição
 */
export function formatLeadForDisplay(lead: Lead): {
  nameAndCompany: string;
  status: string;
  lastContactFormatted: string;
  nextFollowupFormatted: string;
} {
  return {
    nameAndCompany: `${lead.name} â€¢ ${lead.company || "Sem empresa"}`,
    status: lead.status.charAt(0).toUpperCase() + lead.status.slice(1),
    lastContactFormatted: lead.last_contact_at
      ? new Date(lead.last_contact_at).toLocaleDateString("pt-BR")
      : "Nunca",
    nextFollowupFormatted: lead.next_followup_at
      ? new Date(lead.next_followup_at).toLocaleDateString("pt-BR")
      : "Não agendado",
  };
}
