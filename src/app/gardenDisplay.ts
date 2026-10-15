import type { GardenEntry, GardenStorage } from "./garden.ts";

export type GardenDisplaySlots = [string | null, string | null, string | null];
export type GardenDisplayEntries = [GardenEntry | null, GardenEntry | null, GardenEntry | null];
const ENTRY_ID = /^[a-zA-Z0-9_-]{1,100}$/;

/** Display references belong to this browser, never to the saved artwork. */
export function parseGardenDisplay(raw: string): GardenDisplaySlots {
  if (raw.length > 1000) throw new Error("This Garden display cannot be read.");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["displayVersion", "slots"].includes(key))
    || value.displayVersion !== 1 || !Array.isArray(value.slots) || value.slots.length !== 3
    || value.slots.some((id: unknown) => id !== null && (typeof id !== "string" || !ENTRY_ID.test(id)))) {
    throw new Error("This Garden display cannot be read.");
  }
  const ids = value.slots.filter((id: string | null) => id !== null);
  if (new Set(ids).size !== ids.length) throw new Error("A moment can occupy only one display position.");
  return [...value.slots] as GardenDisplaySlots;
}

export function recentGardenDisplay(entries: readonly GardenEntry[]): GardenDisplaySlots {
  const recent = [...entries].sort((a, b) => Date.parse(b.keptAt) - Date.parse(a.keptAt));
  return [recent[0]?.id ?? null, recent[1]?.id ?? null, recent[2]?.id ?? null];
}

export function resolveGardenDisplay(slots: GardenDisplaySlots, entries: readonly GardenEntry[]): GardenDisplayEntries {
  return slots.map(id => entries.find(entry => entry.id === id) ?? null) as GardenDisplayEntries;
}

/** Choosing an already-displayed moment swaps positions rather than duplicates it. */
export function changeGardenDisplay(slots: GardenDisplaySlots, index: number, id: string | null): GardenDisplaySlots {
  if (!Number.isInteger(index) || index < 0 || index > 2 || (id !== null && !ENTRY_ID.test(id))) throw new Error("Choose a valid display position.");
  const next = [...slots] as GardenDisplaySlots;
  const other = id === null ? -1 : next.indexOf(id);
  if (other >= 0 && other !== index) next[other] = next[index];
  next[index] = id;
  return next;
}

/** Read-only opening, stale-tab detection, and save-before-apply choices. */
export class GardenDisplayStore {
  private raw: string | null = null;
  private loaded = false;
  private slots: GardenDisplaySlots = [null, null, null];
  constructor(private readonly key: string, private readonly storage: GardenStorage = {
    getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
  }) {}

  load(entries: readonly GardenEntry[]): GardenDisplaySlots {
    this.loaded = false;
    this.raw = this.storage.getItem(this.key);
    this.slots = this.raw === null ? recentGardenDisplay(entries) : parseGardenDisplay(this.raw);
    this.loaded = true;
    return [...this.slots];
  }

  choose(index: number, id: string | null, entries: readonly GardenEntry[]): GardenDisplaySlots {
    if (!this.loaded) throw new Error("Reopen a readable Garden display before changing it. Existing choices are untouched.");
    if (this.storage.getItem(this.key) !== this.raw) throw new Error("Your display changed in another tab. Reopen Visit your Garden before choosing again.");
    if (id !== null && !entries.some(entry => entry.id === id)) throw new Error("That moment is no longer in this Garden.");
    // Missing entries become empty only on an explicit display change. Opening
    // never silently repairs data or writes a newer display document.
    const available = new Set(entries.map(entry => entry.id));
    const clean = this.slots.map(id => id !== null && available.has(id) ? id : null) as GardenDisplaySlots;
    const next = changeGardenDisplay(clean, index, id);
    const raw = JSON.stringify({ displayVersion: 1, slots: next });
    if (raw !== this.raw) {
      try { this.storage.setItem(this.key, raw); }
      catch { throw new Error("This display choice could not be saved. Your previous display and arrangements are unchanged."); }
    }
    this.raw = raw;
    this.slots = next;
    return [...next];
  }
}
