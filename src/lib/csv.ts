import Papa from "papaparse";
import type { Lead } from "./types";
import { WEBSITE_STATUS_LABEL } from "./types";
import { scoreExplanation, scoreLead } from "./scoring";

/** Neutralize spreadsheet formula injection. */
export function safeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function leadsToCsv(leads: Lead[], includeNotes = true) {
  const rows = leads.map((l) => {
    const sc = scoreLead(l);
    const r: Record<string, string> = {
      "Business name": l.name,
      Category: l.category,
      Address: [l.address, l.city].filter(Boolean).join(", "),
      Phone: l.phone ?? "",
      Email: l.email ?? "",
      Website: l.website ?? "",
      "Website status": WEBSITE_STATUS_LABEL[l.websiteStatus],
      Rating: l.rating?.toString() ?? "",
      "Review count": l.reviewCount?.toString() ?? "",
      "Opportunity score": String(sc.total),
      "Score explanation": scoreExplanation(sc),
      "Lead stage": l.stage,
      Notes: includeNotes ? l.notes : "",
      Source: l.sourceUrl ? `${l.source} (${l.sourceUrl})` : l.source,
      "Date discovered": l.discoveredAt,
      "Last checked": l.lastCheckedAt ?? "",
    };
    if (!includeNotes) delete r["Notes"];
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)]));
  });
  return Papa.unparse(rows);
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const IMPORT_FIELDS = ["name", "category", "phone", "website", "address", "email", "rating", "reviewCount"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export const FIELD_LABEL: Record<ImportField, string> = {
  name: "Business name *", category: "Category", phone: "Phone", website: "Website", address: "Address", email: "Email", rating: "Rating", reviewCount: "Review count",
};
const ALIASES: Record<ImportField, string[]> = {
  name: ["business_name", "name", "company", "business", "businessname", "company_name"],
  category: ["category", "industry", "type"],
  phone: ["phone", "telephone", "tel", "phone_number", "mobile"],
  website: ["website", "url", "website_url", "site", "web"],
  address: ["address", "location", "street", "full_address"],
  email: ["email", "e-mail", "email_address"],
  rating: ["rating", "stars"],
  reviewCount: ["reviews", "review_count", "reviewcount", "num_reviews"],
};

export function autoMap(headers: string[]): Partial<Record<ImportField, string>> {
  const norm = (h: string) => h.toLowerCase().trim().replace(/[\s]+/g, "_");
  const m: Partial<Record<ImportField, string>> = {};
  for (const f of IMPORT_FIELDS) {
    const h = headers.find((x) => ALIASES[f].includes(norm(x)));
    if (h) m[f] = h;
  }
  return m;
}
