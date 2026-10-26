import type { GardenEntry, GardenStorage } from "./garden.ts";
import { parseGardenDisplay } from "./gardenDisplay.ts";
import { ARRANGEMENT_PLACE_IDS, HOME_PLACE_IDS, arrangementExtent, homePlace, placeFit, type HomePlaceId } from "../presentation/homePlaces.ts";

/**
 * Which kept Garden entry sits in which place at home. References only: the
 * Garden entries, their graphs and photographs are never copied or rewritten,
 * and the Garden document schema is unchanged. This preference belongs to one
 * browser, like the Visit display it grows out of.
 */
export type HomePlacements = Readonly<Record<HomePlaceId, string | null>>;

const ENTRY_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const EMPTY: HomePlacements = Object.freeze(Object.fromEntries(HOME_PLACE_IDS.map(id => [id, null])) as Record<HomePlaceId, null>);

export function emptyHomePlacements(): HomePlacements { return { ...EMPTY }; }

export function parseHomePlacements(raw: string): HomePlacements {
  if (raw.length > 4000) throw new Error("This home cannot be read.");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["homeVersion", "places"].includes(key))
    || value.homeVersion !== 1 || !value.places || typeof value.places !== "object" || Array.isArray(value.places)) {
    throw new Error("This home cannot be read.");
  }
  const places = value.places as Record<string, unknown>;
  const result: Record<string, string | null> = { ...EMPTY };
  for (const [key, id] of Object.entries(places)) {
    if (!homePlace(key)) throw new Error("This home names a place it does not have.");
    if (id !== null && (typeof id !== "string" || !ENTRY_ID.test(id))) throw new Error("This home cannot be read.");
    result[key] = id as string | null;
  }
  const arranged = ARRANGEMENT_PLACE_IDS.map(id => result[id]).filter((id): id is string => id !== null);
  if (new Set(arranged).size !== arranged.length) throw new Error("A kept arrangement can stand in only one place.");
  return result as HomePlacements;
}

/** Whether one kept entry can stand (or hang) in one place. Physical only. */
export function entryFitsPlace(placeId: HomePlaceId, entry: GardenEntry): string | null {
  const place = homePlace(placeId);
  if (!place) return "Choose a valid place.";
  if (place.kind === "photograph") return entry.thumbnail ? null : "This moment was kept without a photograph.";
  const fit = placeFit(place, arrangementExtent(entry.arrangement));
  return fit.fits ? null : fit.reason;
}

const label = (entry: GardenEntry) => `“${entry.title || "Untitled arrangement"}”`;

/**
 * Checks every place a change would fill, not only the one chosen: a swap also
 * moves the displaced piece, and that destination must fit too. Returns the
 * first problem, worded for the visitor, or null.
 */
export function placementProblem(current: HomePlacements, placeId: HomePlaceId, entryId: string | null, entries: readonly GardenEntry[]): string | null {
  const next = placeInHome(current, placeId, entryId);
  for (const id of HOME_PLACE_IDS) {
    if (next[id] === null || next[id] === current[id]) continue;
    const entry = entries.find(item => item.id === next[id]);
    if (!entry) return "That arrangement is no longer in your Garden.";
    const problem = entryFitsPlace(id, entry);
    if (!problem) continue;
    if (id === placeId) return problem;
    return `That would move ${label(entry)} ${homePlace(id)!.at.replace(/^(in|on|as) /, "to ")}. ${problem}`;
  }
  return null;
}

const newest = (entries: readonly GardenEntry[]) => [...entries].sort((a, b) => Date.parse(b.keptAt) - Date.parse(a.keptAt));

/**
 * A first visit starts from what the visitor already chose in Visit your
 * Garden (centre piece to the tokonoma, left and right to the table and the
 * window desk), or otherwise from the newest kept arrangements. The scroll
 * shows the tokonoma piece's photograph when it has one.
 */
export function initialHomePlacements(entries: readonly GardenEntry[], displayRaw: string | null): HomePlacements {
  const result: Record<HomePlaceId, string | null> = { ...EMPTY };
  const known = new Set(entries.map(entry => entry.id));
  let order: (string | null)[] = [];
  if (displayRaw !== null) {
    try {
      const [left, centre, right] = parseGardenDisplay(displayRaw);
      order = [centre, left, right].map(id => id !== null && known.has(id) ? id : null);
    } catch { order = []; }
  }
  if (!order.some(id => id !== null)) order = newest(entries).map(entry => entry.id);
  // Fill each seeded place with the first remaining candidate that fits it.
  const candidates = order.filter((id): id is string => id !== null);
  for (const place of ["tokonoma", "table", "shoin"] as const) {
    const index = candidates.findIndex(id => {
      const entry = entries.find(item => item.id === id);
      return entry !== undefined && entryFitsPlace(place, entry) === null;
    });
    if (index >= 0) result[place] = candidates.splice(index, 1)[0]!;
  }
  const withPhoto = (id: string | null) => entries.find(entry => entry.id === id && entry.thumbnail);
  result.scroll = withPhoto(result.tokonoma)?.id ?? newest(entries).find(entry => entry.thumbnail)?.id ?? null;
  return result;
}

/**
 * Arrangement places hold each entry at most once: placing an entry that already
 * stands elsewhere swaps the two places, and a displaced piece otherwise returns
 * to the Garden (it is never deleted). The scroll is independent: the same kept
 * moment may stand in a place and hang as the scroll.
 */
export function placeInHome(current: HomePlacements, placeId: HomePlaceId, entryId: string | null): HomePlacements {
  const place = homePlace(placeId);
  if (!place || (entryId !== null && !ENTRY_ID.test(entryId))) throw new Error("Choose a valid place.");
  const next: Record<HomePlaceId, string | null> = { ...current };
  if (place.kind === "arrangement" && entryId !== null) {
    const other = ARRANGEMENT_PLACE_IDS.find(id => id !== placeId && next[id] === entryId);
    if (other) next[other] = next[placeId];
  }
  next[placeId] = entryId;
  return next;
}

export function placeOfEntry(placements: HomePlacements, entryId: string): HomePlaceId | null {
  return ARRANGEMENT_PLACE_IDS.find(id => placements[id] === entryId) ?? null;
}

/** Same discipline as the Visit display store: opening never writes, a stale
 * tab cannot overwrite a newer choice, and a failed save changes nothing. */
export class HomeStore {
  private raw: string | null = null;
  private loaded = false;
  private placements: HomePlacements = emptyHomePlacements();
  constructor(private readonly key: string, private readonly displayKey: string | null = null,
    private readonly storage: GardenStorage = {
      getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
    }) {}

  /** `placing` is a moment about to be given a place: a first visit does not
   * seed it into the room on the visitor's behalf. */
  load(entries: readonly GardenEntry[], placing: string | null = null): HomePlacements {
    this.loaded = false;
    this.raw = this.storage.getItem(this.key);
    this.placements = this.raw === null
      ? initialHomePlacements(entries.filter(entry => entry.id !== placing), this.displayKey ? this.storage.getItem(this.displayKey) : null)
      : parseHomePlacements(this.raw);
    this.loaded = true;
    return { ...this.placements };
  }

  place(placeId: HomePlaceId, entryId: string | null, entries: readonly GardenEntry[]): HomePlacements {
    if (!this.loaded) throw new Error("Reopen your home before changing it. Nothing was moved.");
    if (this.storage.getItem(this.key) !== this.raw) throw new Error("Your home changed in another tab. Reopen it before placing again.");
    if (entryId !== null && !entries.some(entry => entry.id === entryId)) throw new Error("That arrangement is no longer in your Garden.");
    const available = new Set(entries.map(entry => entry.id));
    const clean = Object.fromEntries(Object.entries(this.placements)
      .map(([id, entry]) => [id, entry !== null && available.has(entry) ? entry : null])) as HomePlacements;
    // Refuse before writing if any place this change fills could not take its piece.
    const problem = placementProblem(clean, placeId, entryId, entries);
    if (problem) throw new Error(problem);
    const next = placeInHome(clean, placeId, entryId);
    const raw = JSON.stringify({ homeVersion: 1, places: next });
    if (raw !== this.raw) {
      try { this.storage.setItem(this.key, raw); }
      catch { throw new Error("This could not be saved. Your home and your arrangements are unchanged."); }
    }
    this.raw = raw;
    this.placements = next;
    return { ...next };
  }
}
