import "server-only";

import { createSupabaseServerClient } from "./supabase";
import { can, type CrmPermission } from "@/lib/permissions";
import { planHasFeature, type PlanFeature } from "@/lib/plans";
import type { Organization, OrganizationMember } from "@/lib/types";

function defaultOrganizationName(email?: string | null) {
  const prefix = (email ?? "").split("@")[0].trim();
  return `${prefix || "Minha empresa"} - OrigoCRM`;
}

function isMissingSaasTableError(message: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("organization_members") ||
    normalized.includes("organizations") ||
    normalized.includes("subscriptions") ||
    normalized.includes("organization_invitations")
  );
}

async function acceptPendingInvitation(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, user: { id: string; email?: string | null }) {
  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email) return null;

  const { data: invitation, error: invitationError } = await supabase
    .from("organization_invitations")
    .select("id,organization_id,email,role,status,expires_at")
    .eq("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (invitationError && isMissingSaasTableError(invitationError.message)) return null;
  if (invitationError || !invitation) return null;

  const invite = invitation as { id: string; organization_id: string; role: OrganizationMember["role"] };
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role,
      status: "active",
    })
    .select()
    .single();

  if (memberError) return null;

  await supabase
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_user_id: user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  return member as OrganizationMember;
}

export async function getAuthenticatedOrganizationContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase não configurado" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: "Sessão expirada. Entre novamente." };

  let { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("*, organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError && isMissingSaasTableError(membershipError.message)) {
    return { supabase, user, organizationId: null as string | null, member: null as OrganizationMember | null };
  }

  if (membershipError) return { error: membershipError.message };

  if (!membership) {
    await acceptPendingInvitation(supabase, user);
    const accepted = await supabase
      .from("organization_members")
      .select("*, organizations(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    membership = accepted.data;
    membershipError = accepted.error;
    if (membershipError) return { error: membershipError.message };
  }

  if (membership) {
    const row = membership as OrganizationMember & { organizations: Organization | null };
    return {
      supabase,
      user,
      organizationId: row.organization_id,
      organization: row.organizations ?? null,
      member: row,
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: defaultOrganizationName(user.email),
      owner_user_id: user.id,
      slug: `org-${user.id.replaceAll("-", "")}`,
    })
    .select()
    .single();

  if (organizationError) return { error: organizationError.message };

  const org = organization as Organization;
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    })
    .select()
    .single();

  if (memberError) return { error: memberError.message };

  await supabase.from("subscriptions").upsert({
    organization_id: org.id,
    plan_slug: "manual",
    billing_period: "monthly",
    status: "trialing",
    provider: "manual",
  }, { onConflict: "organization_id" });

  return {
    supabase,
    user,
    organizationId: org.id,
    organization: org,
    member: member as OrganizationMember,
  };
}

export function withOrganizationId<T extends object>(payload: T, organizationId: string | null) {
  return organizationId ? { ...payload, organization_id: organizationId } : payload;
}

type AuthenticatedOrganizationContext = Exclude<Awaited<ReturnType<typeof getAuthenticatedOrganizationContext>>, { error: string }>;

export function hasServerPermission(auth: AuthenticatedOrganizationContext, permission: CrmPermission) {
  if (!auth.organizationId || !auth.member) return true;
  return can(auth.member.role, permission);
}

export function requireServerPermission(auth: AuthenticatedOrganizationContext, permission: CrmPermission) {
  if (hasServerPermission(auth, permission)) return null;
  return "Você não tem permissão para executar esta ação.";
}

const planFeatureLabels: Record<PlanFeature, string> = {
  crm: "CRM",
  conversations: "Conversas WhatsApp",
  tasks: "Tarefas",
  templates: "Mensagens prontas",
  prospecting: "Prospecção",
  campaigns: "Campanhas",
  googleCalendar: "Google Calendar",
  team: "Equipe",
  advancedDashboard: "Dashboard avançado",
};

export async function requireServerPlanFeature(auth: AuthenticatedOrganizationContext, feature: PlanFeature) {
  if (!auth.organizationId) return null;

  const { data, error } = await auth.supabase
    .from("subscriptions")
    .select("plan_slug,status,provider")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (error) return "Não foi possível validar o plano da organização.";

  const subscription = data as { plan_slug: string | null; status: string | null; provider: string | null } | null;
  if (!subscription) return "Assinatura não encontrada para esta organização.";
  if (subscription.plan_slug === "manual" || subscription.provider === "manual") return null;

  if (!["active", "trialing"].includes(subscription.status ?? "")) {
    return "A assinatura precisa estar ativa para usar este recurso.";
  }

  if (!planHasFeature(subscription.plan_slug as Parameters<typeof planHasFeature>[0], feature)) {
    return `Seu plano atual não inclui ${planFeatureLabels[feature]}.`;
  }

  return null;
}
