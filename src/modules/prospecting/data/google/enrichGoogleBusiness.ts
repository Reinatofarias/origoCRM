import type { EnrichedCompany, ProspectBusiness } from "../../types";

export async function enrichGoogleBusiness(business: ProspectBusiness): Promise<EnrichedCompany> {
  const firstName = business.name.split(" ")[0] || business.name;
  const hasSite = Boolean(business.website);
  const ratingText = business.rating ? `${business.rating.toFixed(1)} estrelas` : "sem avaliação pública";

  return {
    business,
    recommendedLead: {
      name: business.name,
      phone: business.phone ?? "",
      company: business.name,
      source: "Prospecção Inteligente",
      status: "novo",
      estimated_value: business.leadScore && business.leadScore >= 85 ? 4500 : 2200,
      owner_name: "",
      temperature: business.leadScore && business.leadScore >= 85 ? "quente" : "morno",
      outcome_reason: "",
      sla_hours: 24,
    },
    approach: `Olá, ${firstName}. Vi o perfil da ${business.name} no Google Maps e notei que vocês têm ${ratingText}${hasSite ? " e presença digital ativa" : ", mas ainda sem site visível"}. Acredito que conseguimos ajudar a transformar buscas locais em conversas qualificadas no WhatsApp. Posso te mostrar uma ideia rápida?`,
  };
}
