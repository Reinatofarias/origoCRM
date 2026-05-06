import type { Lead, LeadStatus, MessageTemplate } from "@/lib/types";

/**
 * Normaliza número de telefone removendo caracteres especiais
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Gera um ID único com prefixo
 */
export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

/**
 * Adiciona N dias a partir de hoje (9:00 AM)
 */
export function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

/**
 * Retorna o final do dia atual em ms
 */
export function startOfToday(): number {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Substitui variáveis no template com dados do lead
 * Variáveis suportadas: {{nome}}, {{telefone}}, {{empresa}}, {{origem}}
 */
export function renderTemplate(template: string, lead: Lead): string {
  return template
    .replaceAll("{{nome}}", lead.name)
    .replaceAll("{{telefone}}", lead.phone)
    .replaceAll("{{empresa}}", lead.company)
    .replaceAll("{{origem}}", lead.source);
}

/**
 * Seleciona o melhor template para um lead baseado em seu status
 */
export function pickTemplate(
  templates: MessageTemplate[],
  lead: Lead,
): MessageTemplate | null {
  const map: Partial<Record<LeadStatus, string[]>> = {
    novo: ["primeiro contato"],
    contatado: ["follow-up", "follow up"],
    proposta: ["proposta enviada", "proposta"],
  };

  const terms = map[lead.status] ?? ["primeiro contato"];
  return (
    templates.find((template) =>
      terms.some((term) => template.title.toLowerCase().includes(term)),
    ) ?? templates[0] ?? null
  );
}

/**
 * Retorna lista de leads que precisam de follow-up hoje
 */
export function getPriorityLeads(leads: Lead[]): Lead[] {
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const todayEnd = startOfToday();

  return leads
    .filter((lead) => {
      const lastContact = lead.last_contact_at ? new Date(lead.last_contact_at).getTime() : 0;
      const followup = lead.next_followup_at
        ? new Date(lead.next_followup_at).getTime()
        : Infinity;

      return (
        (lead.status === "contatado" && (!lastContact || lastContact < twoDaysAgo)) ||
        followup <= todayEnd
      );
    })
    .sort((a, b) => {
      const aContact = a.last_contact_at ? new Date(a.last_contact_at).getTime() : 0;
      const bContact = b.last_contact_at ? new Date(b.last_contact_at).getTime() : 0;
      return aContact - bContact;
    });
}
