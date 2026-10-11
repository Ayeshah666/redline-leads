import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BookOpen, Bookmark, Database, FileUp, Gauge, History, LayoutGrid, Menu, Search, Settings, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { LeadDetailSheet } from "./lead-detail";

export const APP_NAME = "Redline Leads";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/find", label: "Find Leads", icon: Search },
  { to: "/leads", label: "All Leads", icon: Users },
  { to: "/lists", label: "Saved Lists", icon: Bookmark },
  { to: "/audit", label: "Website Audit", icon: Gauge },
  { to: "/import-export", label: "Import & Export", icon: FileUp },
  { to: "/history", label: "Search History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="brand-mark size-5" aria-hidden />
      <span className="text-[15px] font-semibold tracking-tight">
        Redline<span className="font-normal text-muted-foreground"> Leads</span>
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const count = useStore((s) => Object.keys(s.leads).length);
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
            <Icon className={cn("size-4", active && "text-primary")} />
            {label}
            {to === "/leads" && count > 0 && <span className="tnum ml-auto text-xs text-muted-foreground">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const name = useStore((s) => s.settings.displayName);
  return (
    <div className="mt-auto space-y-3 border-t pt-4 text-xs">
      <div className="flex items-start gap-2 rounded-md bg-secondary p-2.5 text-muted-foreground">
        <Database className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <p className="font-medium text-foreground">OpenStreetMap data</p>
          <p>via Nominatim + Overpass · © OSM contributors</p>
        </div>
      </div>
      <a href="https://wiki.openstreetmap.org/wiki/Map_features" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
        <BookOpen className="size-3.5" /> Data documentation
      </a>
      <Link to="/settings" className="flex items-center gap-2.5 rounded-md p-1 hover:bg-sidebar-accent">
        <span className="grid size-7 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
          {(name || "Y").slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{name || "You"}</span>
          <span className="block text-muted-foreground">Local workspace</span>
        </span>
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="mb-6 px-2.5"><Wordmark /></div>
        <NavList />
        <SidebarFooter />
      </aside>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
        <Wordmark />
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Menu className="size-5" />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-sidebar px-3 py-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6 px-2.5"><Wordmark /></div>
          <NavList onNavigate={() => setOpen(false)} />
          <SidebarFooter />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <div className="border-b bg-warning-soft px-4 py-1.5 text-center text-xs text-warning lg:px-8">
          Local mode — your leads, lists and notes are stored in this browser only and won't sync across devices.
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <LeadDetailSheet />
    </div>
  );
}
