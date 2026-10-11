import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { runAudit } from "./audit.functions";
import { getState, logActivity, patchLead } from "./store";
import type { AuditResult } from "./types";

// --- open-lead drawer state ---
let openId: string | null = null;
const subs = new Set<() => void>();
export function openLead(id: string | null) {
  openId = id;
  subs.forEach((s) => s());
}
export function useOpenLead() {
  return useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => openId,
    () => null,
  );
}

export async function auditUrl(url: string): Promise<AuditResult> {
  return runAudit({ data: { url } });
}

export async function auditLead(id: string) {
  const lead = getState().leads[id];
  if (!lead?.website) {
    toast.error("This lead has no website URL to check.");
    return;
  }
  try {
    const r = await auditUrl(lead.website);
    patchLead(id, {
      audits: [r, ...lead.audits].slice(0, 10),
      websiteStatus: r.reachable ? "audited" : "unavailable",
      lastCheckedAt: r.checkedAt,
    });
    logActivity({ kind: "audit", text: `Website check for ${lead.name}: ${r.reachable ? `HTTP ${r.httpStatus}` : r.error}`, leadId: id });
    if (r.reachable) toast.success(`Audit completed for ${lead.name}`);
    else toast.warning(`${lead.name}: ${r.error ?? "site unreachable"}`);
    return r;
  } catch (e) {
    toast.error(`Audit could not run: ${(e as Error).message}`);
  }
}

export function copyContacts(ids: string[]) {
  const s = getState();
  const text = ids
    .map((id) => s.leads[id])
    .filter(Boolean)
    .map((l) => [l.name, l.phone, l.email, l.website].filter(Boolean).join(" · "))
    .join("\n");
  navigator.clipboard.writeText(text).then(
    () => toast.success(`Copied contact details for ${ids.length} lead${ids.length === 1 ? "" : "s"}`),
    () => toast.error("Clipboard access was blocked by the browser."),
  );
}
