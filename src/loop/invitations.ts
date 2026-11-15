import { getGeneratorDefinition, getMaterialDefinition, getMaterialDefinitions } from "../core/materialCatalog.ts";
import type { PlantGraph } from "../core/types.ts";
import data from "./invitations.json";
import type { ArrangementObservations } from "./observe.ts";

/**
 * Invitations are requests from people or places. Each one fixes a vessel
 * layout and a small kit, and reads one practical fact from the delivered
 * bowl. The reading chooses which note the host sends back. No note is a
 * grade, and every delivery counts.
 *
 * This module is DOM-free. It reads committed graphs; it never edits them.
 */

export type ReadingMeasure = "height" | "depth" | "lean";

export interface ReadingBand {
  readonly id: string;
  /** Inclusive upper bound in scene units. The last band has none. */
  readonly upTo?: number;
  readonly note: string;
}

export interface KitItem {
  readonly materialId: string;
  readonly count: number;
}

export interface Invitation {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly brief: string;
  readonly layoutId: string;
  readonly opensAfter?: string;
  readonly kit: readonly KitItem[];
  readonly reading: { readonly measure: ReadingMeasure; readonly bands: readonly ReadingBand[] };
}

const MEASURES: readonly ReadingMeasure[] = ["height", "depth", "lean"];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid invitation data at ${where}.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, where: string, max = 400): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw new Error(`Invalid invitation text at ${where}.`);
  return value;
}

/**
 * Validates authored invitation data. Layout IDs are checked by the caller
 * against the vessel registry, which lives outside this layer.
 */
export function parseInvitations(value: unknown, layoutIds?: ReadonlySet<string>): readonly Invitation[] {
  const source = record(value, "root");
  if (source.invitationsDataVersion !== 1 || !Array.isArray(source.invitations)) throw new Error("Unsupported invitation data.");
  const seen = new Set<string>();
  const invitations = source.invitations.map((raw, index): Invitation => {
    const item = record(raw, `invitations[${index}]`);
    const id = text(item.id, `invitations[${index}].id`, 60);
    if (!ID.test(id) || seen.has(id)) throw new Error(`Invalid or duplicate invitation id ${id}.`);
    seen.add(id);
    const layoutId = text(item.layoutId, `${id}.layoutId`, 60);
    if (layoutIds && !layoutIds.has(layoutId)) throw new Error(`Invitation ${id} names an unknown vessel layout ${layoutId}.`);
    if (!Array.isArray(item.kit) || item.kit.length === 0 || item.kit.length > 8) throw new Error(`Invitation ${id} needs a kit of one to eight materials.`);
    const kitIds = new Set<string>();
    const kit = item.kit.map((rawItem, kitIndex): KitItem => {
      const entry = record(rawItem, `${id}.kit[${kitIndex}]`);
      const materialId = text(entry.materialId, `${id}.kit[${kitIndex}].materialId`, 60);
      if (!getMaterialDefinition(materialId) || kitIds.has(materialId)) throw new Error(`Invitation ${id} has an unknown or repeated kit material ${materialId}.`);
      kitIds.add(materialId);
      if (!Number.isSafeInteger(entry.count) || (entry.count as number) < 1 || (entry.count as number) > 6) throw new Error(`Invitation ${id} kit counts must be 1 to 6.`);
      return Object.freeze({ materialId, count: entry.count as number });
    });
    const reading = record(item.reading, `${id}.reading`);
    if (!MEASURES.includes(reading.measure as ReadingMeasure)) throw new Error(`Invitation ${id} has an unknown reading.`);
    if (!Array.isArray(reading.bands) || reading.bands.length < 2) throw new Error(`Invitation ${id} needs at least two notes.`);
    let previous = -Infinity;
    const bands = reading.bands.map((rawBand, bandIndex): ReadingBand => {
      const band = record(rawBand, `${id}.bands[${bandIndex}]`);
      const last = bandIndex === (reading.bands as unknown[]).length - 1;
      if (last !== (band.upTo === undefined)) throw new Error(`Invitation ${id}: only the last note may be open-ended.`);
      if (!last) {
        if (typeof band.upTo !== "number" || !Number.isFinite(band.upTo) || band.upTo <= previous) throw new Error(`Invitation ${id}: note bounds must increase.`);
        previous = band.upTo;
      }
      return Object.freeze({ id: text(band.id, `${id}.bands[${bandIndex}].id`, 40), note: text(band.note, `${id}.bands[${bandIndex}].note`), ...(last ? {} : { upTo: band.upTo as number }) });
    });
    const opensAfter = item.opensAfter === undefined ? undefined : text(item.opensAfter, `${id}.opensAfter`, 60);
    return Object.freeze({
      id, layoutId, kit: Object.freeze(kit),
      title: text(item.title, `${id}.title`, 80),
      from: text(item.from, `${id}.from`, 120),
      brief: text(item.brief, `${id}.brief`),
      ...(opensAfter ? { opensAfter } : {}),
      reading: Object.freeze({ measure: reading.measure as ReadingMeasure, bands: Object.freeze(bands) }),
    });
  });
  for (const invitation of invitations) {
    if (invitation.opensAfter && !seen.has(invitation.opensAfter)) throw new Error(`Invitation ${invitation.id} opens after an unknown invitation.`);
    if (invitation.opensAfter === invitation.id) throw new Error(`Invitation ${invitation.id} cannot open after itself.`);
  }
  return Object.freeze(invitations);
}

let cached: readonly Invitation[] | null = null;
/** The authored set. Layout IDs are validated by tests against the vessel registry. */
export function getInvitations(): readonly Invitation[] {
  cached ??= parseInvitations(data);
  return cached;
}
export function getInvitation(id: string): Invitation | null {
  return getInvitations().find((invitation) => invitation.id === id) ?? null;
}

/** An invitation opens once the one it follows has been delivered at least once. */
export function isInvitationOpen(invitation: Invitation, deliveredIds: ReadonlySet<string>): boolean {
  return !invitation.opensAfter || deliveredIds.has(invitation.opensAfter);
}

/** Maps a seated graph back to its tray material. Graphs persist only generatorVersion. */
export function materialIdForGraph(graph: Pick<PlantGraph, "generatorVersion">): string | null {
  return getMaterialDefinitions().find((material) => material.generator.generatorVersion === graph.generatorVersion)?.materialId ?? null;
}

const restTotal = (lengths: readonly number[]) => lengths.reduce((sum, length) => sum + length, 0);

/**
 * True once pruning has removed anything from the cutting: a branch, an
 * organ, or the tip of a stem. Prune truncates rest lengths, so a shortened
 * stem is found by regenerating the same identity's stock. Generators are
 * deterministic by id and seed; rest lengths do not depend on the seat.
 */
export function hasBeenCut(graph: PlantGraph): boolean {
  for (const branch of graph.branches.values()) if (!branch.active) return true;
  for (const organ of graph.organs.values()) if (!organ.active) return true;
  const definition = getGeneratorDefinition(graph.generatorVersion);
  const root = graph.branches.get(graph.rootBranchId);
  if (!definition || !root) return false;
  const stock = definition.generate(graph.id, graph.seed, root.points[0]);
  for (const branch of graph.branches.values()) {
    const original = stock.branches.get(branch.id);
    if (original && restTotal(branch.restLengths) < restTotal(original.restLengths) - 1e-6) return true;
  }
  return false;
}

export interface SpentCutting {
  readonly plantId: string;
  readonly materialId: string;
}

/**
 * The kit rule. A kit says how many of each cutting you were given.
 * A cutting in the bowl uses one. A cutting that has been cut and then
 * removed stays used: it went to the compost. Removing an uncut cutting
 * puts it back. Undo can return a removed cutting to the bowl; it is then
 * counted where it is, never twice.
 */
export function kitRemaining(
  invitation: Invitation,
  plants: Iterable<PlantGraph>,
  spent: readonly SpentCutting[],
): Map<string, number> {
  const remaining = new Map(invitation.kit.map((item) => [item.materialId, item.count] as const));
  const present = new Set<string>();
  for (const graph of plants) {
    present.add(graph.id);
    const materialId = materialIdForGraph(graph);
    if (materialId && remaining.has(materialId)) remaining.set(materialId, remaining.get(materialId)! - 1);
  }
  for (const cutting of spent) {
    if (present.has(cutting.plantId) || !remaining.has(cutting.materialId)) continue;
    remaining.set(cutting.materialId, remaining.get(cutting.materialId)! - 1);
  }
  for (const [id, count] of remaining) remaining.set(id, Math.max(0, count));
  return remaining;
}

/**
 * Compares two committed documents and returns cuttings that left the bowl
 * after being cut. The caller adds these to the invitation's spent list.
 */
export function newlySpent(
  before: ReadonlyMap<string, PlantGraph>,
  after: ReadonlyMap<string, PlantGraph>,
  spent: readonly SpentCutting[],
): SpentCutting[] {
  const known = new Set(spent.map((cutting) => cutting.plantId));
  const result: SpentCutting[] = [];
  for (const [id, graph] of before) {
    if (after.has(id) || known.has(id) || !hasBeenCut(graph)) continue;
    const materialId = materialIdForGraph(graph);
    if (materialId) result.push({ plantId: id, materialId });
  }
  return result;
}

/** The host's note for a delivered bowl. Every band is a valid outcome. */
export function respond(invitation: Invitation, observations: ArrangementObservations): ReadingBand {
  const value = observations[invitation.reading.measure];
  return invitation.reading.bands.find((band) => band.upTo === undefined || value <= band.upTo)
    ?? invitation.reading.bands[invitation.reading.bands.length - 1];
}

function plural(name: string): string {
  const lower = name.toLowerCase();
  if (/leaf$/.test(lower)) return `${name.slice(0, -1)}ves`;
  if (/(s|sh|ch|x)$/.test(lower)) return `${name}es`;
  if (/[^aeiou]y$/.test(lower)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

/** "2 reeds" style labels for kit lists. */
export function kitItemLabel(name: string, count: number): string {
  if (count === 1) return `1 ${name}`;
  return `${count === 0 ? "no" : count} ${plural(name)}`;
}
