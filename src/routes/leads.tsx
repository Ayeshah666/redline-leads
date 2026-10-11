import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, EmptyState } from "@/components/page-header";
import { LeadTable, type TableFilters } from "@/components/lead-table";
import { deleteLeads, useStore } from "@/lib/store";
import type { WebsiteStatus } from "@/lib/types";
import type { Score } from "@/lib/scoring";

export const Route = createFileRoute("/leads")({
  validateSearch: (s: Record<string, unknown>): { web?: string; saved?: boolean; label?: string; stage?: string } => ({
    web: typeof s.web === "string" ? s.web : undefined,
    saved: s.saved === true || s.saved === "1" || s.saved === "true" ? true : undefined,
    label: typeof s.label === "string" ? s.label : undefined,
    stage: typeof s.stage === "string" ? s.stage : undefined,
  }),
  head: () => ({
    meta: [
      { title: "All Leads — Redline Leads" },
      { name: "description", content: "Every business you've discovered or imported, with scores, stages and website status." },
      { property: "og:title", content: "All Leads — Redline Leads" },
      { property: "og:description", content: "Every discovered business in one sortable table." },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const search = Route.useSearch();
  const leadsMap = useStore((s) => s.leads);
  const leads = Object.values(leadsMap);
  const [pending, setPending] = useState<string[] | null>(null);
  const init: TableFilters = { web: (search.web as WebsiteStatus) ?? "", saved: search.saved, label: (search.label as Score["label"]) ?? "", stage: search.stage };

  return (
    <>
      <PageHeader title="All Leads" subtitle={`${leads.length} unique businesses from searches and imports.`} />
      {leads.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="No leads yet" body="Search OpenStreetMap or import a CSV to get started." action={<div className="flex gap-2"><Button asChild size="sm"><Link to="/find">Find leads</Link></Button><Button asChild size="sm" variant="outline"><Link to="/import-export">Import CSV</Link></Button></div>} />
      ) : (
        <LeadTable key={JSON.stringify(search)} leads={leads} initialFilters={init} onRemove={setPending} removeLabel="Delete" exportName="all-leads" />
      )}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pending?.length} lead{pending?.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This removes them, their notes and audit history from every list. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pending) deleteLeads(pending); setPending(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
