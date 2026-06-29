import { describe, expect, it } from "vitest";

import { buildWhatsAppInstanceName } from "../src/lib/whatsapp-instances";

describe("isolamento de instâncias WhatsApp", () => {
  it("gera nomes estáveis e distintos por organização", () => {
    const first = buildWhatsAppInstanceName("11111111-1111-4111-8111-111111111111");
    const second = buildWhatsAppInstanceName("22222222-2222-4222-8222-222222222222");

    expect(first).toBe("origo_111111111111411181111111");
    expect(second).toBe("origo_222222222222422282222222");
    expect(first).not.toBe(second);
  });

  it("rejeita identificador vazio", () => {
    expect(() => buildWhatsAppInstanceName("---")).toThrow(/Organização inválida/);
  });
});
