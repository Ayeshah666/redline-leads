import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, EmptyState } from "@/components/page-header";
import { LeadTable } from "@/components/lead-table";
import { createList, deleteList, removeFromList, renameList, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

export const Route = createFileRoute("/lists")({
  head: () => ({
    meta: [
      { title: "Saved Lists — Redline Leads" },
      { name: "description", content: "Organize prospects into lists, track stages and notes, and export to CSV." },
      { property: "og:title", content: "Saved Lists — Redline Leads" },
      { property: "og:description", content: "Organize prospects into named lists." },
    ],
  }),
  component: ListsPage,
});

function ListsPage() {
  const lists = useStore((s) => s.lists);
  const leads = useStore((s) => s.leads);
  const savedCount = useStore((s) => Object.values(s.leads).filter((l) => l.saved).length);
  const [active, setActive] = useState<string>("__saved");
  const [dialog, setDialog] = useState<{ mode: "new" | "rename"; id?: string; name: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const list = lists.find((l) => l.id === active);
  const current = active === "__saved" ? Object.values(leads).filter((l) => l.saved) : (list?.leadIds ?? []).map((id) => leads[id]).filter((x): x is Lead => !!x);

  const submit = () => {
    const name = dialog?.name.trim();
    if (!name) return;
    if (lists.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== dialog?.id)) { toast.error("A list with that name already exists."); return; }
    if (dialog?.mode === "new") setActive(createList(name));
    else if (dialog?.id) renameList(dialog.id, name);
    setDialog(null);
  };

  return (
    <>
      <PageHeader title="Saved Lists" subtitle="Group prospects, track progress and export." actions={<Button size="sm" onClick={() => setDialog({ mode: "new", name: "" })}><Plus className="size-4" />New list</Button>} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-0.5">
          <ListBtn active={active === "__saved"} onClick={() => setActive("__saved")} name="All saved prospects" count={savedCount} />
          <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your lists</p>
          {lists.length === 0 && <p className="px-2.5 text-xs text-muted-foreground">No lists yet — try “Karachi Salons”.</p>}
          {lists.map((l) => <ListBtn key={l.id} active={active === l.id} onClick={() => setActive(l.id)} name={l.name} count={l.leadIds.length} />)}
        </aside>
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-medium">{list?.name ?? "All saved prospects"}</h2>
            {list && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDialog({ mode: "rename", id: list.id, name: list.name })}><Pencil className="size-3.5" />Rename</Button>
                <Button size="sm" variant="ghost" className="text-primary" onClick={() => setDel(list.id)}><Trash2 className="size-3.5" />Delete</Button>
              </div>
            )}
          </div>
          {current.length === 0 ? (
            <EmptyState icon={<Bookmark className="size-6" />} title="This list is empty" body="Select leads in Find Leads or All Leads and use “Add to list” or “Save”." />
          ) : (
            <LeadTable key={active} leads={current} exportName={(list?.name ?? "saved-prospects").replace(/\W+/g, "-").toLowerCase()}
              onRemove={list ? (ids) => { removeFromList(list.id, ids); toast.success(`Removed ${ids.length} from ${list.name}`); } : undefined}
              removeLabel="Remove from list" />
          )}
        </section>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{dialog?.mode === "new" ? "New list" : "Rename list"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <Input autoFocus maxLength={60} value={dialog?.name ?? ""} onChange={(e) => setDialog((d) => d && { ...d, name: e.target.value })} placeholder="e.g. Potential Website Redesigns" />
            <DialogFooter className="mt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" disabled={!dialog?.name.trim()}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this list?</AlertDialogTitle><AlertDialogDescription>The leads stay in All Leads; only the list is removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (del) deleteList(del); setDel(null); setActive("__saved"); }}>Delete list</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ListBtn({ active, onClick, name, count }: { active: boolean; onClick: () => void; name: string; count: number }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm", active ? "bg-primary-soft font-medium text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <span className="truncate">{name}</span><span className="tnum text-xs">{count}</span>
    </button>
  );
}
