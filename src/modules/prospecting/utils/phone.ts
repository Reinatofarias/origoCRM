import { normalizePhone } from "@/lib/utils";

export function normalizeProspectingWhatsAppPhone(phone: string | null) {
  const normalized = normalizePhone(phone ?? "");
  if (!normalized) return "";
  if (normalized.startsWith("55")) return normalized;
  if (normalized.length === 10 || normalized.length === 11) return `55${normalized}`;
  return normalized;
}
