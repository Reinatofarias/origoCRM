import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  getEvolutionServerConfig,
} from "@/lib/server/evolution";
import { getAuthenticatedOrganizationContext, requireServerPermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

type EvolutionConnectionStateResponse = {
  instance: {
    ownerJid: string;
    profileName: string;
    state: string;
  };
  ownerJid: string;
  profileName: string;
  number: string;
  state: string;
};

export async function GET() {
  const auth = await getAuthenticatedOrganizationContext();
  if ("error" in auth) {
    return NextResponse.json({ configured: false, error: "Não autenticado" }, { status: 401 });
  }
  const permissionError = requireServerPermission(auth, "settings:manage");
  if (permissionError) return NextResponse.json({ configured: true, connected: false, state: "forbidden", error: permissionError }, { status: 403 });

  const config = getEvolutionServerConfig();
  const endpoint = getEvolutionInstanceEndpoint("/instance/connectionState");

  if (!config || !endpoint) {
    return NextResponse.json({
      configured: false,
      connected: false,
      state: "not_configured",
    });
  }

  const response = await callEvolutionApi<EvolutionConnectionStateResponse>(
    endpoint,
    {},
    "GET",
  );

  if (response.error || !response.data) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        instanceName: config.instanceName?.trim() ?? "",
        state: "error",
        error: response.error ?? "Não foi possível consultar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  const state = (response.data.instance.state ?? response.data.state ?? "unknown")
    .trim()
    .toLowerCase();

  return NextResponse.json({
    configured: true,
    connected: ["open", "connected"].includes(state),
    instanceName: config.instanceName?.trim() ?? "",
    phoneNumber: normalizeOwnerPhone(
      response.data.instance.ownerJid ?? response.data.ownerJid ?? response.data.number,
    ),
    profileName: response.data.instance.profileName ?? response.data.profileName ?? null,
    state,
  });
}

function normalizeOwnerPhone(value: string) {
  if (!value) return null;
  return value.split("@")[0].replace(/\D/g, "") || null;
}
