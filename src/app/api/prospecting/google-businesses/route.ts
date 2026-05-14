import { NextRequest, NextResponse } from "next/server";

import type { ProspectBusiness, ProspectBusinessSignal, ProspectingSearchInput } from "@/modules/prospecting";

export const dynamic = "force-dynamic";

type SerpApiLocalResult = {
  position?: number;
  title?: string;
  place_id?: string;
  data_id?: string;
  data_cid?: string;
  type?: string;
  types?: string[];
  address?: string;
  phone?: string;
  website?: string;
  links?: {
    website?: string;
    directions?: string;
    place?: string;
  };
  rating?: number | string;
  reviews?: number | string;
  reviews_original?: string;
  open_state?: string;
  hours?: string;
  thumbnail?: string;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<ProspectingSearchInput>;
  const niche = body.niche?.trim();
  const state = body.state?.trim().toUpperCase();
  const city = body.city?.trim();

  if (!niche || !state) {
    return NextResponse.json({ error: "Informe tipo de empresa/profissional e estado" }, { status: 400 });
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  const endpoint = process.env.SERPAPI_SEARCH_ENDPOINT ?? "https://serpapi.com/search.json";
  const query = buildSearchQuery(niche, state, city);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "SERPAPI_API_KEY nao configurada na Vercel",
        query,
        provider: "serpapi",
        page: body.page ?? 1,
        hasNextPage: false,
        businesses: [],
      },
      { status: 503 },
    );
  }

  const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 20);
  const url = new URL(endpoint);
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt");
  url.searchParams.set("gl", "br");
  url.searchParams.set("google_domain", "google.com.br");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      { error: extractSerpApiError(payload) ?? "Falha ao consultar SerpAPI" },
      { status: response.status },
    );
  }

  const apiError = extractSerpApiError(payload);
  if (apiError) {
    return NextResponse.json({ error: apiError }, { status: 502 });
  }

  const places = extractPlaces(payload).slice(0, limit);

  return NextResponse.json({
    query,
    provider: "serpapi",
    page: body.page ?? 1,
    hasNextPage: Boolean(extractPaginationNext(payload)),
    businesses: places.map((place, index) => mapSerpApiPlaceToBusiness(place, index, state, city)),
  });
}

function buildSearchQuery(niche: string, state: string, city?: string) {
  return [niche, city, state, "Brasil"].filter(Boolean).join(" ");
}

function extractPlaces(payload: unknown): SerpApiLocalResult[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  return Array.isArray(record.local_results) ? (record.local_results as SerpApiLocalResult[]) : [];
}

function mapSerpApiPlaceToBusiness(
  place: SerpApiLocalResult,
  index: number,
  fallbackState: string,
  fallbackCity?: string,
): ProspectBusiness {
  const rating = toNumber(place.rating);
  const reviewsCount = toNumber(place.reviews) ?? extractReviewCount(place.reviews_original) ?? 0;
  const website = place.website ?? place.links?.website ?? "";
  const category = place.type ?? place.types?.[0] ?? "Empresa local";
  const leadScore = calculateLeadScore({ rating, reviewsCount, website, openState: place.open_state });

  return {
    id: place.place_id ?? place.data_id ?? place.data_cid ?? `serpapi-${index}`,
    name: place.title ?? "Empresa sem nome",
    category,
    phone: place.phone ?? "",
    website,
    address: place.address ?? "",
    city: fallbackCity ?? extractCityFromAddress(place.address) ?? "",
    state: fallbackState,
    rating,
    reviewsCount,
    businessStatus: normalizeBusinessStatus(place.open_state ?? place.hours),
    photoUrl: place.thumbnail,
    googleMapsUrl: buildGoogleMapsUrl(place),
    leadScore,
    signals: buildSignals({ leadScore, reviewsCount, website, phone: place.phone ?? "" }),
    sourceProvider: "serpapi",
  };
}

function buildGoogleMapsUrl(place: SerpApiLocalResult) {
  if (place.links?.place) return place.links.place;
  if (place.gps_coordinates?.latitude && place.gps_coordinates.longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${place.gps_coordinates.latitude},${place.gps_coordinates.longitude}`;
  }
  if (place.title) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title)}`;
  return undefined;
}

function calculateLeadScore(input: { rating?: number; reviewsCount: number; website: string; openState?: string }) {
  let score = 55;
  if ((input.rating ?? 0) >= 4.5) score += 18;
  if (input.reviewsCount >= 100) score += 15;
  else if (input.reviewsCount >= 30) score += 8;
  if (!input.website) score += 8;
  if (input.openState?.toLowerCase().includes("permanentemente fechado")) score -= 30;
  if (input.openState?.toLowerCase().includes("permanently closed")) score -= 30;
  return Math.max(0, Math.min(100, score));
}

function buildSignals(input: { leadScore: number; reviewsCount: number; website: string; phone: string }): ProspectBusinessSignal[] {
  const signals: ProspectBusinessSignal[] = [];
  if (input.leadScore >= 85) signals.push({ id: "hot", label: "Lead Quente", tone: "hot" });
  if (input.phone) signals.push({ id: "phone", label: "Telefone capturado", tone: "positive" });
  if (!input.phone) signals.push({ id: "no-phone", label: "Sem telefone publico", tone: "warning" });
  if (!input.website) signals.push({ id: "no-site", label: "Empresa sem site", tone: "warning" });
  if (input.reviewsCount < 50) signals.push({ id: "low-reviews", label: "Poucas avaliacoes", tone: "warning" });
  if (input.reviewsCount >= 100) signals.push({ id: "reviews", label: "Prova social forte", tone: "positive" });
  if (signals.length === 0) signals.push({ id: "neutral", label: "Perfil comercial estavel", tone: "neutral" });
  return signals;
}

function normalizeBusinessStatus(status?: string): ProspectBusiness["businessStatus"] {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized.includes("closed") || normalized.includes("fechado")) return "closed";
  if (normalized.includes("temporary") || normalized.includes("temporariamente")) return "limited";
  return "operational";
}

function extractCityFromAddress(address?: string) {
  if (!address) return undefined;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.at(-2) : undefined;
}

function extractReviewCount(value?: string) {
  if (!value) return undefined;
  const number = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : undefined;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const number = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function extractPaginationNext(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const pagination = record.serpapi_pagination;
  if (!pagination || typeof pagination !== "object") return null;
  return (pagination as Record<string, unknown>).next ?? null;
}

function extractSerpApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  return String(record.error ?? record.message ?? "") || null;
}
