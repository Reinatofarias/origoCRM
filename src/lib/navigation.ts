export type View =
  | "dashboard"
  | "pipeline"
  | "tasks"
  | "leads"
  | "templates"
  | "conversations"
  | "whatsapp"
  | "settings";

export const viewPaths: Record<View, string> = {
  dashboard: "/dashboard",
  pipeline: "/pipeline",
  tasks: "/tasks",
  leads: "/leads",
  templates: "/templates",
  conversations: "/conversations",
  whatsapp: "/whatsapp",
  settings: "/settings",
};

export const pathViews: Record<string, View> = Object.fromEntries(
  Object.entries(viewPaths).map(([view, path]) => [path, view]),
) as Record<string, View>;

export const viewTitles: Record<View, string> = {
  dashboard: "Dashboard",
  pipeline: "CRM",
  tasks: "Tarefas",
  leads: "Leads",
  templates: "Mensagens prontas",
  conversations: "Conversas",
  whatsapp: "Conexão WhatsApp",
  settings: "Configurações",
};

export function getViewSubtitle(view: View) {
  if (view === "conversations") return "Mensagens salvas pelo webhook da Evolution.";
  if (view === "tasks") return "Tarefas operacionais, comerciais e próximas ações.";
  if (view === "pipeline") return "Funil comercial, leads e oportunidades em andamento.";
  if (view === "whatsapp") return "Conecte a instância OrigoCRM pelo QR Code.";
  if (view === "settings") return "Status das conexões e próximos ajustes do CRM.";
  return "Cadência contínua: abrir, enviar, próximo.";
}
