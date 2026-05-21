import "server-only";

import { createSupabaseServerClient } from "./supabase";
import type { Organization, OrganizationMember } from "@/lib/types";

function defaultOrganizationName(email?: string | null) {
  const prefix = email?.split("@")[0]?.trim();
  return `${prefix || "Minha empresa"} - OrigoCRM`;
}

function isMissingSaasTableError(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("organization_members") ||
    normalized.includes("organizations") ||
    normalized.includes("subscriptions")
  );
}

export async function getAuthenticatedOrganizationContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase nao configurado" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: "Sessao expirada. Entre novamente." };

  const { data: membership, error: membershipError } = await supabase
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

  if (membership) {
    const row = membership as OrganizationMember & { organizations?: Organization | null };
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

export function withOrganizationId<T extends object>(payload: T, organizationId?: string | null) {
  return organizationId ? { ...payload, organization_id: organizationId } : payload;
}
