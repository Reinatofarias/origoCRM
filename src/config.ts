export const APP_CONFIG = {
  name: "ORIGOCRM",
  description: "CRM de prospeccao via WhatsApp",
  version: "0.1.0",

  urls: {
    app: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },

  whatsapp: {
    enabled: process.env.NEXT_PUBLIC_EVOLUTION_ENABLED === "true",
  },

  pipelineStages: ["novo", "contatado", "respondeu", "proposta", "fechado"] as const,

  defaultFollowupDays: 3,
  coldLeadThresholdDays: 2,

  limits: {
    maxLeadsPerRequest: 1000,
    maxTemplatesPerUser: 50,
  },
};
