import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gauge, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, EmptyState } from "@/components/page-header";
import { AuditReport } from "@/components/audit-report";
import { auditUrl } from "@/lib/lead-actions";
import { getState, logActivity, patchLead } from "@/lib/store";
import type { AuditResult } from "@/lib/types";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Website Audit — Redline Leads" },
      { name: "description", content: "Check any public website for availability, HTTPS, SEO basics, mobile readiness and booking/contact options." },
      { property: "og:title", content: "Website Audit — Redline Leads" },
      { property: "og:description", content: "A lightweight, honest website check for prospecting." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim().length < 4) return toast.error("Enter a website address.");
    setLoading(true);
    setResult(null);
    try {
      const r = await auditUrl(url.trim());
      setResult(r);
      // attach to a matching lead, if any
      const host = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
      const match = Object.values(getState().leads).find((l) => l.website && l.website.includes(host));
      if (match && host) patchLead(match.id, { audits: [r, ...match.audits].slice(0, 10), websiteStatus: r.reachable ? "audited" : "unavailable", lastCheckedAt: r.checkedAt });
      logActivity({ kind: "audit", text: `Audited ${host || r.url}${match ? ` (${match.name})` : ""}`, leadId: match?.id });
    } catch (err) {
      toast.error(`Audit failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Website Audit" subtitle="A quick, evidence-based check you can share with a business owner." />
      <form onSubmit={go} className="flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com" className="sm:max-w-md" aria-label="Website URL" />
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}Run audit</Button>
      </form>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Only public websites are checked. Private networks are blocked, redirects are re-validated, and requests time out after 9 s. We fetch the homepage HTML only — no Lighthouse or Core Web Vitals scores are claimed.</p>
      <div className="mt-6">
        {loading && <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>}
        {!loading && result && <AuditReport result={result} />}
        {!loading && !result && <EmptyState icon={<Gauge className="size-6" />} title="Enter a website to audit" body="You can also run checks on a lead from its detail panel; results are saved to that lead." />}
      </div>
    </>
  );
}
