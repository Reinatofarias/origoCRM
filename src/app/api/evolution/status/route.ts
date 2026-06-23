import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpointForName,
  getEvolutionServerConfig,
  getWhatsAppInstanceByOrganization,
  updateWhatsAppInstance,
} from "@/lib/server/evolution";
import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type EvolutionConnectionStateResponse = {
  instance?: {
    ownerJid?: string;
    profileName?: string;
    state?: string;
  };
  ownerJid?: string;
  profileName?: string;
  number?: string;
  state?: string;
};

export async function GET() {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, error: "Não autenticado" }, { status: 401 });
  }

  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) {
    return NextResponse.json({ configured: true, connected: false, state: "forbidden", error: permissionError }, { status: 403 });
  }

  const config = getEvolutionServerConfig();
  if (!config || !auth.organizationId) {
    return NextResponse.json({
      configured: false,
      connected: false,
      state: "not_configured",
    });
  }

  const { instance, error: instanceError } = await getWhatsAppInstanceByOrganization(auth.organizationId);
  if (!instance) {
    return NextResponse.json({
      configured: true,
      connected: false,
      state: "not_created",
      error: instanceError ?? null,
    });
  }

  const endpoint = getEvolutionInstanceEndpointForName("/instance/connectionState", instance.instance_name);
  if (!endpoint) {
    return NextResponse.json({ configured: true, connected: false, state: "invalid_instance" }, { status: 400 });
  }

  const response = await callEvolutionApi<EvolutionConnectionStateResponse>(endpoint, {}, "GET");

  if (response.error || !response.data) {
    await updateWhatsAppInstance(instance.instance_name, { status: "error", last_error: response.error ?? "Erro ao consultar Evolution" });
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        instanceName: instance.instance_name,
        state: "error",
        error: response.error ?? "Não foi possível consultar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  const state = (response.data.instance?.state ?? response.data.state ?? "unknown").trim().toLowerCase();
  const phoneNumber = normalizeOwnerPhone(
    response.data.instance?.ownerJid ?? response.data.ownerJid ?? response.data.number ?? "",
  );
  const profileName = response.data.instance?.profileName ?? response.data.profileName ?? null;
  const connected = ["open", "connected"].includes(state);

  await updateWhatsAppInstance(instance.instance_name, {
    status: connected ? "connected" : state,
    phone_number: phoneNumber,
    profile_name: profileName,
    last_error: null,
    connected_at: connected ? new Date().toISOString() : instance.connected_at,
  });

  return NextResponse.json({
    configured: true,
    connected,
    instanceName: instance.instance_name,
    phoneNumber,
    profileName,
    state,
  });
}

function normalizeOwnerPhone(value: string) {
  if (!value) return null;
  return value.split("@")[0].replace(/\D/g, "") || null;
}
