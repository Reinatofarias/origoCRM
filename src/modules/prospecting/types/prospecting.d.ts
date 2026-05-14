import type { LeadInput } from "@/lib/types";

export type ProspectingProvider = "outscraper" | "apify" | "google_places" | "cnpj_ws";

export type ProspectingStatus = "operational" | "limited" | "weak_profile" | "closed";

export type ProspectingSignalTone = "hot" | "warning" | "neutral" | "positive";

export interface ProspectingSearchInput {
  niche: string;
  state: string;
  city?: string;
  page?: number;
  limit?: number;
  provider?: ProspectingProvider;
}

export interface ProspectBusinessSignal {
  id: string;
  label: string;
  tone: ProspectingSignalTone;
}

export interface ProspectBusiness {
  id: string;
  name: string;
  category: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  rating?: number;
  reviewsCount?: number;
  businessStatus?: ProspectingStatus;
  photoUrl?: string;
  googleMapsUrl?: string;
  leadScore?: number;
  signals: ProspectBusinessSignal[];
  sourceProvider: ProspectingProvider;
}

export interface ProspectingSearchResult {
  query: string;
  provider: ProspectingProvider;
  page: number;
  hasNextPage: boolean;
  businesses: ProspectBusiness[];
}

export interface CompanyPartner {
  name: string;
  role: string;
  since?: string;
}

export interface CompanyByCnpj {
  cnpj: string;
  legalName: string;
  tradeName: string;
  registrationStatus: string;
  cnae: string;
  openedAt: string;
  shareCapital: string;
  partners: CompanyPartner[];
  address: string;
  phones: string[];
  emails: string[];
  leadScore: number;
  signals: ProspectBusinessSignal[];
}

export interface CnpjLookupInput {
  cnpj: string;
}

export interface CnaeLookupInput {
  cnae: string;
  state: string;
  limit?: number;
}

export interface CnaeCompanySearchResult {
  query: string;
  provider: "cnpj_ws";
  hasNextPage: boolean;
  businesses: ProspectBusiness[];
}

export interface EnrichedCompany {
  business: ProspectBusiness;
  cnpj?: CompanyByCnpj;
  recommendedLead: LeadInput;
  approach: string;
}

export interface ProspectingLeadPayload {
  input: LeadInput;
  sourceBusiness?: ProspectBusiness;
  cnpj?: CompanyByCnpj;
}
