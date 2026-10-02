import { canonicalCameraPose, type CameraPose } from "./camera.ts";
import { DEFAULT_SCENE, validateScene, type SceneSettings } from "./scene.ts";
import { GARDEN_LIMIT, parseGarden, validateArrangement, validateEntry, type GardenEntry, type GardenStorage } from "./garden.ts";
import type { CanonicalPlantGraph } from "../core/index.ts";

const browserStorage: GardenStorage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
export interface SceneStudioDocument {
  storageVersion: 2;
  savedAt: string;
  nextSuccessfulOrdinal: number;
  plants: CanonicalPlantGraph[];
  camera: CameraPose;
  scene: SceneSettings;
}
export function parseSceneStudio(raw: string): SceneStudioDocument {
  const source = JSON.parse(raw);
  if (![1, 2].includes(source.storageVersion) || typeof source.savedAt !== "string" || !Number.isFinite(Date.parse(source.savedAt))) throw new Error("This saved bowl cannot be opened.");
  if (!Number.isSafeInteger(source.nextSuccessfulOrdinal) || source.nextSuccessfulOrdinal < 1) throw new Error("Invalid insertion ordinal.");
  const legacy = source.storageVersion === 1;
  const arrangement = validateArrangement({ plants: source.plants, successfulPlantOrdinal: source.nextSuccessfulOrdinal - 1,
    camera: legacy ? canonicalCameraPose("front") : source.camera }, Infinity);
  return { storageVersion: 2, savedAt: source.savedAt, nextSuccessfulOrdinal: arrangement.successfulPlantOrdinal + 1,
    plants: structuredClone(source.plants), camera: arrangement.camera, scene: legacy ? { ...DEFAULT_SCENE } : validateScene(source.scene) };
}
export function parseSceneGarden(raw: string): { gardenVersion: 2; entries: GardenEntry[] } {
  if (raw.length > 1_800_000) throw new Error("Garden backup is too large.");
  const source = JSON.parse(raw);
  if (source.gardenVersion === 1) {
    // Legacy has no reliable presentation identity. Never infer it from roots or thumbnail.
    const legacy = parseGarden(raw);
    return { gardenVersion: 2, entries: legacy.entries.map((entry, index) => ({ ...entry, arrangement: { ...entry.arrangement, plants: structuredClone(source.entries[index].arrangement.plants), scene: { ...DEFAULT_SCENE } } })) };
  }
  if (source.gardenVersion !== 2 || !Array.isArray(source.entries) || source.entries.length > GARDEN_LIMIT) throw new Error("This Garden version cannot be opened.");
  const entries = source.entries.map((entry: unknown) => {
    const checked = validateEntry(entry);
    checked.arrangement.scene = validateScene(checked.arrangement.scene);
    checked.arrangement.plants = structuredClone((entry as GardenEntry).arrangement.plants);
    return checked;
  });
  if (new Set(entries.map((e: GardenEntry) => e.id)).size !== entries.length) throw new Error("Duplicate Garden identities.");
  return { gardenVersion: 2, entries };
}

/** v2 uses a new key; the fallback is read-only. Both bytes participate in stale checks. */
class VersionedBytes {
  raw: string | null = null;
  legacyRaw: string | null = null;
  readable = false;
  constructor(readonly key: string, readonly legacyKey: string | undefined, readonly storage = browserStorage) {}
  read() {
    this.readable = false;
    this.raw = this.storage.getItem(this.key);
    this.legacyRaw = this.legacyKey ? this.storage.getItem(this.legacyKey) : null;
    return this.raw ?? this.legacyRaw;
  }
  write(raw: string) {
    if (!this.readable) throw new Error("Saved data could not be opened. Existing bytes are preserved.");
    if (this.storage.getItem(this.key) !== this.raw || (this.legacyKey && this.storage.getItem(this.legacyKey) !== this.legacyRaw)) throw new Error("Saved data changed in another tab. Reload before saving.");
    this.storage.setItem(this.key, raw); this.raw = raw;
  }
}
export class SceneCommittedStore {
  private readonly bytes: VersionedBytes;
  loaded: SceneStudioDocument | null = null;
  error = false;
  constructor(key: string, legacyKey: string | undefined, private readonly current: () => { scene: SceneSettings; camera: CameraPose }, storage?: GardenStorage) {
    this.bytes = new VersionedBytes(key, legacyKey, storage);
  }
  load(): SceneStudioDocument | null {
    try {
      const raw = this.bytes.read(); this.loaded = raw === null ? null : parseSceneStudio(raw);
      this.bytes.readable = true; this.error = false; return this.loaded;
    } catch { this.loaded = null; this.error = true; return null; }
  }
  save(nextSuccessfulOrdinal: number, plants: CanonicalPlantGraph[], settings = this.current()) {
    try {
      const value = { storageVersion: 2, savedAt: new Date().toISOString(), nextSuccessfulOrdinal, plants, ...settings };
      const checked = parseSceneStudio(JSON.stringify(value));
      this.bytes.write(JSON.stringify(checked)); return true;
    } catch { return false; }
  }
  /** Explicit test/fresh operation writes an empty v2 document; never deletes legacy. */
  clear() { this.save(1, []); }
}
export class SceneGardenStore {
  private readonly bytes: VersionedBytes;
  private entries: GardenEntry[] = [];
  constructor(key: string, legacyKey?: string, storage?: GardenStorage) { this.bytes = new VersionedBytes(key, legacyKey, storage); }
  load(): { gardenVersion: 2; entries: GardenEntry[] } {
    const raw = this.bytes.read();
    this.entries = raw === null ? [] : parseSceneGarden(raw).entries;
    this.bytes.readable = true;
    return { gardenVersion: 2, entries: structuredClone(this.entries) };
  }
  exportRaw() { return this.bytes.storage.getItem(this.bytes.key) ?? (this.bytes.legacyKey ? this.bytes.storage.getItem(this.bytes.legacyKey) : null) ?? JSON.stringify({ gardenVersion: 2, entries: [] }); }
  private write(entries: GardenEntry[]) {
    const checked = parseSceneGarden(JSON.stringify({ gardenVersion: 2, entries }));
    try { this.bytes.write(JSON.stringify(checked)); }
    catch (error) { throw new Error(`Garden could not be saved. Previous entries are unchanged. ${error instanceof Error ? error.message : "Export a backup before making room."}`); }
    this.entries = checked.entries;
  }
  keep(entry: GardenEntry) {
    const checked = validateEntry(entry); checked.arrangement.plants = structuredClone(entry.arrangement.plants); checked.arrangement.scene ??= { ...DEFAULT_SCENE };
    if (this.entries.some(e => e.id === checked.id)) throw new Error("This Garden identity is already kept.");
    if (this.entries.length >= GARDEN_LIMIT) throw new Error(`Garden holds ${GARDEN_LIMIT} arrangements. Export a backup before removing one.`);
    this.write([checked, ...this.entries]);
  }
  remove(id: string) { this.write(this.entries.filter(e => e.id !== id)); }
  importBackup(raw: string) {
    const imported = parseSceneGarden(raw).entries;
    const additions = imported.filter(entry => {
      const previous = this.entries.find(e => e.id === entry.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error("A kept identity differs from the backup. No entries were imported.");
      return !previous;
    });
    this.write([...additions, ...this.entries]); return additions.length;
  }
}

export function sceneStorageKeys(url: URL, workbench: boolean, vesselStudy?: string) {
  if (url.searchParams.get("combinedPreview") === "1") return { studio: "ikebana-integration-preview:studio-v2", garden: "ikebana-integration-preview:garden-v2", telemetry: "ikebana-integration-preview:telemetry-v1" };
  const prefix = vesselStudy ? `ikebana-web-alpha:vessel-study-v1:${vesselStudy}:${workbench ? "workbench-" : ""}` : `ikebana-web-alpha:${workbench ? "workbench-" : ""}`;
  return { studio: `${prefix}studio-v2`, garden: `${prefix}garden-v2`, telemetry: vesselStudy ? `${prefix}telemetry` : `${prefix}telemetry-v1`,
    legacyStudio: vesselStudy ? `${prefix}studio` : `${prefix}studio-v1`, legacyGarden: vesselStudy ? `${prefix}garden` : `${prefix}garden-v1` };
}
