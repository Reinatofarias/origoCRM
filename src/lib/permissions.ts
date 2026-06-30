import type { OrganizationMember } from "./types";

export type CrmRole = OrganizationMember["role"];

export type CrmPermission =
  | "lead:create"
  | "lead:update"
  | "lead:delete"
  | "pipeline:update"
  | "conversation:update"
  | "conversation:send"
  | "task:manage"
  | "template:manage"
  | "prospecting:use"
  | "whatsapp:manage"
  | "settings:manage"
  | "billing:manage";

const rolePermissions: Record<CrmRole, CrmPermission[]> = {
  owner: [
    "lead:create",
    "lead:update",
    "lead:delete",
    "pipeline:update",
    "conversation:update",
    "conversation:send",
    "task:manage",
    "template:manage",
    "prospecting:use",
    "whatsapp:manage",
    "settings:manage",
    "billing:manage",
  ],
  admin: [
    "lead:create",
    "lead:update",
    "lead:delete",
    "pipeline:update",
    "conversation:update",
    "conversation:send",
    "task:manage",
    "template:manage",
    "prospecting:use",
    "whatsapp:manage",
    "settings:manage",
    "billing:manage",
  ],
  manager: [
    "lead:create",
    "lead:update",
    "pipeline:update",
    "conversation:update",
    "conversation:send",
    "task:manage",
    "template:manage",
    "prospecting:use",
    "settings:manage",
  ],
  seller: ["lead:create", "lead:update", "conversation:update", "conversation:send", "task:manage", "template:manage", "prospecting:use"],
  support: ["conversation:update", "conversation:send", "task:manage", "template:manage"],
  viewer: [],
};

export const crmRoleLabels: Record<CrmRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  seller: "Vendedor",
  support: "Atendimento",
  viewer: "Leitura",
};

export const crmPermissionLabels: Record<CrmPermission, string> = {
  "lead:create": "Criar lead",
  "lead:update": "Editar lead",
  "lead:delete": "Excluir lead",
  "pipeline:update": "Alterar funil",
  "conversation:update": "Atualizar conversas",
  "conversation:send": "Enviar mensagens",
  "task:manage": "Gerenciar tarefas",
  "template:manage": "Gerenciar mensagens",
  "prospecting:use": "Usar prospecção",
  "whatsapp:manage": "Gerenciar WhatsApp",
  "settings:manage": "Gerenciar configurações",
  "billing:manage": "Gerenciar assinatura",
};

export function getPermissionsForRole(role: CrmRole | null | undefined) {
  return new Set(rolePermissions[role ?? "viewer"] ?? []);
}

export function can(role: CrmRole | null | undefined, permission: CrmPermission) {
  return getPermissionsForRole(role).has(permission);
}
