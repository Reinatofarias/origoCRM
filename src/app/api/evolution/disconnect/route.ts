import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpointForName,
  getEvolutionServerConfig,
  getWhatsAppInstanceByOrganization,
  updateWhatsAppInstance,
} from "@/lib/server/evolution";
import { getAuthenticatedOrganizationContext, requireServerPermission, requireServerPlanFeature, withOrganizationId } from "@/lib/server/auth";
import { enforceRateLimit, rateLimitJson } from "@/lib/server/security";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, error: "Não autenticado" }, { status: 401 });
  }

  const permissionError = requireServerPermission(auth, "whatsapp:manage");
  if (permissionError) return NextResponse.json({ configured: true, disconnected: false, error: permissionError }, { status: 403 });

  const planError = await requireServerPlanFeature(auth, "conversations");
  if (planError) return NextResponse.json({ configured: true, disconnected: false, error: planError }, { status: 402 });

  const rateLimit = await enforceRateLimit({
    request,
    scope: "evolution.disconnect",
    identifier: auth.organizationId ?? auth.user.id,
    limit: 5,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);

  const config = getEvolutionServerConfig();
  if (!config || !auth.organizationId) {
    return NextResponse.json({
      configured: false,
      disconnected: false,
      error: "Evolution API não configurada",
    });
  }

  const { instance, error: instanceError } = await getWhatsAppInstanceByOrganization(auth.organizationId);
  if (!instance) {
    return NextResponse.json({
      configured: true,
      disconnected: false,
      error: instanceError ?? "Instância WhatsApp não encontrada",
    }, { status: 400 });
  }

  const endpoint = getEvolutionInstanceEndpointForName("/instance/logout", instance.instance_name);
  const response = endpoint
    ? await callEvolutionApi<Record<string, unknown>>(endpoint, {}, "DELETE")
    : { status: 400, error: "Instância inválida" };

  if (response.error || response.status >= 400) {
    await updateWhatsAppInstance(instance.instance_name, { status: "error", last_error: response.error ?? "Erro ao desconectar" });
    return NextResponse.json(
      {
        configured: true,
        disconnected: false,
        instanceName: instance.instance_name,
        error: response.error ?? "Não foi possível desconectar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  await updateWhatsAppInstance(instance.instance_name, {
    status: "disconnected",
    disconnected_at: new Date().toISOString(),
    last_error: null,
  });

  await auth.supabase.from("audit_logs").insert(withOrganizationId({
    user_id: auth.user.id,
    entity_type: "whatsapp",
    action: "whatsapp.disconnected",
    summary: "WhatsApp desconectado",
    metadata: { instanceName: instance.instance_name },
  }, auth.organizationId));

  return NextResponse.json({
    configured: true,
    disconnected: true,
    instanceName: instance.instance_name,
  });
}
