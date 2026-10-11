import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Info, Loader2, RotateCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, EmptyState } from "@/components/page-header";
import { LeadTable } from "@/components/lead-table";
import { CATEGORY_PRESETS, ProviderError, searchBusinesses } from "@/lib/osm";
import { addHistory, getState, logActivity, uid, upsertLeads, useStore } from "@/lib/store";
import type { Lead, SearchFilters } from "@/lib/types";

export const Route = createFileRoute("/find")({
  validateSearch: (s: Record<string, unknown>): { h?: string | undefined } => ({ h: typeof s["h"] === "string" ? s["h"] : undefined }),
  head: () => ({
    meta: [
      { title: "Find Leads — Redline Leads" },
      { name: "description", content: "Search OpenStreetMap for local businesses by category and location and spot website opportunities." },
      { property: "og:title", content: "Find Leads — Redline Leads" },
      { property: "og:description", content: "Discover local businesses by category and location." },
    ],
  }),
  component: FindPage,
});

function FindPage() {
  const { h } = Route.useSearch();
  const settings = useStore((s) => s.settings);
  const leadsMap = useStore((s) => s.leads);
  const [f, setF] = useState<SearchFilters>({ category: "", location: "", radiusKm: 5, websiteFilter: "any" });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ids: string[]; at: string; stored: boolean; place?: string; recordId?: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setF((x) => ({ ...x, location: x.location || settings.defaultLocation, radiusKm: settings.defaultRadiusKm || 5 }));
  }, [settings.defaultLocation, settings.defaultRadiusKm]);

  useEffect(() => {
    if (!h) return;
    const rec = getState().history.find((r) => r.id === h);
    if (rec) {
      setF(rec.filters);
      setResult({ ids: rec.leadIds, at: rec.at, stored: true, recordId: rec.id });
    }
  }, [h]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.category.trim()) { setError("Enter a business category."); return; }
    if (f.location.trim().length < 2) { setError("Enter a city, region or country."); return; }
    setError(null);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus("Starting search…");
    const at = new Date().toISOString();
    try {
      const { leads, place } = await searchBusinesses(f, ctrl.signal, setStatus);
      let filtered = leads;
      if (f.websiteFilter === "none") filtered = leads.filter((l) => !l.website);
      if (f.websiteFilter === "listed") filtered = leads.filter((l) => l.website);
      // Rating filters: OSM provides no ratings, so only apply when ratings exist.
      const { ids, added, duplicates } = upsertLeads(filtered);
      const rec = { id: uid(), filters: f, at, resultCount: ids.length, provider: "OpenStreetMap (Overpass)", outcome: ids.length ? "success" : "empty", leadIds: ids } as const;
      addHistory({ ...rec, leadIds: [...ids] });
      logActivity({ kind: "search", text: `${f.category} in ${f.location}: ${ids.length} results (${added} new)`, link: `/find?h=${rec.id}` });
      setResult({ ids, at, stored: false, place, recordId: rec.id });
      if (ids.length) toast.success(`${ids.length} businesses found · ${added} new, ${duplicates} already in your leads`);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof ProviderError ? err.message : "Unexpected error while searching.";
      setError(msg);
      addHistory({ id: uid(), filters: f, at, resultCount: 0, provider: "OpenStreetMap (Overpass)", outcome: "error", error: msg, leadIds: [] });
    } finally {
      setStatus(null);
    }
  }

  const resultLeads = (result?.ids ?? []).map((id) => leadsMap[id]).filter((x): x is Lead => !!x);
  const hasRatingFilter = (f.minRating ?? 0) > 0 || (f.minReviews ?? 0) > 0;

  return (
    <>
      <PageHeader title="Find Leads" subtitle="Search public OpenStreetMap listings by category and location." />

      <form onSubmit={run} className="rounded-md border bg-secondary/50 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Label htmlFor="cat" className="text-xs">Business category</Label>
            <Input id="cat" list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Beauty salons or custom" className="mt-1 bg-background" />
            <datalist id="cats">{Object.keys(CATEGORY_PRESETS).map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="md:col-span-4">
            <Label htmlFor="loc" className="text-xs">City, region or country</Label>
            <Input id="loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Clifton, Karachi" className="mt-1 bg-background" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Radius</Label>
            <Select value={String(f.radiusKm)} onValueChange={(v) => setF({ ...f, radiusKm: +v })}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 5, 10, 15, 25].map((r) => <SelectItem key={r} value={String(r)}>{r} km</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Website</Label>
            <Select value={f.websiteFilter} onValueChange={(v) => setF({ ...f, websiteFilter: v as SearchFilters["websiteFilter"] })}>
              <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="none">No website listed</SelectItem>
                <SelectItem value="listed">Website listed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="mr" className="text-xs">Min. rating</Label>
            <Input id="mr" type="number" min={0} max={5} step={0.5} value={f.minRating ?? ""} onChange={(e) => setF({ ...f, minRating: e.target.value ? +e.target.value : undefined })} placeholder="Any" className="mt-1 bg-background" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="mv" className="text-xs">Min. reviews</Label>
            <Input id="mv" type="number" min={0} value={f.minReviews ?? ""} onChange={(e) => setF({ ...f, minReviews: e.target.value ? +e.target.value : undefined })} placeholder="Any" className="mt-1 bg-background" />
          </div>
          <div className="flex items-end md:col-span-8 md:justify-end">
            <Button type="submit" disabled={!!status} className="w-full md:w-auto">
              {status ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Find leads
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(settings.defaultCategories.length ? settings.defaultCategories : Object.keys(CATEGORY_PRESETS)).concat(Object.keys(CATEGORY_PRESETS).filter((c) => !settings.defaultCategories.includes(c))).slice(0, 12).map((c) => (
            <button type="button" key={c} onClick={() => setF({ ...f, category: c })} className={`rounded-sm border px-2 py-0.5 text-xs transition-colors ${f.category === c ? "border-primary bg-primary-soft text-primary" : "bg-background text-muted-foreground hover:text-foreground"}`}>{c}</button>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Results come from OpenStreetMap and depend on how well local businesses are mapped. Phone numbers and websites are only shown when contributors added them.
          {hasRatingFilter && " OpenStreetMap does not publish ratings or reviews, so rating filters only apply to imported leads."}
        </p>
      </form>

      <div className="mt-6">
        {status && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />{status}</p>
            <div className="space-y-2 rounded-md border p-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          </div>
        )}
        {!status && error && (
          <div className="flex items-start gap-3 rounded-md border border-primary/25 bg-primary-soft p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Search couldn't complete</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => run()}><RotateCw className="size-3.5" />Retry</Button>
          </div>
        )}
        {!status && result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-sm border px-2 py-1 ${result.stored ? "border-warning/30 bg-warning-soft text-warning" : "border-success/25 bg-success-soft text-success"}`}>
                {result.stored ? `Stored results from ${new Date(result.at).toLocaleString()}` : `Retrieved live ${new Date(result.at).toLocaleTimeString()}`}
              </span>
              {result.place && <span className="truncate text-muted-foreground">Near {result.place}</span>}
              <span className="text-muted-foreground">· Data © OpenStreetMap contributors (ODbL)</span>
              {result.stored && <Button size="sm" variant="outline" className="h-7" onClick={() => run()}><RotateCw className="size-3.5" />Refresh from OpenStreetMap</Button>}
            </div>
            {resultLeads.length === 0 ? (
              <EmptyState title="No businesses found" body="Try a broader category, a larger radius, or a nearby city. Coverage varies by area." />
            ) : (
              <LeadTable key={result.recordId} leads={resultLeads} exportName={`${f.category}-${f.location}`.replace(/\W+/g, "-").toLowerCase()} />
            )}
          </div>
        )}
        {!status && !error && !result && (
          <EmptyState icon={<Search className="size-6" />} title="Start with a category and a place" body="For example: Dentists in Lahore, Gyms in Nairobi, Plumbers in Leeds." />
        )}
      </div>
    </>
  );
}
