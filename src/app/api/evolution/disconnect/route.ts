import { NextResponse } from "next/server";

import {
  callEvolutionApi,
  getEvolutionInstanceEndpoint,
  getEvolutionServerConfig,
} from "@/lib/server/evolution";
import { createSupabaseServerClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, user };
}

export async function DELETE() {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ configured: false, error: "Nao autenticado" }, { status: 401 });
  }

  const config = getEvolutionServerConfig();
  const endpoint = getEvolutionInstanceEndpoint("/instance/logout");

  if (!config || !endpoint) {
    return NextResponse.json({
      configured: false,
      disconnected: false,
      error: "Evolution API nao configurada",
    });
  }

  const response = await callEvolutionApi<Record<string, unknown>>(endpoint, undefined, "DELETE");

  if (response.error || response.status >= 400) {
    return NextResponse.json(
      {
        configured: true,
        disconnected: false,
        instanceName: config.instanceName?.trim() ?? "",
        error: response.error ?? "Nao foi possivel desconectar a Evolution",
      },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }

  await auth.supabase.from("audit_logs").insert({
    user_id: auth.user.id,
    entity_type: "whatsapp",
    action: "whatsapp.disconnected",
    summary: "WhatsApp desconectado",
    metadata: { instanceName: config.instanceName?.trim() ?? "" },
  });

  return NextResponse.json({
    configured: true,
    disconnected: true,
    instanceName: config.instanceName?.trim() ?? "",
  });
}
