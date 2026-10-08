import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({
  createSupabaseServiceRoleClient: () => null,
  createSupabaseServerClient: async () => null,
}));

const { validateEvolutionWebhook } = await import("../src/lib/server/evolution");

describe("assinatura do webhook da Evolution", () => {
  const original = process.env.EVOLUTION_WEBHOOK_KEY;

  beforeEach(() => {
    process.env.EVOLUTION_WEBHOOK_KEY = "chave-secreta";
  });

  afterEach(() => {
    process.env.EVOLUTION_WEBHOOK_KEY = original;
  });

  it("aceita a chave pura ou com Bearer", () => {
    expect(validateEvolutionWebhook("chave-secreta")).toBe(true);
    expect(validateEvolutionWebhook("Bearer chave-secreta")).toBe(true);
  });

  it("recusa chave errada ou vazia", () => {
    expect(validateEvolutionWebhook("chave-errada")).toBe(false);
    expect(validateEvolutionWebhook("")).toBe(false);
  });

  it("recusa tudo quando EVOLUTION_WEBHOOK_KEY não está configurada", () => {
    delete process.env.EVOLUTION_WEBHOOK_KEY;
    expect(validateEvolutionWebhook("qualquer")).toBe(false);
  });
});
