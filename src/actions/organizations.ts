"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";
import { getPlanUserLimit } from "@/lib/plans";
import type { Organization, OrganizationInvitation, OrganizationMember, Subscription } from "@/lib/types";
import type { CrmRole } from "@/lib/permissions";

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type OrganizationContext = {
  organization: Organization;
  member: OrganizationMember;
  subscription: Subscription | null;
};

export type OrganizationMemberRow = Pick<
  OrganizationMember,
  "id" | "organization_id" | "user_id" | "role" | "status" | "created_at" | "updated_at"
>;

export type OrganizationInvitationRow = Pick<
  OrganizationInvitation,
  "id" | "organization_id" | "email" | "role" | "status" | "expires_at" | "created_at" | "updated_at"
>;

const inviteRoles: CrmRole[] = ["admin", "manager", "seller", "support", "viewer"];

function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidInviteEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function ensureOrganizationContext(): Promise<ActionResult<OrganizationContext>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  if (!auth.organizationId || !auth.organization || !auth.member) {
    return { success: false, error: "Base SaaS pendente. Aplique supabase/saas_base_migration.sql." };
  }

  const { data: subscription } = await auth.supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  return {
    success: true,
    data: {
      organization: auth.organization,
      member: auth.member,
      subscription: (subscription as Subscription | null) ?? null,
    },
  };
}

export async function listOrganizationMembers(): Promise<ActionResult<OrganizationMemberRow[]>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };

  if (!auth.organizationId) {
    return {
      success: true,
      data: [{
        id: auth.user.id,
        organization_id: "",
        user_id: auth.user.id,
        role: "owner",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
    };
  }

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };

  const { data, error } = await auth.supabase
    .from("organization_members")
    .select("id,organization_id,user_id,role,status,created_at,updated_at")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: true });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as OrganizationMemberRow[] | null) ?? [] };
}

export async function listOrganizationInvitations(): Promise<ActionResult<OrganizationInvitationRow[]>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };
  if (!auth.organizationId) return { success: true, data: [] };

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };

  const { data, error } = await auth.supabase
    .from("organization_invitations")
    .select("id,organization_id,email,role,status,expires_at,created_at,updated_at")
    .eq("organization_id", auth.organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data as OrganizationInvitationRow[] | null) ?? [] };
}

export async function createOrganizationInvitation(email: string, role: CrmRole): Promise<ActionResult<OrganizationInvitationRow>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };
  if (auth.member && !["owner", "admin"].includes(auth.member.role)) {
    return { success: false, error: "Apenas proprietário ou administrador pode convidar usuários." };
  }
  if (!auth.organizationId) return { success: false, error: "Base SaaS pendente." };
  if (!inviteRoles.includes(role)) return { success: false, error: "Escolha um papel válido para o convite." };

  const normalizedEmail = normalizeInviteEmail(email);
  if (!isValidInviteEmail(normalizedEmail)) return { success: false, error: "Informe um email válido." };
  if (auth.user.email && normalizedEmail === auth.user.email.toLowerCase()) return { success: false, error: "Este email já é o usuário logado." };

  const { data: subscription } = await auth.supabase
    .from("subscriptions")
    .select("plan_slug,seat_count")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  const currentSubscription = subscription as Pick<Subscription, "plan_slug" | "seat_count"> | null;
  const userLimit = getPlanUserLimit(currentSubscription?.plan_slug ?? "manual", currentSubscription?.seat_count);
  const [{ count: activeMembers }, { count: pendingInvites }] = await Promise.all([
    auth.supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId)
      .eq("status", "active"),
    auth.supabase
      .from("organization_invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  if ((activeMembers ?? 0) + (pendingInvites ?? 0) >= userLimit) {
    return { success: false, error: `Sua assinatura possui ${userLimit} assento(s) ativo(s).` };
  }

  const { data: existingInvite } = await auth.supabase
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) return { success: false, error: "Já existe um convite pendente para este email." };

  const { data, error } = await auth.supabase
    .from("organization_invitations")
    .insert({
      organization_id: auth.organizationId,
      email: normalizedEmail,
      role,
      status: "pending",
      invited_by_user_id: auth.user.id,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    })
    .select("id,organization_id,email,role,status,expires_at,created_at,updated_at")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data: data as OrganizationInvitationRow };
}

export async function cancelOrganizationInvitation(invitationId: string): Promise<ActionResult<OrganizationInvitationRow>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };
  if (auth.member && !["owner", "admin"].includes(auth.member.role)) {
    return { success: false, error: "Apenas proprietário ou administrador pode cancelar convites." };
  }
  if (!auth.organizationId) return { success: false, error: "Base SaaS pendente." };

  const { data, error } = await auth.supabase
    .from("organization_invitations")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("organization_id", auth.organizationId)
    .eq("status", "pending")
    .select("id,organization_id,email,role,status,expires_at,created_at,updated_at")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data: data as OrganizationInvitationRow };
}

export async function updateOrganizationMemberRole(memberId: string, role: CrmRole): Promise<ActionResult<OrganizationMemberRow>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };
  if (auth.member && !["owner", "admin"].includes(auth.member.role)) {
    return { success: false, error: "Apenas proprietário ou administrador pode alterar papéis da equipe." };
  }
  if (!auth.organizationId) return { success: false, error: "Base SaaS pendente." };

  const { data: currentMember, error: currentError } = await auth.supabase
    .from("organization_members")
    .select("id,organization_id,user_id,role,status")
    .eq("id", memberId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (currentError) return { success: false, error: currentError.message };
  if (!currentMember) return { success: false, error: "Membro não encontrado." };

  const current = currentMember as OrganizationMemberRow;
  if (current.role === "owner" && role !== "owner") {
    const { count } = await auth.supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId)
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) return { success: false, error: "A organização precisa manter pelo menos um proprietário ativo." };
  }

  const { data, error } = await auth.supabase
    .from("organization_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("organization_id", auth.organizationId)
    .select("id,organization_id,user_id,role,status,created_at,updated_at")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data: data as OrganizationMemberRow };
}

export async function disableOrganizationMember(memberId: string): Promise<ActionResult<OrganizationMemberRow>> {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" };

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return { success: false, error: permissionError };
  if (auth.member && !["owner", "admin"].includes(auth.member.role)) {
    return { success: false, error: "Apenas proprietário ou administrador pode desativar membros." };
  }
  if (!auth.organizationId) return { success: false, error: "Base SaaS pendente." };

  const { data: currentMember, error: currentError } = await auth.supabase
    .from("organization_members")
    .select("id,organization_id,user_id,role,status")
    .eq("id", memberId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (currentError) return { success: false, error: currentError.message };
  if (!currentMember) return { success: false, error: "Membro não encontrado." };

  const current = currentMember as OrganizationMemberRow;
  if (current.user_id === auth.user.id) return { success: false, error: "Você não pode desativar seu próprio acesso." };

  if (current.role === "owner") {
    const { count } = await auth.supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId)
      .eq("role", "owner")
      .eq("status", "active");

    if ((count ?? 0) <= 1) return { success: false, error: "A organização precisa manter pelo menos um proprietário ativo." };
  }

  const { data, error } = await auth.supabase
    .from("organization_members")
    .update({ status: "disabled", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("organization_id", auth.organizationId)
    .select("id,organization_id,user_id,role,status,created_at,updated_at")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true, data: data as OrganizationMemberRow };
}
