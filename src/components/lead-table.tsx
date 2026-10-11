import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Globe, MoreHorizontal, Search, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { addToList, getState, logActivity, setSaved, setStage, useStore } from "@/lib/store";
import { auditLead, copyContacts, openLead } from "@/lib/lead-actions";
import { scoreLead, type Score } from "@/lib/scoring";
import { STAGES, WEBSITE_STATUS_LABEL, type Lead, type WebsiteStatus } from "@/lib/types";
import { download, leadsToCsv } from "@/lib/csv";
import { ScoreBadge, StageBadge, WebsiteStatusBadge } from "./badges";

type SortKey = "name" | "category" | "city" | "websiteStatus" | "rating" | "reviewCount" | "score" | "stage";
type Row = Lead & { score: Score };

export interface TableFilters {
  web?: WebsiteStatus | "" | undefined;
  saved?: boolean | undefined;
  label?: Score["label"] | "" | undefined;
  stage?: string | undefined;
}

const PAGE = 25;

export function LeadTable({
  leads,
  initialFilters = {},
  onRemove,
  removeLabel = "Remove",
  exportName = "leads",
  toolbarExtra,
}: {
  leads: Lead[];
  initialFilters?: TableFilters;
  onRemove?: ((ids: string[]) => void) | undefined;
  removeLabel?: string;
  exportName?: string;
  toolbarExtra?: ReactNode;
}) {
  const lists = useStore((s) => s.lists);
  const includeNotes = useStore((s) => s.settings.exportIncludeNotes);
  const [q, setQ] = useState("");
  const [f, setF] = useState<TableFilters>(initialFilters);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const rows: Row[] = useMemo(() => leads.map((l) => ({ ...l, score: scoreLead(l) })), [leads]);
  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    const r = rows.filter((l) =>
      (!ql || [l.name, l.address, l.city, l.phone, l.website, l.category].some((x) => x?.toLowerCase().includes(ql))) &&
      (!f.web || l.websiteStatus === f.web) &&
      (!f.saved || l.saved) &&
      (!f.label || l.score.label === f.label) &&
      (!f.stage || l.stage === f.stage),
    );
    const val = (l: Row): string | number => (sort.key === "score" ? l.score.total : sort.key === "stage" ? STAGES.indexOf(l.stage) : ((l[sort.key] as string | number | undefined) ?? (typeof l.rating === "number" ? -1 : "")));
    return r.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va === vb) return 0;
      if (va === "" || va == null) return 1;
      if (vb === "" || vb == null) return -1;
      return (va > vb ? 1 : -1) * sort.dir;
    });
  }, [rows, q, f, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = filtered.slice(cur * PAGE, cur * PAGE + PAGE);
  const selIds = [...sel].filter((id) => leads.some((l) => l.id === id));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => sel.has(r.id));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cn("px-3 py-2 text-left font-medium", cls)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "score" ? -1 : 1 }))}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  const doExport = (ids: string[]) => {
    const s = getState();
    const data = ids.map((id) => s.leads[id]).filter((x): x is Lead => !!x);
    if (!data.length) { toast.error("Nothing to export."); return; }
    download(`${exportName}-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(data, includeNotes));
    logActivity({ kind: "export", text: `Exported ${data.length} leads to CSV` });
    toast.success(`Exported ${data.length} leads`);
  };

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} className={cn("rounded-sm border px-2 py-1 text-xs transition-colors", active ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{label}</button>
  );
  const setFilter = (p: TableFilters) => { setF((x) => ({ ...x, ...p })); setPage(0); };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search within results" className="h-9 pl-8" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chip(f.web === "none", "No website", () => setFilter({ web: f.web === "none" ? "" : "none" }))}
          {chip(f.web === "listed", "Website listed", () => setFilter({ web: f.web === "listed" ? "" : "listed" }))}
          {chip(f.web === "audited", "Audited", () => setFilter({ web: f.web === "audited" ? "" : "audited" }))}
          {chip(f.label === "High opportunity", "High opportunity", () => setFilter({ label: f.label === "High opportunity" ? "" : "High opportunity" }))}
          {chip(f.label === "Needs review", "Needs review", () => setFilter({ label: f.label === "Needs review" ? "" : "Needs review" }))}
          {chip(!!f.saved, "Saved", () => setFilter({ saved: !f.saved }))}
          {f.stage && chip(true, `Stage: ${f.stage} ×`, () => setFilter({ stage: "" }))}
          {(f.web || f.saved || f.label || f.stage || q) && (
            <button className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setF({}); setQ(""); }}><X className="size-3" />Clear</button>
          )}
        </div>
        <div className="flex gap-2 md:ml-auto">
          {toolbarExtra}
          <Button variant="outline" size="sm" onClick={() => doExport(filtered.map((r) => r.id))}><Download className="size-3.5" />Export view</Button>
        </div>
      </div>

      {selIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary-soft px-3 py-2 text-sm">
          <span className="tnum font-medium text-primary">{selIds.length} selected</span>
          <span className="mx-1 h-4 w-px bg-primary/20" />
          <Button size="sm" variant="ghost" className="h-7" onClick={() => { setSaved(selIds, true); toast.success(`Saved ${selIds.length} leads`); }}><Star className="size-3.5" />Save</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7">Add to list</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {lists.length === 0 && <DropdownMenuLabel className="font-normal text-muted-foreground">Create a list in Saved Lists first</DropdownMenuLabel>}
              {lists.map((l) => <DropdownMenuItem key={l.id} onClick={() => { const n = addToList(l.id, selIds); toast.success(`${n} added to ${l.name}${n < selIds.length ? ` (${selIds.length - n} already there)` : ""}`); }}>{l.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7">Set stage</Button></DropdownMenuTrigger>
            <DropdownMenuContent>{STAGES.map((s) => <DropdownMenuItem key={s} onClick={() => setStage(selIds, s)}>{s}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => copyContacts(selIds)}><Copy className="size-3.5" />Copy contacts</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => doExport(selIds)}><Download className="size-3.5" />Export</Button>
          {onRemove && <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => { onRemove(selIds); setSel(new Set()); }}><Trash2 className="size-3.5" />{removeLabel}</Button>}
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSel(new Set())}>Clear selection</button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2"><Checkbox aria-label="Select page" checked={allOnPage} onCheckedChange={(c) => setSel((s) => { const n = new Set(s); pageRows.forEach((r) => (c ? n.add(r.id) : n.delete(r.id))); return n; })} /></th>
              {th("name", "Business")}
              {th("category", "Category", "hidden xl:table-cell")}
              {th("city", "Location")}
              <th className="px-3 py-2 text-left font-medium">Phone</th>
              {th("websiteStatus", "Website")}
              {th("rating", "Rating", "hidden xl:table-cell")}
              {th("reviewCount", "Reviews", "hidden xl:table-cell")}
              {th("score", "Score")}
              {th("stage", "Stage", "hidden lg:table-cell")}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageRows.map((l) => (
              <tr key={l.id} className={cn("group hover:bg-secondary/60", sel.has(l.id) && "bg-primary-soft/50")}>
                <td className="px-3 py-2"><Checkbox aria-label={`Select ${l.name}`} checked={sel.has(l.id)} onCheckedChange={() => toggle(l.id)} /></td>
                <td className="max-w-[260px] px-3 py-2">
                  <button onClick={() => openLead(l.id)} className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline" title={l.name}>
                    {l.saved && <Star className="mr-1 inline size-3 fill-primary text-primary" />}{l.name}
                  </button>
                </td>
                <td className="hidden max-w-[150px] truncate px-3 py-2 text-muted-foreground xl:table-cell">{l.category}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={[l.address, l.city].filter(Boolean).join(", ")}>{[l.address, l.city].filter(Boolean).join(", ") || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 tnum">{l.phone ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <WebsiteStatusBadge status={l.websiteStatus} />
                    {l.website && <a href={l.website} target="_blank" rel="noreferrer noopener" className="max-w-[180px] truncate text-xs text-muted-foreground hover:text-primary" title={l.website}>{l.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
                  </div>
                </td>
                <td className="hidden px-3 py-2 tnum xl:table-cell">{l.rating ?? <span className="text-muted-foreground" title="Not provided by the data source">n/a</span>}</td>
                <td className="hidden px-3 py-2 tnum xl:table-cell">{l.reviewCount ?? <span className="text-muted-foreground">n/a</span>}</td>
                <td className="px-3 py-2"><ScoreBadge score={l.score} /></td>
                <td className="hidden px-3 py-2 lg:table-cell"><StageBadge stage={l.stage} /></td>
                <td className="px-2 py-2"><RowMenu lead={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No leads match these filters.</p>}
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {pageRows.map((l) => (
          <div key={l.id} className="rounded-md border p-3">
            <div className="flex items-start gap-2.5">
              <Checkbox className="mt-0.5" checked={sel.has(l.id)} onCheckedChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} />
              <button className="min-w-0 flex-1 text-left" onClick={() => openLead(l.id)}>
                <p className="break-words font-medium">{l.name}</p>
                <p className="truncate text-xs text-muted-foreground">{l.category} · {[l.address, l.city].filter(Boolean).join(", ")}</p>
              </button>
              <RowMenu lead={l} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <WebsiteStatusBadge status={l.websiteStatus} />
              <StageBadge stage={l.stage} />
              <ScoreBadge score={l.score} className="ml-auto" />
            </div>
          </div>
        ))}
        {pageRows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No leads match these filters.</p>}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tnum">{filtered.length ? `${cur * PAGE + 1}–${Math.min(filtered.length, cur * PAGE + PAGE)} of ${filtered.length}` : "0 results"}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-7" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
          <span className="tnum px-2">Page {cur + 1} / {pages}</span>
          <Button variant="outline" size="icon" className="size-7" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ lead }: { lead: Lead }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Actions for ${lead.name}`}><MoreHorizontal className="size-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openLead(lead.id)}>Open details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setSaved([lead.id], !lead.saved)}>{lead.saved ? "Unsave" : "Save prospect"}</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Set stage</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>{STAGES.map((s) => <DropdownMenuItem key={s} onClick={() => setStage([lead.id], s)}>{s}</DropdownMenuItem>)}</DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copyContacts([lead.id])}><Copy className="size-3.5" />Copy contact details</DropdownMenuItem>
        {lead.website && <DropdownMenuItem onClick={() => auditLead(lead.id)}><Globe className="size-3.5" />Check website</DropdownMenuItem>}
        {lead.website && <DropdownMenuItem asChild><a href={lead.website} target="_blank" rel="noreferrer noopener"><ExternalLink className="size-3.5" />Open website</a></DropdownMenuItem>}
        {lead.sourceUrl && <DropdownMenuItem asChild><a href={lead.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" />Open source listing</a></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { WEBSITE_STATUS_LABEL };
