import type { Lead, SearchFilters } from "./types";
import { uid } from "./store";

export const CATEGORY_PRESETS: Record<string, string[]> = {
  "Beauty salons": ['["shop"="beauty"]'],
  Barbershops: ['["shop"="hairdresser"]'],
  Restaurants: ['["amenity"="restaurant"]'],
  Dentists: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  Gyms: ['["leisure"="fitness_centre"]'],
  "Yoga studios": ['["sport"="yoga"]'],
  "Auto repair shops": ['["shop"="car_repair"]'],
  "Pet groomers": ['["shop"="pet_grooming"]'],
  Plumbers: ['["craft"="plumber"]'],
  Electricians: ['["craft"="electrician"]'],
  Accountants: ['["office"="accountant"]'],
  "Real estate agencies": ['["office"="estate_agent"]'],
};

export class ProviderError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
  }
}

// Respect Nominatim's 1 request/second policy.
let lastNominatim = 0;
const geoCache = new Map<string, Geo>();
interface Geo { lat: number; lon: number; display: string; bbox: [number, number, number, number] }

export async function geocode(q: string, signal: AbortSignal | null = null): Promise<Geo> {
  const key = q.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  let res: Response;
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ProviderError("Could not reach the Nominatim geocoding service. Check your connection and retry.");
  }
  if (res.status === 429) throw new ProviderError("Nominatim rate limit reached. Wait a minute and retry.");
  if (!res.ok) throw new ProviderError(`Nominatim returned HTTP ${res.status}.`);
  const data = await res.json();
  if (!data.length) throw new ProviderError(`No location found for “${q}”. Try a more specific city name.`, false);
  const d = data[0];
  const bb = d.boundingbox.map(Number);
  const geo: Geo = { lat: +d.lat, lon: +d.lon, display: d.display_name, bbox: [bb[0], bb[2], bb[1], bb[3]] };
  geoCache.set(key, geo);
  return geo;
}

function selectors(category: string): string[] {
  const preset = CATEGORY_PRESETS[category];
  if (preset) return preset;
  const safe = category.replace(/["\\]/g, "").trim();
  return [
    `["name"~"${safe}",i]["shop"]`,
    `["name"~"${safe}",i]["amenity"]`,
    `["name"~"${safe}",i]["office"]`,
    `["name"~"${safe}",i]["craft"]`,
    `["shop"~"^${safe.toLowerCase().replace(/s$/, "")}",i]`,
    `["amenity"~"^${safe.toLowerCase().replace(/s$/, "")}",i]`,
  ];
}

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

export async function searchBusinesses(f: SearchFilters, signal: AbortSignal | null = null, onStatus?: (s: string) => void) {
  onStatus?.(`Locating “${f.location}”…`);
  const geo = await geocode(f.location, signal);
  const radius = Math.max(0.5, Math.min(25, f.radiusKm)) * 1000;
  const area = `(around:${radius},${geo.lat},${geo.lon})`;
  const sel = selectors(f.category);
  const q = `[out:json][timeout:25];(${sel.map((s) => `nwr${s}${area};`).join("")});out center tags 300;`;
  onStatus?.(`Querying OpenStreetMap within ${radius / 1000} km of ${geo.display.split(",")[0]}…`);
  let lastErr: Error | null = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (res.status === 429) { lastErr = new ProviderError("Overpass API is rate-limiting requests. Wait a minute and retry."); continue; }
      if (res.status === 504) { lastErr = new ProviderError("Overpass API timed out. Try a smaller radius or retry shortly."); continue; }
      if (!res.ok) { lastErr = new ProviderError(`Overpass API returned HTTP ${res.status}.`); continue; }
      const json = await res.json();
      return { leads: normalize(json.elements ?? [], f.category, geo.display), place: geo.display };
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      lastErr = new ProviderError("Could not reach the Overpass API. Check your connection and retry.");
    }
  }
  throw lastErr ?? new ProviderError("Business data provider unavailable.");
}

interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

export function normalizeUrl(u?: string) {
  if (!u) return undefined;
  const t = u.trim().split(/[;\s]/)[0];
  if (!t) return undefined;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { return new URL(withProto).toString(); } catch { return undefined; }
}

function normalize(els: El[], category: string, place: string): Lead[] {
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const e of els) {
    const t = e.tags ?? {};
    if (!t.name) continue;
    const website = normalizeUrl(t.website || t["contact:website"] || t.url);
    const addr = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    const city = t["addr:city"] || t["addr:suburb"] || place.split(",")[0];
    const key = `${t.name.toLowerCase()}|${addr.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: uid(),
      sourceId: `osm:${e.type}/${e.id}`,
      source: "OpenStreetMap",
      sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      name: t.name.trim(),
      category,
      address: [addr, t["addr:postcode"]].filter(Boolean).join(", ") || undefined,
      city,
      phone: (t.phone || t["contact:phone"])?.split(";")[0].trim(),
      email: t.email || t["contact:email"],
      website,
      openingHours: t.opening_hours,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
      websiteStatus: website ? "listed" : "none",
      stage: "New",
      notes: "",
      saved: false,
      discoveredAt: now,
      lastCheckedAt: now,
      audits: [],
    });
  }
  return out;
}
