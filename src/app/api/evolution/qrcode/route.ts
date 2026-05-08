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
  qrcode?:
    | string
    | {
        base64?: string;
        code?: string;
        pairingCode?: string | null;
        count?: number;
      };
  qr?: string;
  status?: string;
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

  const qrCode = normalizeQrCodeResponse(response.data);

  if (!qrCode.base64 && !qrCode.code && !qrCode.pairingCode) {
    return NextResponse.json(
      {
        configured: true,
        instanceName: config.instanceName?.trim() ?? "",
        count: qrCode.count,
        state: qrCode.state,
        error:
          "A Evolution respondeu sem QR Code. Verifique se a instancia existe e nao esta presa em connecting.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    configured: true,
    instanceName: config.instanceName?.trim() ?? "",
    base64: qrCode.base64,
    code: qrCode.code,
    pairingCode: qrCode.pairingCode,
    count: qrCode.count,
    state: qrCode.state,
  });
}

function normalizeQrCodeResponse(data: EvolutionQrCodeResponse) {
  const qrcode = data.qrcode;
  const nested = qrcode && typeof qrcode === "object" ? qrcode : null;
  const rawBase64 =
    data.base64 ??
    nested?.base64 ??
    (typeof qrcode === "string" && qrcode.startsWith("data:image") ? qrcode : undefined) ??
    (data.qr?.startsWith("data:image") ? data.qr : undefined);

  return {
    base64: formatQrCodeDataUrl(rawBase64),
    code: data.code ?? nested?.code ?? (typeof qrcode === "string" ? qrcode : undefined),
    pairingCode: data.pairingCode ?? nested?.pairingCode ?? null,
    count: data.count ?? nested?.count,
    state: data.state ?? data.status,
  };
}

function formatQrCodeDataUrl(value?: string) {
  if (!value) return undefined;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
}
