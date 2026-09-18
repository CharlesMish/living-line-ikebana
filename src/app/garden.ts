import { assertValidPlantGraph, fromCanonicalPlantGraph, toCanonicalPlantGraph, type CanonicalPlantGraph } from "../core/index.ts";
import { cloneCameraPose, type CameraPose } from "./camera.ts";

export const GARDEN_KEY = "ikebana-web-alpha:garden-v1";
export const GARDEN_LIMIT = 24;
const MAX_CHARS = 1_800_000;
export interface ArrangementSnapshot {
  plants: CanonicalPlantGraph[];
  successfulPlantOrdinal: number;
  camera: CameraPose;
}
export interface GardenEntry {
  id: string;
  title: string;
  keptAt: string;
  thumbnail: string | null;
  arrangement: ArrangementSnapshot;
}
export interface GardenDocument { gardenVersion: 1; entries: GardenEntry[] }
export interface GardenStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Garden data.");
  return value as Record<string, unknown>;
};
export function validateArrangement(value: unknown): ArrangementSnapshot {
  const source = record(value);
  const ordinal = source.successfulPlantOrdinal;
  if (!Number.isSafeInteger(ordinal) || (ordinal as number) < 0 || (ordinal as number) >= Number.MAX_SAFE_INTEGER
    || !Array.isArray(source.plants) || source.plants.length > 64) throw new Error("Invalid arrangement.");
  const ids = new Set<string>();
  const plants = source.plants.map((plant) => {
    const graph = fromCanonicalPlantGraph(plant);
    assertValidPlantGraph(graph);
    const match = /^plant-([1-9]\d*)$/.exec(graph.id);
    if (!match || Number(match[1]) > (ordinal as number) || ids.has(graph.id)) throw new Error("Invalid plant identity or insertion ordinal.");
    ids.add(graph.id);
    return toCanonicalPlantGraph(graph);
  }).sort((a, b) => a.id.localeCompare(b.id));
  const camera = record(source.camera);
  for (const key of ["position", "target", "up"]) {
    const vector = record(camera[key]);
    if (![vector.x, vector.y, vector.z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1000)) throw new Error("Invalid saved view.");
  }
  const pose = cloneCameraPose(camera as unknown as CameraPose);
  const direction = { x: pose.position.x - pose.target.x, y: pose.position.y - pose.target.y, z: pose.position.z - pose.target.z };
  const cross = { x: direction.y * pose.up.z - direction.z * pose.up.y, y: direction.z * pose.up.x - direction.x * pose.up.z, z: direction.x * pose.up.y - direction.y * pose.up.x };
  if (Math.hypot(cross.x, cross.y, cross.z) < 1e-6) throw new Error("Invalid saved view.");
  return { plants, successfulPlantOrdinal: ordinal as number, camera: pose };
}
function validateEntry(value: unknown): GardenEntry {
  const entry = record(value);
  if (typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id)
    || typeof entry.title !== "string" || entry.title.length > 80
    || typeof entry.keptAt !== "string" || !Number.isFinite(Date.parse(entry.keptAt))) throw new Error("Invalid Garden entry.");
  if (entry.thumbnail !== null && (typeof entry.thumbnail !== "string" || entry.thumbnail.length > 80_000
    || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(entry.thumbnail))) throw new Error("Invalid Garden thumbnail.");
  const arrangement = validateArrangement(entry.arrangement);
  if (!arrangement.plants.length) throw new Error("An empty bowl cannot be kept.");
  return { id: entry.id, title: entry.title, keptAt: entry.keptAt, thumbnail: entry.thumbnail as string | null, arrangement };
}
export function parseGarden(raw: string): GardenDocument {
  if (raw.length > MAX_CHARS) throw new Error("Garden backup is too large.");
  const document = record(JSON.parse(raw));
  if (document.gardenVersion !== 1 || !Array.isArray(document.entries) || document.entries.length > GARDEN_LIMIT) throw new Error("This Garden version cannot be opened.");
  const entries = document.entries.map(validateEntry);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Duplicate Garden identities.");
  return { gardenVersion: 1, entries };
}

/** Atomic, bounded, separate from working autosave. Never silently drops old art.
 * A stale tab must reload the Garden before writing. Invalid data stays untouched.
 */
export class GardenStore {
  private raw: string | null = null;
  private document: GardenDocument | null = null;
  constructor(private readonly key = GARDEN_KEY, private readonly storage: GardenStorage = { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }) {}
  load(): GardenDocument {
    this.document = null;
    this.raw = this.storage.getItem(this.key);
    this.document = this.raw === null ? { gardenVersion: 1, entries: [] } : parseGarden(this.raw);
    return JSON.parse(JSON.stringify(this.document)) as GardenDocument;
  }
  exportRaw(): string { return this.storage.getItem(this.key) ?? JSON.stringify({ gardenVersion: 1, entries: [] }); }
  private write(entries: GardenEntry[]): void {
    if (!this.document) throw new Error("Open a readable Garden before changing it. Existing data has been preserved.");
    if (this.storage.getItem(this.key) !== this.raw) throw new Error("Garden changed in another tab. Close and reopen it before trying again.");
    const raw = JSON.stringify({ gardenVersion: 1, entries });
    const validated = parseGarden(raw);
    try { this.storage.setItem(this.key, raw); }
    catch { throw new Error("Garden could not be saved. Your bowl and previous entries are unchanged. Export a backup before making room."); }
    this.raw = raw;
    this.document = validated;
  }
  keep(entry: GardenEntry): void {
    const checked = validateEntry(entry);
    if (this.document?.entries.some((item) => item.id === checked.id)) throw new Error("This Garden identity is already kept.");
    if ((this.document?.entries.length ?? 0) >= GARDEN_LIMIT) throw new Error(`Garden holds ${GARDEN_LIMIT} arrangements. Export a backup before removing one.`);
    this.write([checked, ...(this.document?.entries ?? [])]);
  }
  remove(id: string): void { this.write((this.document?.entries ?? []).filter((entry) => entry.id !== id)); }
  importBackup(raw: string): number {
    const imported = parseGarden(raw);
    const existing = this.document?.entries ?? [];
    const additions = imported.entries.filter((entry) => {
      const previous = existing.find((item) => item.id === entry.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error("A kept identity differs from the backup. No entries were imported.");
      return !previous;
    });
    this.write([...additions, ...existing]);
    return additions.length;
  }
}

/** Collection identity, not botanical randomness; works on phone LAN HTTP too. */
export function createGardenEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `moment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
