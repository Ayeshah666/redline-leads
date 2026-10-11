import { useSyncExternalStore } from "react";
import type { Activity, Lead, SavedList, SearchRecord, Settings, Stage } from "./types";

const KEY = "redline-leads:v1";

export interface State {
  leads: Record<string, Lead>;
  lists: SavedList[];
  history: SearchRecord[];
  activity: Activity[];
  settings: Settings;
}

const empty = (): State => ({
  leads: {},
  lists: [],
  history: [],
  activity: [],
  settings: {
    displayName: "",
    defaultLocation: "",
    defaultCategories: ["Beauty salons", "Restaurants", "Dentists"],
    defaultRadiusKm: 5,
    exportIncludeNotes: true,
  },
});

const SERVER_STATE = empty();
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    const base = empty();
    state = raw ? { ...base, ...JSON.parse(raw), settings: { ...base.settings, ...JSON.parse(raw).settings } } : base;
  } catch {
    state = empty();
  }
  return state!;
}

function commit(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full: keep in memory */
  }
  listeners.forEach((l) => l());
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function getState() {
  return load();
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(load()),
    () => select(SERVER_STATE),
  );
}

function update(fn: (s: State) => State) {
  commit(fn(load()));
}

export function logActivity(a: Omit<Activity, "id" | "at">) {
  update((s) => ({
    ...s,
    activity: [{ ...a, id: uid(), at: new Date().toISOString() }, ...s.activity].slice(0, 200),
  }));
}

/** Insert leads, de-duplicating by sourceId and by normalized name+address. Returns stored ids. */
export function upsertLeads(incoming: Lead[]): { ids: string[]; added: number; duplicates: number } {
  const s = load();
  const leads = { ...s.leads };
  const bySource = new Map(Object.values(leads).map((l) => [l.sourceId, l.id]));
  const byKey = new Map(Object.values(leads).map((l) => [dedupeKey(l), l.id]));
  const ids: string[] = [];
  let added = 0;
  let duplicates = 0;
  for (const l of incoming) {
    const existing = bySource.get(l.sourceId) ?? byKey.get(dedupeKey(l));
    if (existing) {
      duplicates++;
      const old = leads[existing]!;
      // refresh public fields, keep user fields
      leads[existing] = {
        ...old,
        phone: l.phone ?? old.phone,
        website: l.website ?? old.website,
        address: l.address ?? old.address,
        openingHours: l.openingHours ?? old.openingHours,
        websiteStatus: old.websiteStatus === "audited" || old.websiteStatus === "unavailable" ? old.websiteStatus : l.website ? "listed" : old.websiteStatus,
      };
      if (!ids.includes(existing)) ids.push(existing);
    } else {
      leads[l.id] = l;
      bySource.set(l.sourceId, l.id);
      byKey.set(dedupeKey(l), l.id);
      ids.push(l.id);
      added++;
    }
  }
  commit({ ...s, leads });
  return { ids, added, duplicates };
}

export function dedupeKey(l: Pick<Lead, "name" | "address" | "city">) {
  const n = (x?: string) => (x ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${n(l.name)}|${n(l.address || l.city)}`;
}

export function patchLead(id: string, patch: Partial<Lead>) {
  update((s) => (s.leads[id] ? { ...s, leads: { ...s.leads, [id]: { ...s.leads[id], ...patch } } } : s));
}

export function setStage(ids: string[], stage: Stage) {
  update((s) => {
    const leads = { ...s.leads };
    ids.forEach((id) => leads[id] && (leads[id] = { ...leads[id], stage }));
    return { ...s, leads };
  });
  logActivity({
    kind: "stage",
    text: ids.length === 1 ? `${load().leads[ids[0]!]?.name} moved to ${stage}` : `${ids.length} leads moved to ${stage}`,
    leadId: ids.length === 1 ? ids[0] : undefined,
  });
}

export function setSaved(ids: string[], saved: boolean) {
  update((s) => {
    const leads = { ...s.leads };
    ids.forEach((id) => leads[id] && (leads[id] = { ...leads[id], saved }));
    return { ...s, leads };
  });
  if (saved) logActivity({ kind: "save", text: `Saved ${ids.length} lead${ids.length === 1 ? "" : "s"}`, link: "/leads?saved=1" });
}

export function deleteLeads(ids: string[]) {
  update((s) => {
    const leads = { ...s.leads };
    ids.forEach((id) => delete leads[id]);
    return { ...s, leads, lists: s.lists.map((l) => ({ ...l, leadIds: l.leadIds.filter((x) => !ids.includes(x)) })) };
  });
}

export function createList(name: string) {
  const list: SavedList = { id: uid(), name: name.trim(), leadIds: [], createdAt: new Date().toISOString() };
  update((s) => ({ ...s, lists: [...s.lists, list] }));
  logActivity({ kind: "list", text: `Created list “${list.name}”`, link: "/lists" });
  return list.id;
}
export function renameList(id: string, name: string) {
  update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) }));
}
export function deleteList(id: string) {
  update((s) => ({ ...s, lists: s.lists.filter((l) => l.id !== id) }));
}
export function addToList(listId: string, ids: string[]) {
  let added = 0;
  update((s) => ({
    ...s,
    leads: Object.fromEntries(Object.entries(s.leads).map(([k, v]) => [k, ids.includes(k) ? { ...v, saved: true } : v])),
    lists: s.lists.map((l) => {
      if (l.id !== listId) return l;
      const fresh = ids.filter((x) => !l.leadIds.includes(x));
      added = fresh.length;
      return { ...l, leadIds: [...l.leadIds, ...fresh] };
    }),
  }));
  return added;
}
export function removeFromList(listId: string, ids: string[]) {
  update((s) => ({ ...s, lists: s.lists.map((l) => (l.id === listId ? { ...l, leadIds: l.leadIds.filter((x) => !ids.includes(x)) } : l)) }));
}

export function addHistory(r: SearchRecord) {
  update((s) => ({ ...s, history: [r, ...s.history].slice(0, 100) }));
}
export function clearHistory() {
  update((s) => ({ ...s, history: [] }));
}
export function clearActivity() {
  update((s) => ({ ...s, activity: [] }));
}
export function updateSettings(p: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...p } }));
}
export function resetAll() {
  commit(empty());
}
export function exportBackup() {
  return JSON.stringify(load(), null, 2);
}
