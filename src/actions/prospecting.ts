"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature, withOrganizationId } from "@/lib/server/auth";
import type { ProspectingCampaignInput } from "@/lib/types";

type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createProspectingCampaign(input: ProspectingCampaignInput) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) return { success: false, error: auth.error ?? "Não autenticado" } satisfies ActionResult;
  const permissionError = requireServerPermission(auth, "prospecting:use");
  if (permissionError) return { success: false, error: permissionError } satisfies ActionResult;
  const planError = await requireServerPlanFeature(auth, "campaigns");
  if (planError) return { success: false, error: planError } satisfies ActionResult;

  const { data: campaign, error } = await auth.supabase
    .from("prospecting_campaigns")
    .insert(withOrganizationId({
      user_id: auth.user.id,
      name: input.name.trim() || "Campanha de prospecção",
      niche: input.niche ?? "",
      state: input.state ?? "",
      city: input.city ?? "",
      template_id: input.template_id ?? null,
      total_contacts: input.total_contacts,
      whatsapp_validated_count: input.whatsapp_validated_count,
      sent_count: input.sent_count,
      failed_count: input.failed_count,
      ignored_count: input.ignored_count,
      status: input.status ?? "completed",
    }, auth.organizationId))
    .select()
    .single();

  if (error) return { success: false, error: error.message } satisfies ActionResult;

  const campaignId = (campaign as { id: string }).id;
  if (input.contacts.length > 0) {
    const { error: contactsError } = await auth.supabase.from("prospecting_campaign_contacts").insert(
      input.contacts.map((contact) => withOrganizationId({
        campaign_id: campaignId,
        user_id: auth.user.id,
        business_name: contact.business_name,
        phone: contact.phone,
        category: contact.category ?? "",
        city: contact.city ?? "",
        state: contact.state ?? "",
        lead_score: contact.lead_score ?? null,
        dispatch_status: contact.dispatch_status,
        message: contact.message ?? null,
        error: contact.error ?? null,
        sent_at: contact.sent_at ?? null,
      }, auth.organizationId)),
    );

    if (contactsError) return { success: false, error: contactsError.message } satisfies ActionResult;
  }

  revalidatePath("/");
  return { success: true, data: campaign } satisfies ActionResult;
}
