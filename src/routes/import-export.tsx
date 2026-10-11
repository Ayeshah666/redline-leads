import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { pill } from "@/components/badges";
import { autoMap, download, FIELD_LABEL, IMPORT_FIELDS, leadsToCsv, type ImportField } from "@/lib/csv";
import { normalizeUrl } from "@/lib/osm";
import { dedupeKey, getState, logActivity, uid, upsertLeads, useStore } from "@/lib/store";
import type { Lead } from "@/lib/types";

export const Route = createFileRoute("/import-export")({
  head: () => ({
    meta: [
      { title: "Import & Export — Redline Leads" },
      { name: "description", content: "Import business lists from CSV with column mapping and validation, and export leads safely." },
      { property: "og:title", content: "Import & Export — Redline Leads" },
      { property: "og:description", content: "CSV import with validation and safe CSV export." },
    ],
  }),
  component: IOPage,
});

type Raw = Record<string, string>;

function IOPage() {
  const [file, setFile] = useState<string | null>(null);
  const [rows, setRows] = useState<Raw[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Partial<Record<ImportField, string>>>({});
  const lists = useStore((s) => s.lists);
  const leadCount = useStore((s) => Object.keys(s.leads).length);
  const includeNotes = useStore((s) => s.settings.exportIncludeNotes);

  const onFile = (f: File) => {
    if (f.size > 5_000_000) return toast.error("File is larger than 5 MB.");
    Papa.parse<Raw>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const h = r.meta.fields ?? [];
        if (!h.length) return toast.error("Couldn't find a header row in this CSV.");
        setFile(f.name); setRows(r.data.slice(0, 5000)); setHeaders(h); setMap(autoMap(h));
      },
      error: (e) => toast.error(`Could not read CSV: ${e.message}`),
    });
  };

  const analysis = useMemo(() => {
    const existing = new Set(Object.values(getState().leads).map(dedupeKey));
    const seen = new Set<string>();
    const valid: Lead[] = [];
    let dup = 0, invalid = 0;
    const now = new Date().toISOString();
    for (const r of rows) {
      const g = (k: ImportField) => (map[k] ? (r[map[k]!] ?? "").toString().trim().slice(0, 500) : "");
      const name = g("name");
      if (!name) { invalid++; continue; }
      const site = g("website");
      const website = normalizeUrl(site);
      const rating = parseFloat(g("rating"));
      const reviews = parseInt(g("reviewCount"));
      const lead: Lead = {
        id: uid() + valid.length, sourceId: `csv:${name}|${g("address")}`.toLowerCase(), source: "CSV import",
        name, category: g("category") || "Uncategorized", address: g("address") || undefined, phone: g("phone") || undefined,
        email: g("email") || undefined, website,
        rating: isNaN(rating) ? undefined : Math.max(0, Math.min(5, rating)), reviewCount: isNaN(reviews) ? undefined : reviews,
        websiteStatus: website ? "listed" : map.website ? "none" : "needs_check",
        stage: "New", notes: "", saved: false, discoveredAt: now, audits: [],
      };
      const k = dedupeKey(lead);
      if (existing.has(k) || seen.has(k)) { dup++; continue; }
      seen.add(k); valid.push(lead);
    }
    return { valid, dup, invalid };
  }, [rows, map]);

  const confirm = () => {
    const { added } = upsertLeads(analysis.valid);
    logActivity({ kind: "import", text: `Imported ${added} leads from ${file}`, link: "/leads" });
    toast.success(`Imported ${added} leads`);
    setRows([]); setFile(null); setHeaders([]);
  };

  const exportAll = (which: "all" | "saved" | string) => {
    const s = getState();
    const all = Object.values(s.leads);
    const data = which === "all" ? all : which === "saved" ? all.filter((l) => l.saved) : (s.lists.find((l) => l.id === which)?.leadIds ?? []).map((id) => s.leads[id]).filter(Boolean);
    if (!data.length) return toast.error("Nothing to export.");
    download(`redline-leads-${which === "all" || which === "saved" ? which : "list"}-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(data, includeNotes));
    logActivity({ kind: "export", text: `Exported ${data.length} leads to CSV` });
  };

  return (
    <>
      <PageHeader title="Import & Export" subtitle="Bring in existing prospect lists or take your data anywhere." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-md border">
          <div className="border-b px-4 py-3"><h2 className="text-sm font-medium">Import CSV</h2></div>
          <div className="p-4">
            {!file ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center hover:border-primary/50 hover:bg-secondary">
                <Upload className="mb-2 size-6 text-muted-foreground" />
                <span className="text-sm font-medium">Choose a CSV file</span>
                <span className="mt-1 text-xs text-muted-foreground">Columns like business_name, phone, website, address, category are detected automatically.</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{file} · <span className="tnum">{rows.length}</span> rows</span><Button size="sm" variant="ghost" onClick={() => setFile(null)}>Choose another</Button></div>
                <div>
                  <p className="mb-2 text-xs font-medium">Column mapping</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {IMPORT_FIELDS.map((f) => (
                      <div key={f}>
                        <p className="mb-1 text-xs text-muted-foreground">{FIELD_LABEL[f]}</p>
                        <Select value={map[f] ?? "__none"} onValueChange={(v) => setMap((m) => ({ ...m, [f]: v === "__none" ? undefined : v }))}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="__none">— Not mapped —</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-muted-foreground"><tr>{headers.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{rows.slice(0, 5).map((r, i) => <tr key={i}>{headers.map((h) => <td key={h} className="max-w-[200px] truncate px-2 py-1.5">{r[h]}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={pill({ tone: "green" })}>{analysis.valid.length} valid</span>
                  <span className={pill({ tone: "amber" })}>{analysis.dup} duplicates (skipped)</span>
                  <span className={pill({ tone: "red" })}>{analysis.invalid} missing business name</span>
                  <Button className="ml-auto" disabled={!map.name || analysis.valid.length === 0} onClick={confirm}><FileUp className="size-4" />Import {analysis.valid.length} leads</Button>
                </div>
                {!map.name && <p className="text-xs text-primary">Map the “Business name” column to continue.</p>}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border">
          <div className="border-b px-4 py-3"><h2 className="text-sm font-medium">Export CSV</h2></div>
          <div className="space-y-2 p-4">
            <Button variant="outline" className="w-full justify-between" onClick={() => exportAll("all")}>All leads <span className="tnum text-muted-foreground">{leadCount}</span></Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => exportAll("saved")}><Download className="size-4" />Saved prospects</Button>
            {lists.map((l) => <Button key={l.id} variant="outline" className="w-full justify-between" onClick={() => exportAll(l.id)}><span className="truncate">{l.name}</span><span className="tnum text-muted-foreground">{l.leadIds.length}</span></Button>)}
            <p className="pt-2 text-xs text-muted-foreground">Exports include score, explanation, stage{includeNotes ? ", notes" : ""}, source and dates. Cells starting with =, +, - or @ are escaped to prevent spreadsheet formula injection. Filtered and selected exports are available from any lead table.</p>
          </div>
        </section>
      </div>
    </>
  );
}
