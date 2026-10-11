import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AuditCheck, AuditResult } from "./types";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 4;

function isPrivateIPv4(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
function isPrivateIPv6(ip: string) {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (x === "::" || x === "::1") return true;
  if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true;
  const mapped = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

async function resolveAll(host: string): Promise<string[]> {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
    });
    if (!r.ok) continue;
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
  }
  return out;
}

async function assertPublic(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http and https URLs can be audited.");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Only standard web ports (80/443) are allowed.");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal" || !host.includes(".")) {
    throw new Error("This host is not a public website.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) throw new Error("Private or reserved IP addresses are blocked.");
    return;
  }
  if (host.includes(":")) {
    if (isPrivateIPv6(host)) throw new Error("Private or reserved IP addresses are blocked.");
    return;
  }
  const ips = await resolveAll(host);
  if (!ips.length) throw new Error("The domain does not resolve (DNS lookup returned no address).");
  if (ips.some((ip) => (ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip)))) {
    throw new Error("The domain resolves to a private or reserved address and was blocked.");
  }
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", bytes: 0, truncated: false };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) { truncated = true; chunks.push(value.slice(0, value.byteLength - (bytes - MAX_BYTES))); await reader.cancel(); break; }
    chunks.push(value);
  }
  const all = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return { text: new TextDecoder().decode(all), bytes: Math.min(bytes, MAX_BYTES), truncated };
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
function meta(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : undefined;
}

export const runAudit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ url: z.string().min(3).max(2000) }).parse(d))
  .handler(async ({ data }): Promise<AuditResult> => {
    const checkedAt = new Date().toISOString();
    const id = crypto.randomUUID();
    let input = data.url.trim();
    if (!/^https?:\/\//i.test(input)) input = "https://" + input;
    const checks: AuditCheck[] = [];
    let url: URL;
    try { url = new URL(input); } catch {
      return { id, url: data.url, checkedAt, reachable: false, error: "Not a valid URL.", checks: [], suggestions: [] };
    }

    let res: Response | null = null;
    const started = Date.now();
    try {
      for (let i = 0; i <= MAX_REDIRECTS; i++) {
        await assertPublic(url);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
          res = await fetch(url.toString(), {
            redirect: "manual",
            signal: ctrl.signal,
            headers: { "user-agent": "RedlineLeadsAudit/1.0 (+website check)", accept: "text/html,*/*;q=0.5" },
          });
        } finally { clearTimeout(t); }
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          if (i === MAX_REDIRECTS) throw new Error("Too many redirects.");
          url = new URL(res.headers.get("location")!, url);
          continue;
        }
        break;
      }
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? `No response within ${TIMEOUT_MS / 1000}s.` : (e as Error).message || "Request failed.";
      return {
        id, url: input, checkedAt, reachable: false, error: msg,
        checks: [{ id: "reach", category: "Technical availability", label: "Site responds", status: "fail", detail: msg }],
        suggestions: ["Confirm the address is correct; the site may be down, blocked, or temporarily unreachable. A failed check does not prove the business has no website."],
      };
    }
    const r = res!;
    const ms = Date.now() - started;
    const ctype = r.headers.get("content-type") ?? "";
    const { text: html, bytes, truncated } = ctype.includes("html") ? await readLimited(r) : { text: "", bytes: 0, truncated: false };
    const ok = r.status >= 200 && r.status < 400;

    checks.push({ id: "reach", category: "Technical availability", label: "Site responds", status: ok ? "pass" : "fail", detail: `HTTP ${r.status} after ${ms} ms${url.toString() !== input ? ` (final URL ${url})` : ""}.` });
    checks.push({ id: "https", category: "Technical availability", label: "Uses HTTPS", status: url.protocol === "https:" ? "pass" : "fail", detail: url.protocol === "https:" ? "Final page is served over HTTPS." : "Final page is served over plain HTTP." });
    checks.push({ id: "speed", category: "Technical availability", label: "Server response time", status: ms < 1500 ? "pass" : ms < 4000 ? "warn" : "fail", detail: `Full response took ${ms} ms from our server (single measurement, not a Core Web Vitals score).` });
    if (bytes) checks.push({ id: "size", category: "Technical availability", label: "HTML size", status: bytes < 500_000 ? "pass" : "warn", detail: `${Math.round(bytes / 1024)} KB of HTML${truncated ? " (truncated at 1.5 MB)" : ""}.` });

    if (!html) {
      checks.push({ id: "html", category: "SEO basics", label: "HTML content", status: "unknown", detail: `Response was not HTML (${ctype || "unknown type"}); content checks skipped.` });
    }
    const title = html ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") : undefined;
    const description = html ? meta(html, "description") : undefined;
    if (html) {
      checks.push({ id: "title", category: "SEO basics", label: "Page title", status: !title ? "fail" : title.length < 10 || title.length > 70 ? "warn" : "pass", detail: title ? `“${title}” (${title.length} chars)` : "No <title> tag found." });
      checks.push({ id: "desc", category: "SEO basics", label: "Meta description", status: !description ? "fail" : description.length < 50 || description.length > 170 ? "warn" : "pass", detail: description ? `${description.length} characters.` : "No meta description found." });
      const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
      checks.push({ id: "h1", category: "SEO basics", label: "Main heading (H1)", status: h1 === 1 ? "pass" : h1 === 0 ? "warn" : "warn", detail: `${h1} H1 heading${h1 === 1 ? "" : "s"} found.` });
      const og = meta(html, "og:title");
      checks.push({ id: "og", category: "SEO basics", label: "Social sharing tags", status: og ? "pass" : "warn", detail: og ? "Open Graph title present." : "No Open Graph tags; shared links may look plain." });
      const lang = /<html[^>]+lang=/i.test(html);
      checks.push({ id: "lang", category: "SEO basics", label: "Language declared", status: lang ? "pass" : "warn", detail: lang ? "<html lang> attribute present." : "No lang attribute on <html>." });

      const vp = meta(html, "viewport");
      checks.push({ id: "viewport", category: "Mobile readiness", label: "Mobile viewport", status: vp && /width=device-width/i.test(vp) ? "pass" : "fail", detail: vp ? `viewport: ${vp}` : "No viewport meta tag; the site likely renders zoomed-out on phones." });
      const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
      const noAlt = imgs.filter((t) => !/\salt=/i.test(t)).length;
      checks.push({ id: "alt", category: "Mobile readiness", label: "Image alt text", status: imgs.length === 0 ? "unknown" : noAlt === 0 ? "pass" : noAlt / imgs.length > 0.3 ? "fail" : "warn", detail: imgs.length ? `${noAlt} of ${imgs.length} images missing alt text.` : "No images found in initial HTML." });

      const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => `${m[1]} ${m[2].replace(/<[^>]+>/g, " ")}`.toLowerCase());
      const contact = links.some((l) => /contact|kontakt|contacto|get in touch/.test(l));
      const tel = /href=["']tel:/i.test(html);
      const mail = /href=["']mailto:/i.test(html);
      const booking = links.some((l) => /book|booking|appointment|reserve|reservation|schedule|calendly|fresha|booksy|opentable|setmore|square\.site/.test(l));
      const form = /<form\b/i.test(html);
      checks.push({ id: "contact", category: "Contact and conversion", label: "Contact page link", status: contact ? "pass" : "warn", detail: contact ? "A contact link is present on the homepage." : "No obvious contact link found on the homepage." });
      checks.push({ id: "tel", category: "Contact and conversion", label: "Click-to-call / email", status: tel || mail ? "pass" : "warn", detail: [tel && "tel: link", mail && "mailto: link"].filter(Boolean).join(", ") || "No tel: or mailto: links found." });
      checks.push({ id: "booking", category: "Contact and conversion", label: "Booking or reservation link", status: booking ? "pass" : "fail", detail: booking ? "Booking-related link detected." : "No booking, appointment, or reservation link detected on the homepage." });
      checks.push({ id: "form", category: "Contact and conversion", label: "Inquiry form", status: form ? "pass" : "warn", detail: form ? "A form is present on the homepage." : "No form on the homepage." });
    }

    const S: Record<string, string> = {
      https: "Move the site to HTTPS so browsers stop showing “Not secure”.",
      title: "Write a clear page title naming the business, service, and city.",
      desc: "Add a meta description summarizing services so search results look compelling.",
      viewport: "Make the site mobile-friendly — most local searches happen on phones.",
      booking: "Add an online booking or reservation option to capture customers directly.",
      contact: "Add a visible contact page or section.",
      tel: "Add tap-to-call and email links for mobile visitors.",
      speed: "Investigate slow server response; consider faster hosting or caching.",
      alt: "Add descriptive alt text to images for accessibility and search.",
      og: "Add social sharing tags so links shared on WhatsApp/Facebook show a preview.",
      reach: "Fix the site's availability — it returned an error status.",
    };
    const suggestions = checks.filter((c) => c.status === "fail" || (c.status === "warn" && ["contact", "tel", "og"].includes(c.id))).map((c) => S[c.id]).filter(Boolean);

    return { id, url: input, finalUrl: url.toString(), checkedAt, reachable: ok, httpStatus: r.status, responseMs: ms, bytes, title, description, checks, suggestions };
  });
