import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, FileUp, Gauge, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/page-header";
import { useStore } from "@/lib/store";
import { scoreLead } from "@/lib/scoring";
import { openLead } from "@/lib/lead-actions";
import { CATEGORY_PRESETS } from "@/lib/osm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Redline Leads" },
      { name: "description", content: "Your prospecting activity, all in one place: leads, saved prospects and recent work." },
      { property: "og:title", content: "Overview — Redline Leads" },
      { property: "og:description", content: "Your prospecting activity, all in one place." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const leads = useStore((s) => s.leads);
  const activity = useStore((s) => s.activity);
  const all = Object.values(leads);
  const kpis = [
    { label: "Unique leads", value: all.length, search: {} },
    { label: "No website detected", value: all.filter((l) => l.websiteStatus === "none").length, search: { web: "none" } },
    { label: "Saved prospects", value: all.filter((l) => l.saved).length, search: { saved: true } },
    { label: "Need review", value: all.filter((l) => scoreLead(l).label === "Needs review" && l.stage === "New").length, search: { label: "Needs review" } },
  ] as const;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Your prospecting activity, all in one place."
        actions={<Button asChild><Link to="/find"><Search className="size-4" />Find new leads</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Link key={k.label} to="/leads" search={k.search} className="group bg-background p-4 transition-colors hover:bg-secondary">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`tnum mt-2 text-3xl font-semibold tracking-tight ${i === 1 && k.value > 0 ? "text-primary" : ""}`}>{k.value.toLocaleString()}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">View leads <ArrowRight className="size-3" /></p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-md border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-medium">Recent activity</h2>
            <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">Search history</Link>
          </div>
          {activity.length === 0 ? (
            <div className="p-4"><EmptyState title="No activity yet" body="Run your first search to start building a prospect list." action={<Button asChild size="sm"><Link to="/find">Find leads</Link></Button>} /></div>
          ) : (
            <ul className="divide-y">
              {activity.slice(0, 12).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-16 shrink-0 text-xs capitalize text-muted-foreground">{a.kind}</span>
                  {a.leadId && leads[a.leadId] ? (
                    <button className="min-w-0 flex-1 truncate text-left hover:text-primary" onClick={() => openLead(a.leadId!)}>{a.text}</button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  )}
                  <time className="tnum shrink-0 text-xs text-muted-foreground">{relTime(a.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="mb-3 text-sm font-medium">Quick actions</h2>
          <QA to="/find" icon={<Search className="size-4" />} title="Search a business category" body={Object.keys(CATEGORY_PRESETS).slice(0, 4).join(", ") + "…"} />
          <QA to="/find" icon={<MapPin className="size-4" />} title="Search a location" body="Any city, district or region" />
          <QA to="/import-export" icon={<FileUp className="size-4" />} title="Import a CSV" body="Bring your existing prospect lists" />
          <QA to="/lists" icon={<Bookmark className="size-4" />} title="Review saved leads" body="Lists, stages and notes" />
          <QA to="/audit" icon={<Gauge className="size-4" />} title="Audit a website" body="Check SEO, mobile and contact basics" />
        </section>
      </div>
    </>
  );
}

function QA({ to, icon, title, body }: { to: "/find" | "/import-export" | "/lists" | "/audit"; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary">
      <span className="grid size-8 place-items-center rounded-md bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
