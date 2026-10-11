import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { CATEGORY_PRESETS } from "@/lib/osm";
import { clearActivity, clearHistory, exportBackup, resetAll, updateSettings, useStore } from "@/lib/store";
import { download } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Redline Leads" },
      { name: "description", content: "Profile, search defaults, export preferences, data sources and data deletion." },
      { property: "og:title", content: "Settings — Redline Leads" },
      { property: "og:description", content: "Configure your Redline Leads workspace." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b py-6 md:grid-cols-[260px_1fr]">
      <div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{desc}</p></div>
      <div className="max-w-xl space-y-3">{children}</div>
    </section>
  );
}

function Danger({ label, desc, onConfirm }: { label: string; desc: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">{label}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{desc}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { onConfirm(); toast.success("Done"); }}>Confirm</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SettingsPage() {
  const s = useStore((x) => x.settings);
  const [name, setName] = useState("");
  const [loc, setLoc] = useState("");
  useEffect(() => { setName(s.displayName); setLoc(s.defaultLocation); }, [s.displayName, s.defaultLocation]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace preferences and data controls." />
      <Section title="Profile" desc="Shown in the sidebar. Stored only in this browser.">
        <Label htmlFor="n" className="text-xs">Display name</Label>
        <div className="flex gap-2"><Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /><Button onClick={() => { updateSettings({ displayName: name.trim() }); toast.success("Profile saved"); }}>Save</Button></div>
      </Section>
      <Section title="Search defaults" desc="Pre-filled on Find Leads.">
        <Label htmlFor="l" className="text-xs">Default location</Label>
        <div className="flex gap-2"><Input id="l" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Karachi" /><Button onClick={() => { updateSettings({ defaultLocation: loc.trim() }); toast.success("Default location saved"); }}>Save</Button></div>
        <Label className="text-xs">Default radius</Label>
        <div className="flex gap-1.5">{[1, 2, 5, 10, 15, 25].map((r) => <button key={r} onClick={() => updateSettings({ defaultRadiusKm: r })} className={cn("rounded-sm border px-2.5 py-1 text-xs", s.defaultRadiusKm === r ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}>{r} km</button>)}</div>
        <Label className="text-xs">Favorite categories (shown first)</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(CATEGORY_PRESETS).map((c) => {
            const on = s.defaultCategories.includes(c);
            return <button key={c} onClick={() => updateSettings({ defaultCategories: on ? s.defaultCategories.filter((x) => x !== c) : [...s.defaultCategories, c] })} className={cn("rounded-sm border px-2 py-0.5 text-xs", on ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}>{c}</button>;
          })}
        </div>
      </Section>
      <Section title="Export preferences" desc="Applies to every CSV export.">
        <label className="flex items-center justify-between gap-4 text-sm">Include private notes in exports<Switch checked={s.exportIncludeNotes} onCheckedChange={(v) => updateSettings({ exportIncludeNotes: v })} /></label>
      </Section>
      <Section title="Theme" desc="Light theme is optimized for long prospecting sessions.">
        <p className="text-sm text-muted-foreground">Light (default). A dark theme isn't available yet.</p>
      </Section>
      <Section title="Data sources" desc="Free, open data — no paid APIs.">
        <ul className="space-y-2 text-sm">
          <li><span className="font-medium">OpenStreetMap via Overpass API</span> — business listings. © OpenStreetMap contributors, ODbL. <a className="text-primary hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">License</a></li>
          <li><span className="font-medium">Nominatim</span> — location lookup, throttled to 1 request/second per its <a className="text-primary hover:underline" href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">usage policy</a>.</li>
          <li><span className="font-medium">Website audit</span> — our own server fetches only the public homepage HTML.</li>
        </ul>
        <p className="text-xs text-muted-foreground">OpenStreetMap does not include ratings or review counts; those fields appear only for imported leads.</p>
      </Section>
      <Section title="Account & storage" desc="This workspace runs in local mode — data lives in this browser only.">
        <p className="text-sm text-muted-foreground">Clearing browser data deletes your leads. Download a backup regularly. Cloud accounts with sync can be enabled later.</p>
        <Button variant="outline" size="sm" onClick={() => download(`redline-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup(), "application/json")}>Download backup (JSON)</Button>
      </Section>
      <Section title="Data retention" desc="Delete data permanently from this browser.">
        <div className="flex flex-wrap gap-2">
          <Danger label="Clear search history" desc="Removes the search log. Leads are kept." onConfirm={clearHistory} />
          <Danger label="Clear activity feed" desc="Removes recent activity entries." onConfirm={clearActivity} />
          <Danger label="Delete all data" desc="Deletes every lead, list, note, audit and setting in this browser. This cannot be undone." onConfirm={resetAll} />
        </div>
      </Section>
      <Section title="Help" desc="Documentation and support.">
        <div className="flex flex-col gap-1 text-sm">
          <a className="text-primary hover:underline" href="https://wiki.openstreetmap.org/wiki/Map_features" target="_blank" rel="noreferrer">How OpenStreetMap tags businesses</a>
          <a className="text-primary hover:underline" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report missing or wrong map data</a>
        </div>
      </Section>
    </>
  );
}
