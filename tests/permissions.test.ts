import { describe, expect, it } from "vitest";

import { can } from "../src/lib/permissions";

describe("permissões por perfil", () => {
  it("reserva cobrança e exclusão ao owner/admin", () => {
    expect(can("owner", "billing:manage")).toBe(true);
    expect(can("admin", "billing:manage")).toBe(true);
    expect(can("manager", "billing:manage")).toBe(false);
    expect(can("seller", "lead:delete")).toBe(false);
  });

  it("mantém atendimento restrito à operação de conversas e tarefas", () => {
    expect(can("support", "conversation:send")).toBe(true);
    expect(can("support", "task:manage")).toBe(true);
    expect(can("support", "pipeline:update")).toBe(false);
    expect(can("viewer", "conversation:send")).toBe(false);
  });
});
