import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  getEvolutionServerConfig,
} from "@/lib/server/evolution";
import { createSupabaseServerClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

type EvolutionConnectionStateResponse = {
  instance?: {
    state?: string;
  };
  state?: string;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ configured: false, error: "Nao autenticado" }, { status: 401 });
  }

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
    undefined,
    "GET",
  );

  if (response.error || !response.data) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        instanceName: config.instanceName?.trim() ?? "",
        state: "error",
        error: response.error ?? "Nao foi possivel consultar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  const state = response.data.instance?.state ?? response.data.state ?? "unknown";

  return NextResponse.json({
    configured: true,
    connected: ["open", "connected"].includes(state),
    instanceName: config.instanceName?.trim() ?? "",
    state,
  });
}
