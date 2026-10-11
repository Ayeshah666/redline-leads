import { createFileRoute, Link } from "@tanstack/react-router";
import { History, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader, EmptyState } from "@/components/page-header";
import { pill } from "@/components/badges";
import { clearHistory, useStore } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Search History — Redline Leads" },
      { name: "description", content: "Every search you've run, with filters, result counts and outcomes. Reopen or rerun any search." },
      { property: "og:title", content: "Search History — Redline Leads" },
      { property: "og:description", content: "Reopen and rerun past lead searches." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const history = useStore((s) => s.history);
  return (
    <>
      <PageHeader
        title="Search History"
        subtitle="Reopen stored results or rerun a search for fresh data."
        actions={history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm">Clear history</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Clear search history?</AlertDialogTitle><AlertDialogDescription>Your leads stay in All Leads; only the search log is removed.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={clearHistory}>Clear</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      />
      {history.length === 0 ? <EmptyState icon={<History className="size-6" />} title="No searches yet" action={<Button asChild size="sm"><Link to="/find">Find leads</Link></Button>} /> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 text-left font-medium">Search</th><th className="px-3 py-2 text-left font-medium">Filters</th><th className="px-3 py-2 text-left font-medium">When</th><th className="px-3 py-2 text-right font-medium">Results</th><th className="px-3 py-2 text-left font-medium">Outcome</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5"><p className="font-medium">{r.filters.category}</p><p className="text-xs text-muted-foreground">{r.filters.location}</p></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.filters.radiusKm} km · website: {r.filters.websiteFilter}<br />{r.provider}</td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</td>
                  <td className="tnum px-3 py-2.5 text-right">{r.resultCount}</td>
                  <td className="px-3 py-2.5"><span className={pill({ tone: r.outcome === "success" ? "green" : r.outcome === "empty" ? "neutral" : "red" })} title={r.error}>{r.outcome}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <Button asChild size="sm" variant="outline" className="h-7"><Link to="/find" search={{ h: r.id }}><RotateCw className="size-3.5" />Reopen</Link></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
