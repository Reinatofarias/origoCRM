import type { Interaction, Lead, MessageTemplate } from "@/lib/types";

const now = new Date().toISOString();

export const pipelineColumns = [
  { id: "novo", title: "Novo" },
  { id: "contatado", title: "Contatado" },
  { id: "respondeu", title: "Respondeu" },
  { id: "proposta", title: "Proposta" },
  { id: "fechado", title: "Fechado" },
] as const;

export const defaultTemplates: MessageTemplate[] = [
  {
    id: "template-1",
    title: "Primeiro contato",
    body: "Oi {{nome}}, tudo bem? Vi a {{empresa}} e acredito que posso ajudar com uma prospeccao mais previsivel. Posso te mandar uma ideia rapida por aqui?",
    created_at: now,
  },
  {
    id: "template-2",
    title: "Follow-up",
    body: "Oi {{nome}}, passando rapido para saber se faz sentido conversarmos sobre a oportunidade para a {{empresa}} ainda esta semana.",
    created_at: now,
  },
  {
    id: "template-3",
    title: "Proposta enviada",
    body: "{{nome}}, enviei a proposta para a {{empresa}}. Posso te chamar em 15 minutos para alinhar os proximos passos?",
    created_at: now,
  },
];

export const demoLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Marina Costa",
    phone: "5585999990001",
    company: "Costa Labs",
    source: "LinkedIn",
    status: "novo",
    last_contact_at: null,
    next_followup_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "lead-2",
    name: "Rafael Lima",
    phone: "5585988880002",
    company: "Lima Foods",
    source: "Indicacao",
    status: "contatado",
    last_contact_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    next_followup_at: new Date().toISOString(),
    created_at: now,
    updated_at: now,
  },
  {
    id: "lead-3",
    name: "Bianca Rocha",
    phone: "5585977770003",
    company: "Rocha Design",
    source: "Site",
    status: "respondeu",
    last_contact_at: null,
    next_followup_at: null,
    created_at: now,
    updated_at: now,
  },
];

export const demoInteractions: Interaction[] = [
  {
    id: "interaction-1",
    lead_id: "lead-2",
    note: "Lead pediu retorno no fim do dia.",
    message: "Lead pediu retorno no fim do dia.",
    type: "note",
    channel: "whatsapp",
    created_at: now,
  },
];
