export function buildWhatsAppInstanceName(organizationId: string) {
  const normalizedOrganizationId = organizationId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalizedOrganizationId) throw new Error("Organização inválida para instância WhatsApp.");
  return `origo_${normalizedOrganizationId.slice(0, 24)}`;
}
