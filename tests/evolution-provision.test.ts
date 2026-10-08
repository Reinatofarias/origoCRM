import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({
  createSupabaseServiceRoleClient: () => null,
  createSupabaseServerClient: async () => null,
}));

const { provisionEvolutionInstance } = await import("../src/lib/server/evolution");

describe("provisionamento da instância na Evolution v2", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("EVOLUTION_API_URL", "https://evo.exemplo.com");
    vi.stubEnv("EVOLUTION_API_KEY", "chave-global");
    vi.stubEnv("EVOLUTION_WEBHOOK_KEY", "chave-webhook");
    vi.stubEnv("APP_URL", "https://crm.exemplo.com/");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("registra o webhook no formato aninhado da v2, com a chave no header", async () => {
    const result = await provisionEvolutionInstance("origo-teste");

    expect(result).toEqual({ success: true, error: null });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://evo.exemplo.com/webhook/set/origo-teste");
    expect(JSON.parse(init.body as string)).toEqual({
      webhook: {
        enabled: true,
        url: "https://crm.exemplo.com/api/webhooks/evolution",
        headers: { authorization: "Bearer chave-webhook" },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    });
  });
});
