import type { LeadInput } from "@/lib/types";

export type ProspectingProvider = "serpapi" | "outscraper" | "apify" | "google_places";

export type ProspectingStatus = "operational" | "limited" | "weak_profile" | "closed";

export type ProspectingSignalTone = "hot" | "warning" | "neutral" | "positive";

export interface ProspectingSearchInput {
  niche: string;
  state: string;
  city?: string;
  page?: number;
  limit?: number;
  start?: number;
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
  start?: number;
  hasNextPage: boolean;
  businesses: ProspectBusiness[];
}

export interface EnrichedCompany {
  business: ProspectBusiness;
  recommendedLead: LeadInput;
  approach: string;
}

export interface ProspectingLeadPayload {
  input: LeadInput;
  sourceBusiness?: ProspectBusiness;
}

export type ProspectingDispatchStatus = "new" | "queued" | "sending" | "sent" | "failed" | "ignored" | "lead_added";
export type ProspectingWhatsAppValidationStatus = "unknown" | "checking" | "valid" | "invalid" | "error";

export type ProspectingDispatchState = {
  status: ProspectingDispatchStatus;
  error?: string;
  sentAt?: string;
};

export type ProspectingWhatsAppValidationState = {
  status: ProspectingWhatsAppValidationStatus;
  jid?: string;
  error?: string;
};
