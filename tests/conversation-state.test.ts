import { describe, expect, it } from "vitest";

import {
  applyMessageRealtimeEvent,
  conversationStatus,
  countPendingInboundMessages,
  getSafeConversationContactName,
} from "../src/components/crm/conversation-state";
import type { WhatsAppMessage } from "../src/lib/types";

function message(input: Partial<WhatsAppMessage> & Pick<WhatsAppMessage, "id" | "created_at" | "direction">): WhatsAppMessage {
  return {
    contact_avatar_url: null,
    contact_name: null,
    content: "Mensagem",
    lead_id: null,
    media_url: null,
    message_id: input.id,
    organization_id: "org-1",
    phone_number: "5511999999999",
    remote_jid: "5511999999999@s.whatsapp.net",
    status: "sent",
    updated_at: input.created_at,
    user_id: "user-1",
    whatsapp_instance_id: null,
    ...input,
  };
}

describe("estado operacional das conversas", () => {
  it("aplica atualização realtime de entrega sem duplicar mensagem", () => {
    const original = message({ id: "m1", created_at: "2026-06-29T10:00:00.000Z", direction: "outbound" });
    const delivered = { ...original, status: "delivered" as const };
    const result = applyMessageRealtimeEvent([original], { eventType: "UPDATE", new: delivered, old: original });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("delivered");
  });

  it("conta apenas entradas posteriores à última saída", () => {
    const messages = [
      message({ id: "m1", created_at: "2026-06-29T10:00:00.000Z", direction: "inbound" }),
      message({ id: "m2", created_at: "2026-06-29T10:05:00.000Z", direction: "outbound" }),
      message({ id: "m3", created_at: "2026-06-29T10:10:00.000Z", direction: "inbound" }),
    ];
    expect(countPendingInboundMessages(messages)).toBe(1);
  });

  it("prioriza estados resolvido/arquivado e identifica espera", () => {
    expect(conversationStatus("inbound", false, 0, "resolved")).toBe("resolved");
    expect(conversationStatus("outbound", false, 0, null)).toBe("waiting");
    expect(conversationStatus("inbound", true, 0, null)).toBe("converted");
  });

  it("descarta nome de saída repetido usado incorretamente como contato", () => {
    expect(getSafeConversationContactName("Renato", new Set(["renato"]))).toBeNull();
    expect(getSafeConversationContactName("Cliente", new Set(["renato"]))).toBe("Cliente");
  });
});
