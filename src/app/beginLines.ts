import {
  aimBranch,
  bendBranchAtFraction,
  prepareMaterialInsertion,
  toCanonicalPlantGraph,
  translatePendingGraph,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";
import { canonicalCameraPose } from "./camera.ts";
import { validateArrangement, type ArrangementSnapshot } from "./garden.ts";
import type { SceneSettings } from "./scene.ts";

/** Generators are built at the kenzan origin, shaped, then moved to `base`. */
const ORIGIN: Vec3 = { x: 0, y: 0.55, z: 0 };

export interface BeginLine {
  readonly id: string;
  readonly text: string;
  readonly materialId: string;
  readonly base: Vec3;
  /** World-space aim target while the cutting still stands at the origin. */
  readonly aim: Vec3 | null;
  readonly bend: { readonly fraction: number; readonly target: Vec3 } | null;
}

export interface BeginPresentation {
  readonly label: string;
  readonly scene: Partial<Pick<SceneSettings, "backdropId" | "perchId">>;
}

export interface BeginInvitation {
  readonly id: string;
  readonly text: string;
  readonly summary: string;
  readonly presentation: BeginPresentation | null;
}

/**
 * Four fixed lines. Same id always rebuilds plant-1 (seed 8278) with these
 * materials, bases, and shape targets. No new generator.
 */
export const BEGIN_LINES: readonly BeginLine[] = Object.freeze([
  Object.freeze({
    id: "lean-left",
    text: "A tall branch leaning left, with open space to the right.",
    materialId: "flowering-branch",
    base: Object.freeze({ x: -0.48, y: 0.55, z: 0.06 }),
    aim: Object.freeze({ x: -4.6, y: 4.4, z: 0.15 }),
    bend: null,
  }),
  Object.freeze({
    id: "reed-forward",
    text: "A low reed reaching forward.",
    materialId: "reed",
    base: Object.freeze({ x: 0.06, y: 0.55, z: 0.62 }),
    aim: Object.freeze({ x: 1.45, y: 1.55, z: 2.35 }),
    bend: Object.freeze({ fraction: 0.56, target: Object.freeze({ x: 1.2, y: 0.95, z: 2.05 }) }),
  }),
  Object.freeze({
    id: "flower-back",
    text: "A single flower standing off to the back.",
    materialId: "single-flower",
    base: Object.freeze({ x: 0.52, y: 0.55, z: -0.58 }),
    aim: Object.freeze({ x: 0.2, y: 6.4, z: -0.35 }),
    bend: null,
  }),
  Object.freeze({
    id: "bare-arc",
    text: "A bare branch bent over the rim.",
    materialId: "bare-branch",
    base: Object.freeze({ x: 0.62, y: 0.55, z: 0.18 }),
    aim: Object.freeze({ x: 1.7, y: 4.6, z: 0.22 }),
    bend: Object.freeze({ fraction: 0.48, target: Object.freeze({ x: 2.3, y: 1.35, z: 0.35 }) }),
  }),
]);

export const BEGIN_INVITATIONS: readonly BeginInvitation[] = Object.freeze([
  Object.freeze({
    id: "windowsill",
    text: "A small arrangement for a narrow kitchen windowsill: low enough not to block the light.",
    summary: "Windowsill",
    presentation: Object.freeze({ label: "Sage backdrop", scene: Object.freeze({ backdropId: "sage" as const }) }),
  }),
  Object.freeze({
    id: "table",
    text: "For a table where two people will talk across it.",
    summary: "Two at a table",
    presentation: null,
  }),
  Object.freeze({
    id: "autumn",
    text: "Late autumn: something that feels like the year thinning out.",
    summary: "Late autumn",
    presentation: Object.freeze({ label: "Dusk backdrop", scene: Object.freeze({ backdropId: "dusk" as const }) }),
  }),
  Object.freeze({
    id: "entryway",
    text: "For an entryway: something to notice on the way out.",
    summary: "Entryway",
    presentation: Object.freeze({ label: "Stone perch", scene: Object.freeze({ perchId: "stone" as const }) }),
  }),
]);

const tipOf = (graph: PlantGraph): Vec3 => {
  const branch = graph.branches.get(graph.rootBranchId);
  if (!branch || branch.points.length === 0) throw new Error("A starting line has no root.");
  return branch.points[branch.points.length - 1];
};

export function beginLineById(id: string): BeginLine {
  const line = BEGIN_LINES.find((item) => item.id === id);
  if (!line) throw new Error(`Unknown starting line: ${id}`);
  return line;
}

export function beginInvitationById(id: string): BeginInvitation {
  const invitation = BEGIN_INVITATIONS.find((item) => item.id === id);
  if (!invitation) throw new Error(`Unknown invitation: ${id}`);
  return invitation;
}

/** Plant-1, seed 8278, shaped and seated. Identical for a given id. */
export function realizeBeginLine(id: string): PlantGraph {
  const line = beginLineById(id);
  const prepared = prepareMaterialInsertion(line.materialId, 1, ORIGIN);
  if (!prepared.ok) throw new Error(prepared.reason);
  let graph = prepared.graph;
  if (line.aim) graph = aimBranch(graph, graph.rootBranchId, tipOf(graph), line.aim);
  if (line.bend) graph = bendBranchAtFraction(graph, graph.rootBranchId, line.bend.target, line.bend.fraction);
  return translatePendingGraph(graph, line.base);
}

export function beginLineSnapshot(id: string): ArrangementSnapshot {
  return validateArrangement({
    plants: [toCanonicalPlantGraph(realizeBeginLine(id))],
    successfulPlantOrdinal: 1,
    camera: canonicalCameraPose("front"),
  });
}

export type BeginSeatMode = "insert" | "replace" | "prompt";

/**
 * Empty fresh bowl (next ordinal 1): ordinary insert, so Undo and Remove apply.
 * Empty bowl whose ordinal already advanced: replace immediately, the existing
 * empty-bowl path. A bowl that already has cuttings: prompt, never write.
 */
export function planBeginSeat(id: string, plantCount: number, nextOrdinal: number): {
  mode: BeginSeatMode;
  snapshot: ArrangementSnapshot;
} {
  const snapshot = beginLineSnapshot(id);
  if (plantCount > 0) return { mode: "prompt", snapshot };
  if (nextOrdinal === 1) return { mode: "insert", snapshot };
  return { mode: "replace", snapshot };
}

interface BeginInsertHost {
  beginInsert(
    owner: string,
    reservation: { ordinal: number; plantId: string; seed: number; graph: PlantGraph },
    context: Record<string, never>,
    input: { base: Vec3; valid: boolean },
  ): { ok: boolean };
  release(owner: string): { ok: boolean };
}

/** Seats the fixed line through the ordinary insert commit. Fails closed. */
export function insertBeginLine(host: BeginInsertHost, id: string): { ok: true; plantId: string } | { ok: false } {
  const line = beginLineById(id);
  const graph = realizeBeginLine(id);
  const owner = `begin:${id}`;
  const started = host.beginInsert(owner, {
    ordinal: 1,
    plantId: graph.id,
    seed: graph.seed,
    graph,
  }, {}, { base: line.base, valid: true });
  if (!started.ok) return { ok: false };
  const released = host.release(owner);
  if (!released.ok) return { ok: false };
  return { ok: true, plantId: graph.id };
}
