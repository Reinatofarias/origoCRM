import type { ProspectBusiness, ProspectingSearchInput, ProspectingSearchResult } from "../../types";

const MOCK_GOOGLE_BUSINESSES: ProspectBusiness[] = [
  {
    id: "gm-origo-001",
    name: "Clínica Lumina Estética Avançada",
    category: "Clínica de estética",
    phone: "8199142-7782",
    website: "https://clinicalumina.com.br",
    address: "Av. Boa Viagem, 1220 - Recife, PE",
    city: "Recife",
    state: "PE",
    rating: 4.8,
    reviewsCount: 326,
    businessStatus: "operational",
    photoUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80",
    googleMapsUrl: "https://maps.google.com/?q=Clinica+Lumina+Estetica+Recife",
    leadScore: 91,
    sourceProvider: "outscraper",
    signals: [
      { id: "hot", label: "Lead Quente", tone: "hot" },
      { id: "reviews", label: "Prova social forte", tone: "positive" },
    ],
  },
  {
    id: "gm-origo-002",
    name: "Solar Prime Engenharia",
    category: "Energia solar",
    phone: "1197755-4310",
    website: "",
    address: "Rua Vergueiro, 2045 - São Paulo, SP",
    city: "São Paulo",
    state: "SP",
    rating: 4.2,
    reviewsCount: 42,
    businessStatus: "weak_profile",
    photoUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=80",
    googleMapsUrl: "https://maps.google.com/?q=Solar+Prime+Engenharia+Sao+Paulo",
    leadScore: 83,
    sourceProvider: "outscraper",
    signals: [
      { id: "hot", label: "Lead Quente", tone: "hot" },
      { id: "no-site", label: "Empresa sem site", tone: "warning" },
      { id: "gmb", label: "Google Meu Negócio fraco", tone: "warning" },
    ],
  },
  {
    id: "gm-origo-003",
    name: "Odonto Norte Palmas",
    category: "Dentista",
    phone: "6398821-0934",
    website: "https://odontonorte.example.com",
    address: "Quadra 104 Norte, Av. LO-2 - Palmas, TO",
    city: "Palmas",
    state: "TO",
    rating: 4.6,
    reviewsCount: 78,
    businessStatus: "operational",
    photoUrl: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=600&q=80",
    googleMapsUrl: "https://maps.google.com/?q=Odonto+Norte+Palmas",
    leadScore: 76,
    sourceProvider: "outscraper",
    signals: [
      { id: "low-reviews", label: "Poucas avaliações", tone: "warning" },
      { id: "fit", label: "Boa aderência local", tone: "positive" },
    ],
  },
  {
    id: "gm-origo-004",
    name: "Vita Corp Medicina Integrada",
    category: "Clínica médica",
    phone: "213344-9120",
    website: "https://vitacorp.med.br",
    address: "Av. das Américas, 500 - Rio de Janeiro, RJ",
    city: "Rio de Janeiro",
    state: "RJ",
    rating: 4.9,
    reviewsCount: 514,
    businessStatus: "operational",
    photoUrl: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=600&q=80",
    googleMapsUrl: "https://maps.google.com/?q=Vita+Corp+Medicina+Integrada",
    leadScore: 94,
    sourceProvider: "outscraper",
    signals: [
      { id: "hot", label: "Lead Quente", tone: "hot" },
      { id: "reviews", label: "Alta autoridade local", tone: "positive" },
    ],
  },
  {
    id: "gm-origo-005",
    name: "Studio Bela Forma",
    category: "Estética e beleza",
    phone: "8599220-7441",
    website: "",
    address: "Rua Barbosa de Freitas, 880 - Fortaleza, CE",
    city: "Fortaleza",
    state: "CE",
    rating: 3.9,
    reviewsCount: 19,
    businessStatus: "limited",
    photoUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80",
    googleMapsUrl: "https://maps.google.com/?q=Studio+Bela+Forma+Fortaleza",
    leadScore: 68,
    sourceProvider: "outscraper",
    signals: [
      { id: "no-site", label: "Empresa sem site", tone: "warning" },
      { id: "low-reviews", label: "Poucas avaliações", tone: "warning" },
    ],
  },
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchGoogleBusinesses(input: ProspectingSearchInput): Promise<ProspectingSearchResult> {
  await delay(980);

  const query = `${input.niche.trim()} em ${input.city.trim()}`;
  const niche = input.niche.trim().toLowerCase();
  const city = input.city.trim().toLowerCase();
  const filtered = MOCK_GOOGLE_BUSINESSES.filter((business) => {
    const haystack = `${business.name} ${business.category} ${business.city} ${business.state}`.toLowerCase();
    return (!niche || haystack.includes(niche.split(" ")[0])) || (!city || haystack.includes(city));
  });
  const businesses = filtered.length > 0 ? filtered : MOCK_GOOGLE_BUSINESSES;

  return {
    query,
    provider: input.provider ?? "outscraper",
    page: input.page ?? 1,
    hasNextPage: false,
    businesses: businesses.map((business, index) => ({
      ...business,
      id: `${business.id}-${input.city || "br"}-${index}`,
      sourceProvider: input.provider ?? business.sourceProvider,
    })),
  };
}

export { MOCK_GOOGLE_BUSINESSES };
