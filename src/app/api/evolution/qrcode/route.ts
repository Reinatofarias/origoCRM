import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  getEvolutionServerConfig,
} from "@/lib/server/evolution";
import { createSupabaseServerClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

type EvolutionQrCodeResponse = {
  base64?: string;
  code?: string;
  pairingCode?: string | null;
  count?: number;
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
  const endpoint = getEvolutionInstanceEndpoint("/instance/connect");

  if (!config || !endpoint) {
    return NextResponse.json({
      configured: false,
      error: "Evolution API nao configurada",
    });
  }

  const response = await callEvolutionApi<EvolutionQrCodeResponse>(endpoint, undefined, "GET");

  if (response.error || !response.data) {
    return NextResponse.json(
      {
        configured: true,
        error: response.error ?? "Nao foi possivel gerar QR Code",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  return NextResponse.json({
    configured: true,
    instanceName: config.instanceName?.trim() ?? "",
    base64: response.data.base64,
    code: response.data.code,
    pairingCode: response.data.pairingCode,
    count: response.data.count,
  });
}
