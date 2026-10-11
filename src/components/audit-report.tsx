import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import type { AuditCheck, AuditResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON = {
  pass: <CheckCircle2 className="size-4 text-success" />,
  warn: <AlertTriangle className="size-4 text-warning" />,
  fail: <XCircle className="size-4 text-primary" />,
  unknown: <CircleHelp className="size-4 text-muted-foreground" />,
};
const CATS: AuditCheck["category"][] = ["Technical availability", "SEO basics", "Mobile readiness", "Contact and conversion"];

export function AuditReport({ result, compact }: { result: AuditResult; compact?: boolean }) {
  const counts = { pass: 0, warn: 0, fail: 0, unknown: 0 };
  result.checks.forEach((c) => counts[c.status]++);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="truncate font-mono text-foreground">{result.finalUrl ?? result.url}</span>
        {result.httpStatus && <span>HTTP {result.httpStatus}</span>}
        {result.responseMs != null && <span className="tnum">{result.responseMs} ms</span>}
        <span>{new Date(result.checkedAt).toLocaleString()}</span>
      </div>
      {result.error && (
        <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          {result.error} — this check could not complete. It does not prove the site doesn't exist.
        </div>
      )}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1">{ICON.pass}<span className="tnum">{counts.pass}</span> passed</span>
        <span className="flex items-center gap-1">{ICON.warn}<span className="tnum">{counts.warn}</span> warnings</span>
        <span className="flex items-center gap-1">{ICON.fail}<span className="tnum">{counts.fail}</span> failed</span>
      </div>
      <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
        {CATS.map((cat) => {
          const items = result.checks.filter((c) => c.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="rounded-md border">
              <p className="border-b bg-secondary px-3 py-2 text-xs font-medium">{cat}</p>
              <ul className="divide-y">
                {items.map((c) => (
                  <li key={c.id} className="flex gap-2.5 px-3 py-2">
                    <span className="mt-0.5 shrink-0">{ICON[c.status]}</span>
                    <div className="min-w-0">
                      <p className="text-sm">{c.label}</p>
                      <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {result.suggestions.length > 0 && (
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium">Suggested improvements</p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {result.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
