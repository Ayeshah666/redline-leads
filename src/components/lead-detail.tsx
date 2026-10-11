import { useState } from "react";
import { Copy, ExternalLink, Globe, Loader2, MapPin, Phone, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { addToList, patchLead, removeFromList, setSaved, setStage, useStore } from "@/lib/store";
import { auditLead, openLead, useOpenLead } from "@/lib/lead-actions";
import { scoreLead, SCORE_THRESHOLDS } from "@/lib/scoring";
import { STAGES, type Stage } from "@/lib/types";
import { ScoreBadge, WebsiteStatusBadge, pill } from "./badges";
import { AuditReport } from "./audit-report";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function LeadDetailSheet() {
  const id = useOpenLead();
  const lead = useStore((s) => (id ? s.leads[id] : undefined));
  const lists = useStore((s) => s.lists);
  const [auditing, setAuditing] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  if (!lead) return <Sheet open={false} />;
  const sc = scoreLead(lead);
  const noteVal = notes ?? lead.notes;

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) { openLead(null); setNotes(null); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className={pill()}>{lead.category}</span>
            <span className={pill()}>{lead.source}</span>
          </div>
          <SheetTitle className="text-lg leading-tight">{lead.name}</SheetTitle>
          <SheetDescription>Discovered {new Date(lead.discoveredAt).toLocaleDateString()} · last checked {lead.lastCheckedAt ? new Date(lead.lastCheckedAt).toLocaleString() : "never"}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Lead stage</p>
            <Select value={lead.stage} onValueChange={(v) => setStage([lead.id], v as Stage)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant={lead.saved ? "outline" : "default"} size="sm" className="w-full" onClick={() => setSaved([lead.id], !lead.saved)}>
              {lead.saved ? "Saved — unsave" : "Save prospect"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="mt-5">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="score">Score</TabsTrigger>
            <TabsTrigger value="audits">Audits ({lead.audits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="divide-y rounded-md border px-3">
              <Row icon={<MapPin className="size-4" />}>{[lead.address, lead.city].filter(Boolean).join(", ") || <span className="text-muted-foreground">No address in data</span>}</Row>
              <Row icon={<Phone className="size-4" />}>{lead.phone ? <a className="hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : <span className="text-muted-foreground">No public phone</span>}</Row>
              {lead.email && <Row icon={<Mail className="size-4" />}><a className="hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a></Row>}
              <Row icon={<Globe className="size-4" />}>
                <div className="flex flex-wrap items-center gap-2">
                  {lead.website ? <a href={lead.website} target="_blank" rel="noreferrer noopener" className="break-all text-primary hover:underline">{lead.website}</a> : <span className="text-muted-foreground">No website in listing</span>}
                  <WebsiteStatusBadge status={lead.websiteStatus} />
                </div>
              </Row>
              {lead.openingHours && <Row icon={<Clock className="size-4" />}>{lead.openingHours}</Row>}
              <Row icon={<span className="text-xs">★</span>}>
                {lead.rating != null ? `${lead.rating} rating · ${lead.reviewCount ?? 0} reviews` : <span className="text-muted-foreground">Rating not available from this source</span>}
              </Row>
            </div>
            <div className="flex flex-wrap gap-2">
              {lead.sourceUrl && <Button asChild variant="outline" size="sm"><a href={lead.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" />Source listing</a></Button>}
              {lead.website && (
                <Button variant="outline" size="sm" disabled={auditing} onClick={async () => { setAuditing(true); await auditLead(lead.id); setAuditing(false); }}>
                  {auditing ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}Check website
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(outreach(lead, sc)); toast.success("Outreach draft copied"); }}>
                <Copy className="size-3.5" />Copy outreach draft
              </Button>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium">Notes</p>
              <Textarea rows={4} value={noteVal} placeholder="Add research notes, call outcomes…" onChange={(e) => setNotes(e.target.value)} />
              <div className="mt-2 flex justify-end">
                <Button size="sm" disabled={notes === null || notes === lead.notes} onClick={() => { patchLead(lead.id, { notes: noteVal }); setNotes(null); toast.success("Notes saved"); }}>Save notes</Button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium">Saved lists</p>
              {lists.length === 0 ? <p className="text-sm text-muted-foreground">No lists yet. Create one in Saved Lists.</p> : (
                <div className="space-y-1.5">
                  {lists.map((l) => {
                    const on = l.leadIds.includes(lead.id);
                    return (
                      <label key={l.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={on} onCheckedChange={(c) => (c ? addToList(l.id, [lead.id]) : removeFromList(l.id, [lead.id]))} />
                        {l.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="score" className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{sc.label}</p>
                <p className="text-xs text-muted-foreground">{sc.confidence} data confidence · evaluated {sc.evaluatedAt ? new Date(sc.evaluatedAt).toLocaleString() : "—"}</p>
              </div>
              <ScoreBadge score={sc} />
            </div>
            <ul className="divide-y rounded-md border">
              {sc.components.map((c) => (
                <li key={c.key} className="flex gap-3 px-3 py-2.5">
                  <span className="tnum w-12 shrink-0 text-sm font-semibold">{c.points}<span className="font-normal text-muted-foreground">/{c.max}</span></span>
                  <div><p className="text-sm">{c.label}</p><p className="text-xs text-muted-foreground">{c.evidence}</p></div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              High ≥ {SCORE_THRESHOLDS.high}, Potential ≥ {SCORE_THRESHOLDS.potential}. The score estimates website-development potential from available evidence; it does not predict whether the owner will buy a service.
            </p>
          </TabsContent>

          <TabsContent value="audits" className="space-y-6">
            {lead.audits.length === 0 ? <p className="text-sm text-muted-foreground">{lead.website ? "No website checks yet. Use “Check website”." : "No website URL to audit."}</p> : lead.audits.map((a) => <AuditReport key={a.id} result={a} compact />)}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function outreach(lead: { name: string; category: string; city?: string; audits: { checks: { status: string; label: string; detail: string }[] }[]; websiteStatus: string }, _sc: unknown) {
  const a = lead.audits[0];
  const fail = a?.checks.find((c) => c.status === "fail");
  const obs = fail ? `while checking your website that ${fail.detail.charAt(0).toLowerCase() + fail.detail.slice(1)}` : lead.websiteStatus === "none" ? "that I couldn't find a website listed for you on OpenStreetMap" : "[add a verified observation]";
  return `Hi ${lead.name},\n\nI came across your business while researching ${lead.category.toLowerCase()} in ${lead.city ?? "your area"}. I noticed ${obs}. I have a few ideas for improving how customers discover your services online. Would you be open to taking a look?\n\nBest,\n`;
}
