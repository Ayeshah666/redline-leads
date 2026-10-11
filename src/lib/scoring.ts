import type { Lead } from "./types";

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  evidence: string;
}

export interface Score {
  total: number;
  label: "High opportunity" | "Potential opportunity" | "Needs review";
  confidence: "High" | "Medium" | "Low";
  components: ScoreComponent[];
  evaluatedAt?: string;
}

export const SCORE_THRESHOLDS = { high: 60, potential: 35 };

const BOOKING_CATEGORIES = /salon|beauty|barber|hair|dent|gym|fitness|yoga|spa|groom|clinic|massage|nail|physio|tattoo|restaurant|auto|car|repair|plumb|electric/i;

export function scoreLead(lead: Lead): Score {
  const audit = lead.audits[0];
  const c: ScoreComponent[] = [];

  // 1. Website presence
  if (lead.websiteStatus === "none") {
    c.push({ key: "web", label: "No website in listing", points: 35, max: 35, evidence: `The ${lead.source} listing has no website field. This does not prove the business has no site.` });
  } else if (lead.websiteStatus === "unavailable") {
    c.push({ key: "web", label: "Listed website unreachable", points: 25, max: 35, evidence: `A check of ${lead.website} failed${audit?.error ? `: ${audit.error}` : ""}. It may be temporary.` });
  } else if (lead.websiteStatus === "needs_check") {
    c.push({ key: "web", label: "Website unknown", points: 0, max: 35, evidence: "No website information is available yet; no points awarded." });
  } else {
    c.push({ key: "web", label: "Website listed", points: 0, max: 35, evidence: `Website listed: ${lead.website}` });
  }

  // 2. Usability problems from a real audit
  if (audit && audit.reachable) {
    const fails = audit.checks.filter((x) => x.status === "fail");
    const warns = audit.checks.filter((x) => x.status === "warn");
    const pts = Math.min(25, fails.length * 6 + warns.length * 3);
    c.push({
      key: "audit",
      label: "Documented website issues",
      points: pts,
      max: 25,
      evidence: pts ? `Audit found ${fails.length} failed and ${warns.length} warning checks: ${[...fails, ...warns].slice(0, 3).map((x) => x.label).join(", ")}.` : "Audit found no notable issues.",
    });
  } else {
    c.push({ key: "audit", label: "Documented website issues", points: 0, max: 25, evidence: "No completed audit — no points awarded." });
  }

  // 3. Contact info
  const contacts = [lead.phone && "phone", lead.email && "email"].filter(Boolean) as string[];
  c.push({
    key: "contact",
    label: "Public contact available",
    points: contacts.length === 2 ? 15 : contacts.length === 1 ? 10 : 0,
    max: 15,
    evidence: contacts.length ? `Listing includes ${contacts.join(" and ")}.` : "No public phone or email in the data.",
  });

  // 4. Activity evidence
  const act: string[] = [];
  let ap = 0;
  if (lead.openingHours) { act.push("opening hours published"); ap += 8; }
  if (lead.reviewCount && lead.reviewCount > 0) { act.push(`${lead.reviewCount} reviews`); ap += 7; }
  if (lead.address) { act.push("street address"); ap += 4; }
  c.push({ key: "activity", label: "Evidence of activity", points: Math.min(15, ap), max: 15, evidence: act.length ? `Data shows ${act.join(", ")}.` : "No activity signals in the data." });

  // 5. Booking/inquiry opportunity
  const bookingCat = BOOKING_CATEGORIES.test(lead.category);
  const noBooking = audit?.checks.find((x) => x.id === "booking")?.status === "fail";
  let bp = 0;
  let be = "Category is not typically appointment- or inquiry-driven, or no evidence.";
  if (bookingCat && (lead.websiteStatus === "none" || noBooking)) {
    bp = 10;
    be = noBooking ? "Appointment-driven category and the audited site shows no booking link." : "Appointment-driven category with no listed website.";
  } else if (bookingCat) {
    bp = 0;
    be = "Appointment-driven category, but no evidence of a missing booking flow yet.";
  }
  c.push({ key: "booking", label: "Booking / inquiry opportunity", points: bp, max: 10, evidence: be });

  const total = c.reduce((a, b) => a + b.points, 0);
  const fields = [lead.phone, lead.address, lead.website || lead.websiteStatus === "none", lead.openingHours, audit].filter(Boolean).length;
  const confidence = fields >= 4 ? "High" : fields >= 2 ? "Medium" : "Low";
  return {
    total,
    label: total >= SCORE_THRESHOLDS.high ? "High opportunity" : total >= SCORE_THRESHOLDS.potential ? "Potential opportunity" : "Needs review",
    confidence,
    components: c,
    evaluatedAt: audit?.checkedAt ?? lead.lastCheckedAt ?? lead.discoveredAt,
  };
}

export function scoreExplanation(s: Score) {
  return s.components.filter((x) => x.points > 0).map((x) => `${x.label} +${x.points}`).join("; ") || "No scoring evidence";
}
