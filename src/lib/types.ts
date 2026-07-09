export type LeadStatus = string;

export type Lead = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  name: string;
  phone: string;
  company: string;
  source: string;
  status: LeadStatus;
  estimated_value: number | null;
  owner_name: string | null;
  temperature: "frio" | "morno" | "quente" | null;
  outcome_reason: string | null;
  sla_hours: number | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  lead_score: number | null;
  lead_score_label: "baixo" | "medio" | "alto" | "critico" | null;
  lead_score_reasons: string[] | null;
  lead_score_updated_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  name: string;
  color: string;
  created_at: string;
};

export type LeadTag = {
  user_id: string | null;
  organization_id: string | null;
  lead_id: string;
  tag_id: string;
  created_at: string;
};

export type MessageTemplate = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  title: string;
  body: string;
  created_at: string;
};

export type Interaction = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  lead_id: string;
  note: string;
  message: string | null;
  type: "whatsapp_sent" | "status_changed" | "followup_created" | "note";
  channel: "whatsapp" | "call" | "email" | "other";
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  lead_id: string | null;
  type: "followup" | "call" | "email" | "whatsapp" | "meeting" | "other";
  title: string;
  notes: string | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  workflow_status: "todo" | "in_progress" | "waiting" | "review" | "completed" | "blocked" | null;
  start_at: string | null;
  position: number | null;
  due_at: string;
  status: "open" | "completed" | "canceled";
  completed_at: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_synced_at: string | null;
  google_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  entity_type: "lead" | "task" | "template" | "whatsapp" | "system";
  entity_id: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditLogInput = {
  entity_type: AuditLog["entity_type"];
  entity_id: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  owner_user_id: string;
  status: "active" | "suspended" | "canceled";
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "manager" | "seller" | "support" | "viewer";
  status: "active" | "invited" | "disabled";
  created_at: string;
  updated_at: string;
};

export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationMember["role"];
  status: "pending" | "accepted" | "canceled" | "expired";
  invited_by_user_id: string;
  accepted_user_id: string | null;
  token: string | null;
  expires_at: string;
  accepted_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  organization_id: string;
  plan_slug: "base" | "pro" | "prospecting" | "premium" | "manual";
  billing_period: "monthly" | "semiannual" | "annual";
  status: "trialing" | "active" | "past_due" | "canceled" | "paused";
  seat_count: number;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type ProspectingCampaignContactInput = {
  business_name: string;
  phone: string;
  category: string;
  city: string;
  state: string;
  lead_score: number | null;
  dispatch_status: "new" | "queued" | "sending" | "sent" | "failed" | "ignored" | "lead_added";
  message: string | null;
  error: string | null;
  sent_at: string | null;
};

export type ProspectingCampaignInput = {
  name: string;
  niche: string;
  state: string;
  city: string;
  template_id: string | null;
  total_contacts: number;
  whatsapp_validated_count: number;
  sent_count: number;
  failed_count: number;
  ignored_count: number;
  status: "draft" | "running" | "completed" | "failed";
  contacts: ProspectingCampaignContactInput[];
};

export type TaskInput = {
  id: string;
  lead_id: string | null;
  type: Task["type"];
  title: string;
  notes: string | null;
  priority?: NonNullable<Task["priority"]>;
  workflow_status?: NonNullable<Task["workflow_status"]>;
  start_at?: string | null;
  position?: number | null;
  due_at: string;
};

export type LeadInput = {
  name: string;
  phone: string;
  company: string;
  source: string;
  status: LeadStatus;
  estimated_value: number | null;
  owner_name: string | null;
  temperature: "frio" | "morno" | "quente" | null;
  outcome_reason: string | null;
  sla_hours: number | null;
};

/**
 * ============================================
 * Evolution API Types (WhatsApp Integration)
 * ============================================
 */

/**
 * Tipos de mensagem suportadas pela Evolution API
 */
export type EvolutionMessageType = "text" | "image" | "audio" | "document" | "video";

/**
 * Status de entrega de mensagem
 */
export type EvolutionMessageStatus =
  | "pending"    // Aguardando envio
  | "sent"       // Enviado
  | "delivered"  // Entregue (1 check)
  | "read"       // Lido (2 checks)
  | "failed";    // Falha no envio

/**
 * Resposta padrão da Evolution API
 */
export type EvolutionApiResponse<T = unknown> = {
  status: number;
  message?: string;
  data?: T;
  error?: string;
};

/**
 * Dados para enviar mensagem de texto
 */
export type EvolutionSendTextRequest = {
  number: string;           // Número do destinatário (sem formatação)
  text: string;             // Conteúdo da mensagem
  delay: number;           // Delay em ms antes de enviar (opcional)
  linkPreview: boolean;    // Mostrar preview de links (opcional)
};

/**
 * Resposta ao enviar mensagem
 */
export type EvolutionSendTextResponse = {
  id: string;               // ID único da mensagem no WhatsApp
  number: string;           // Número de destino
  status: EvolutionMessageStatus;
  timestamp: number;        // Timestamp do envio
};

/**
 * Dados para enviar mídia
 */
export type EvolutionSendMediaRequest = {
  number: string;
  media: {
    url: string;           // URL da mídia ou base64
    type: "image" | "audio" | "document" | "video";
  };
  caption: string;         // Legenda (imagem, documento, vídeo)
  fileName: string;        // Nome do arquivo (documento)
};

/**
 * Webhook recebido da Evolution API
 */
export type EvolutionWebhookPayload = {
  event: EvolutionWebhookEvent;
  data: unknown;
  timestamp: number;
};

/**
 * Tipos de eventos que Evolution API envia
 */
export type EvolutionWebhookEvent =
  | "messages.upsert"        // Nova mensagem ou atualização
  | "messages.update"        // Atualização de status
  | "messages.delete"        // Mensagem deletada
  | "connection.update"      // Atualização de conexão
  | "qr.update"              // QR code atualizado
  | "contacts.upsert"        // Novo contato
  | "presence.update";       // Status de online/offline

/**
 * Estrutura de mensagem recebida
 */
export type EvolutionIncomingMessage = {
  key: {
    remoteJid: string;       // Número do remetente
    id: string;              // ID único da mensagem
    fromMe: boolean;
  };
  message: {
    conversation: string;   // Texto puro
    extendedTextMessage: {
      text: string;
    };
    imageMessage: {
      url: string;
      caption: string;
    };
    documentMessage: {
      url: string;
      fileName: string;
    };
  };
  messageTimestamp: number;
  pushName: string;         // Nome no contato
  status: EvolutionMessageStatus;
};

/**
 * Estrutura de atualização de status
 */
export type EvolutionMessageUpdate = {
  key: {
    id: string;
    remoteJid: string;
  };
  status: EvolutionMessageStatus;
  messageTimestamp: number;
};

/**
 * Configuração da Evolution API
 */
export type EvolutionConfig = {
  apiUrl: string;            // URL base da API
  apiKey: string;            // API Key para autenticação
  instanceName: string;     // Nome da instância (opcional)
  webhookUrl: string;       // URL para receber webhooks
  webhookKey: string;       // Chave para validar webhooks
};

/**
 * Resposta ao buscar instância
 */
export type EvolutionInstanceResponse = {
  instanceName: string;
  status: "connected" | "disconnected" | "connecting";
  qrCode: string;           // QR code em base64
  phoneNumber: string;      // Número conectado
};

/**
 * WhatsApp Message armazenada no banco
 */
export type WhatsAppMessage = {
  id: string;
  lead_id: string | null;
  user_id: string;
  organization_id: string | null;
  message_id: string;        // ID da mensagem no WhatsApp (Evolution)
  remote_jid: string | null;
  phone_number: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  direction: "inbound" | "outbound";
  content: string;
  media_url: string | null;
  status: EvolutionMessageStatus;
  created_at: string;
  updated_at: string;
};

export type WhatsAppConversation = {
  id: string;
  user_id: string;
  organization_id: string | null;
  lead_id: string | null;
  phone_number: string;
  remote_jid: string | null;
  contact_name: string | null;
  contact_avatar_url: string | null;
  status: "open" | "unread" | "waiting" | "responded" | "converted" | "resolved" | "archived";
  unread_count: number;
  last_message: string;
  last_message_direction: "inbound" | "outbound" | null;
  last_message_at: string | null;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Log de integração com WhatsApp
 */
export type WhatsAppLog = {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  event_type: EvolutionWebhookEvent | string;
  status: "success" | "error";
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};
