export type WebsiteStatus = "listed" | "none" | "needs_check" | "unavailable" | "audited";

export const WEBSITE_STATUS_LABEL: Record<WebsiteStatus, string> = {
  listed: "Website listed",
  none: "No website detected",
  needs_check: "Needs checking",
  unavailable: "Website unavailable",
  audited: "Audit completed",
};

export const STAGES = [
  "New",
  "Researching",
  "Ready to contact",
  "Contacted",
  "Replied",
  "Interested",
  "Meeting booked",
  "Won",
  "Lost",
] as const;
export type Stage = (typeof STAGES)[number];

export type LeadSource = "OpenStreetMap" | "CSV import";

export interface AuditCheck {
  id: string;
  category: "Technical availability" | "SEO basics" | "Mobile readiness" | "Contact and conversion";
  label: string;
  status: "pass" | "warn" | "fail" | "unknown";
  detail: string;
}

export interface AuditResult {
  id: string;
  url: string;
  finalUrl?: string;
  checkedAt: string;
  reachable: boolean;
  httpStatus?: number;
  responseMs?: number;
  bytes?: number;
  title?: string;
  description?: string;
  error?: string;
  checks: AuditCheck[];
  suggestions: string[];
}

export interface Lead {
  id: string;
  sourceId: string;
  source: LeadSource;
  sourceUrl?: string;
  name: string;
  category: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  lat?: number;
  lon?: number;
  rating?: number;
  reviewCount?: number;
  websiteStatus: WebsiteStatus;
  stage: Stage;
  notes: string;
  saved: boolean;
  discoveredAt: string;
  lastCheckedAt?: string;
  audits: AuditResult[];
}

export interface SavedList {
  id: string;
  name: string;
  leadIds: string[];
  createdAt: string;
}

export interface SearchFilters {
  category: string;
  location: string;
  radiusKm: number;
  minRating?: number;
  minReviews?: number;
  websiteFilter: "any" | "none" | "listed";
}

export interface SearchRecord {
  id: string;
  filters: SearchFilters;
  at: string;
  resultCount: number;
  provider: string;
  outcome: "success" | "empty" | "error";
  error?: string;
  leadIds: string[];
}

export interface Activity {
  id: string;
  at: string;
  kind: "search" | "save" | "import" | "export" | "audit" | "stage" | "list";
  text: string;
  leadId?: string;
  link?: string;
}

export interface Settings {
  displayName: string;
  defaultLocation: string;
  defaultCategories: string[];
  defaultRadiusKm: number;
  exportIncludeNotes: boolean;
}
