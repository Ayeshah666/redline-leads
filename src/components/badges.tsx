import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { WebsiteStatus } from "@/lib/types";
import { WEBSITE_STATUS_LABEL } from "@/lib/types";
import type { Score } from "@/lib/scoring";

export const pill = cva("inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none", {
  variants: {
    tone: {
      neutral: "border-border bg-secondary text-muted-foreground",
      red: "border-primary/20 bg-primary-soft text-primary",
      green: "border-success/25 bg-success-soft text-success",
      amber: "border-warning/30 bg-warning-soft text-warning",
      blue: "border-info/25 bg-info-soft text-info",
    },
  },
  defaultVariants: { tone: "neutral" },
});

const WS_TONE: Record<WebsiteStatus, "neutral" | "red" | "green" | "amber" | "blue"> = {
  listed: "blue",
  none: "red",
  needs_check: "neutral",
  unavailable: "amber",
  audited: "green",
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  return (
    <span className={pill({ tone: WS_TONE[status] })}>
      <span className="size-1.5 rounded-full bg-current" />
      {WEBSITE_STATUS_LABEL[status]}
    </span>
  );
}

export function ScoreBadge({ score, className }: { score: Score; className?: string }) {
  const tone = score.label === "High opportunity" ? "red" : score.label === "Potential opportunity" ? "amber" : "neutral";
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`${score.label} · ${score.confidence} confidence`}>
      <span className="tnum w-6 text-right text-sm font-semibold">{score.total}</span>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", tone === "red" ? "bg-primary" : tone === "amber" ? "bg-warning" : "bg-muted-foreground/50")}
          style={{ width: `${score.total}%` }}
        />
      </span>
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stage === "Won" ? "green" : stage === "Lost" ? "neutral" : stage === "New" ? "neutral" : stage === "Meeting booked" || stage === "Interested" ? "red" : "blue";
  return <span className={pill({ tone })}>{stage}</span>;
}
