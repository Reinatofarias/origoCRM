import { normalizePhone } from "@/lib/utils";

export function openWhatsAppLink(phoneNumber: string, message: string): void {
  const normalizedPhone = normalizePhone(phoneNumber);
  const whatsappLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

  window.open(whatsappLink, "_blank", "noopener,noreferrer");
}

export function isEvolutionConfigured(): boolean {
  return process.env.NEXT_PUBLIC_EVOLUTION_ENABLED === "true";
}

export function getEvolutionWebhookUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appUrl.replace(/\/+$/, "")}/api/webhooks/evolution`;
}

export function validateEvolutionSetup(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isEvolutionConfigured()) {
    errors.push("NEXT_PUBLIC_EVOLUTION_ENABLED precisa ser true para mostrar a integracao na UI");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatPhoneForWhatsApp(phone: string, countryCode = "55"): string {
  const normalized = normalizePhone(phone);

  if (normalized.startsWith(countryCode)) {
    return normalized;
  }

  const cleaned = normalized.startsWith("0") ? normalized.slice(1) : normalized;
  return `${countryCode}${cleaned}`;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  status: "pending" | "sent" | "delivered" | "read";
}
