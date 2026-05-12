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
  pipeline: "Pipeline",
  tasks: "Agenda",
  leads: "Leads",
  templates: "Mensagens prontas",
  conversations: "Conversas",
  whatsapp: "Conexao WhatsApp",
  settings: "Configuracoes",
};

export function getViewSubtitle(view: View) {
  if (view === "conversations") return "Mensagens salvas pelo webhook da Evolution.";
  if (view === "tasks") return "Tarefas comerciais, follow-ups e proximas acoes.";
  if (view === "whatsapp") return "Conecte a instancia OrigoCRM pelo QR Code.";
  if (view === "settings") return "Status das conexoes e proximos ajustes do CRM.";
  return "Cadencia continua: abrir, enviar, proximo.";
}
