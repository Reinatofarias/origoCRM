import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  getEvolutionServerConfig,
} from "@/lib/server/evolution";
import { getAuthenticatedOrganizationContext, requireServerPermission, withOrganizationId } from "@/lib/server/auth";
import { enforceRateLimit, rateLimitJson } from "@/lib/server/security";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, error: "Não autenticado" }, { status: 401 });
  }
  const permissionError = requireServerPermission(auth, "whatsapp:manage");
  if (permissionError) return NextResponse.json({ configured: true, disconnected: false, error: permissionError }, { status: 403 });
  const rateLimit = await enforceRateLimit({
    request,
    scope: "evolution.disconnect",
    identifier: auth.organizationId ?? auth.user.id,
    limit: 5,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) return rateLimitJson(rateLimit);

  const config = getEvolutionServerConfig();
  const endpoint = getEvolutionInstanceEndpoint("/instance/logout");

  if (!config || !endpoint) {
    return NextResponse.json({
      configured: false,
      disconnected: false,
      error: "Evolution API não configurada",
    });
  }

  const response = await callEvolutionApi<Record<string, unknown>>(endpoint, {}, "DELETE");

  if (response.error || response.status >= 400) {
    return NextResponse.json(
      {
        configured: true,
        disconnected: false,
        instanceName: config.instanceName?.trim() ?? "",
        error: response.error ?? "Não foi possível desconectar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  await auth.supabase.from("audit_logs").insert(withOrganizationId({
    user_id: auth.user.id,
    entity_type: "whatsapp",
    action: "whatsapp.disconnected",
    summary: "WhatsApp desconectado",
    metadata: { instanceName: config.instanceName?.trim() ?? "" },
  }, auth.organizationId));

  return NextResponse.json({
    configured: true,
    disconnected: true,
    instanceName: config.instanceName?.trim() ?? "",
  });
}
