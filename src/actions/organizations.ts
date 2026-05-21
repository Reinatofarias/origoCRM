"use server";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { Organization, OrganizationMember, Subscription } from "@/lib/types";

type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type OrganizationContext = {
  organization: Organization;
  member: OrganizationMember;
  subscription?: Subscription | null;
};

function getDefaultOrganizationName(email?: string | null) {
  const prefix = email?.split("@")[0]?.trim();
  return `${prefix || "Minha empresa"} - OrigoCRM`;
}

async function getAuthenticatedSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase nao configurado" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: "Sessao expirada. Entre novamente." };

  return { supabase, user };
}

export async function ensureOrganizationContext(): Promise<ActionResult<OrganizationContext>> {
  const auth = await getAuthenticatedSupabase();
  if ("error" in auth) return { success: false, error: auth.error };

  const { data: membership, error: membershipError } = await auth.supabase
    .from("organization_members")
    .select("*, organizations(*), subscriptions(*)")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError && !membershipError.message.includes("relation")) {
    return { success: false, error: membershipError.message };
  }

  if (membership) {
    const row = membership as OrganizationMember & {
      organizations?: Organization | null;
      subscriptions?: Subscription[] | Subscription | null;
    };
    const subscription = Array.isArray(row.subscriptions) ? row.subscriptions[0] : row.subscriptions;
    if (row.organizations) {
      return {
        success: true,
        data: {
          organization: row.organizations,
          member: row,
          subscription: subscription ?? null,
        },
      };
    }
  }

  const { data: organization, error: organizationError } = await auth.supabase
    .from("organizations")
    .insert({
      name: getDefaultOrganizationName(auth.user.email),
      owner_user_id: auth.user.id,
      slug: `org-${auth.user.id.replaceAll("-", "")}`,
    })
    .select()
    .single();

  if (organizationError) {
    return {
      success: false,
      error: organizationError.message.includes("relation")
        ? "Aplique supabase/saas_base_migration.sql para ativar organizacoes."
        : organizationError.message,
    };
  }

  const org = organization as Organization;
  const { data: member, error: memberError } = await auth.supabase
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: auth.user.id,
      role: "owner",
      status: "active",
    })
    .select()
    .single();

  if (memberError) return { success: false, error: memberError.message };

  const { data: subscription } = await auth.supabase
    .from("subscriptions")
    .upsert({
      organization_id: org.id,
      plan_slug: "manual",
      billing_period: "monthly",
      status: "trialing",
      provider: "manual",
    }, { onConflict: "organization_id" })
    .select()
    .single();

  return {
    success: true,
    data: {
      organization: org,
      member: member as OrganizationMember,
      subscription: (subscription as Subscription | null) ?? null,
    },
  };
}
