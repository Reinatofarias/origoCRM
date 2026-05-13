import { NextRequest, NextResponse } from "next/server";

import type { ProspectBusiness, ProspectBusinessSignal, ProspectingSearchInput } from "@/modules/prospecting";

export const dynamic = "force-dynamic";

type OutscraperPlace = {
  name?: string;
  name_for_emails?: string;
  category?: string;
  type?: string;
  phone?: string;
  phone_1?: string;
  site?: string;
  website?: string;
  address?: string;
  full_address?: string;
  city?: string;
  state?: string;
  rating?: number | string;
  reviews?: number | string;
  reviews_count?: number | string;
  business_status?: string;
  photo?: string;
  logo?: string;
  location_link?: string;
  google_id?: string;
  place_id?: string;
  cid?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<ProspectingSearchInput>;
  const niche = body.niche?.trim();
  const city = body.city?.trim();

  if (!niche || !city) {
    return NextResponse.json({ error: "Informe nicho e cidade" }, { status: 400 });
  }

  const apiKey = process.env.OUTSCRAPER_API_KEY;
  const endpoint = process.env.OUTSCRAPER_GOOGLE_MAPS_ENDPOINT ?? "https://api.app.outscraper.com/maps/search-v3";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OUTSCRAPER_API_KEY nao configurada na Vercel",
        query: `${niche} em ${city}`,
        provider: "outscraper",
        page: body.page ?? 1,
        hasNextPage: false,
        businesses: [],
      },
      { status: 503 },
    );
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 50);
  const query = `${niche}, ${city}, Brasil`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: [query],
      limit,
      async: false,
      language: "pt-BR",
      region: "BR",
      fields: [
        "name",
        "category",
        "type",
        "phone",
        "phone_1",
        "site",
        "website",
        "full_address",
        "address",
        "city",
        "state",
        "rating",
        "reviews",
        "business_status",
        "photo",
        "logo",
        "location_link",
        "google_id",
        "place_id",
        "cid",
      ].join(","),
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { error: extractOutscraperError(payload) ?? "Falha ao consultar Outscraper" },
      { status: response.status },
    );
  }

  const places = extractPlaces(payload);

  return NextResponse.json({
    query,
    provider: "outscraper",
    page: body.page ?? 1,
    hasNextPage: false,
    businesses: places.map(mapOutscraperPlaceToBusiness),
  });
}

function extractPlaces(payload: unknown): OutscraperPlace[] {
  if (Array.isArray(payload)) {
    if (Array.isArray(payload[0])) return payload.flat() as OutscraperPlace[];
    return payload as OutscraperPlace[];
  }

  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const data = record.data;
  const results = record.results;

  if (Array.isArray(data)) {
    if (Array.isArray(data[0])) return data.flat() as OutscraperPlace[];
    return data as OutscraperPlace[];
  }

  if (Array.isArray(results)) return results as OutscraperPlace[];

  return [];
}

function mapOutscraperPlaceToBusiness(place: OutscraperPlace, index: number): ProspectBusiness {
  const rating = toNumber(place.rating);
  const reviewsCount = toNumber(place.reviews ?? place.reviews_count) ?? 0;
  const website = place.website ?? place.site ?? "";
  const leadScore = calculateLeadScore({ rating, reviewsCount, website, businessStatus: place.business_status });

  return {
    id: place.google_id ?? place.place_id ?? place.cid ?? `outscraper-${index}`,
    name: place.name ?? place.name_for_emails ?? "Empresa sem nome",
    category: place.category ?? place.type ?? "Empresa local",
    phone: place.phone ?? place.phone_1 ?? "",
    website,
    address: place.full_address ?? place.address ?? "",
    city: place.city ?? "",
    state: place.state ?? "",
    rating,
    reviewsCount,
    businessStatus: normalizeBusinessStatus(place.business_status),
    photoUrl: place.photo ?? place.logo ?? undefined,
    googleMapsUrl: place.location_link,
    leadScore,
    signals: buildSignals({ leadScore, reviewsCount, website }),
    sourceProvider: "outscraper",
  };
}

function calculateLeadScore(input: { rating?: number; reviewsCount: number; website: string; businessStatus?: string }) {
  let score = 55;
  if ((input.rating ?? 0) >= 4.5) score += 18;
  if (input.reviewsCount >= 100) score += 15;
  else if (input.reviewsCount >= 30) score += 8;
  if (!input.website) score += 8;
  if (input.businessStatus?.toLowerCase().includes("closed")) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function buildSignals(input: { leadScore: number; reviewsCount: number; website: string }): ProspectBusinessSignal[] {
  const signals: ProspectBusinessSignal[] = [];
  if (input.leadScore >= 85) signals.push({ id: "hot", label: "Lead Quente", tone: "hot" });
  if (!input.website) signals.push({ id: "no-site", label: "Empresa sem site", tone: "warning" });
  if (input.reviewsCount < 50) signals.push({ id: "low-reviews", label: "Poucas avaliações", tone: "warning" });
  if (input.reviewsCount >= 100) signals.push({ id: "reviews", label: "Prova social forte", tone: "positive" });
  if (signals.length === 0) signals.push({ id: "neutral", label: "Perfil comercial estável", tone: "neutral" });
  return signals;
}

function normalizeBusinessStatus(status?: string): ProspectBusiness["businessStatus"] {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("closed")) return "closed";
  if (normalized.includes("temporary") || normalized.includes("limited")) return "limited";
  return "operational";
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const number = Number(value.replace(",", "."));
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function extractOutscraperError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return String(record.error ?? record.message ?? "") || null;
}
