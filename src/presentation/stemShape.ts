import { getGeneratorDefinition } from "../core/materialCatalog.ts";
import type { Branch, BranchKind, PlantGraph } from "../core/types.ts";
import { botanicalSeed } from "./botanicalGeometry.ts";
import type { TubeSkin } from "./geometry.ts";

/**
 * Presentation-only stem skin: taper, slight irregularity, collars where side
 * shoots leave, a closed growing tip, and a base-to-tip tone.
 *
 * The centreline is never moved: ring centres stay exactly on the graph's
 * points, so picking, cut caps and organ seats match what is drawn. Any
 * natural curve in a stalk belongs in a (new, versioned) generator.
 *
 * Every value is a function of stock coordinates: distance from the branch's
 * own base along its original rest lengths, the uncut stock length, and stable
 * identity (graph seed and branch id). Bending and aiming never change rest
 * lengths, so they never change thickness. Pruning removes the distal part
 * only, so the remaining stock keeps exactly the radii it had. Branch.radius
 * stays the persisted base radius; hit proxies keep their own uniform radius.
 */

export interface StemCharacter {
  /** Radius at the uncut tip as a fraction of the base radius. */
  readonly tipRatio: number;
  /** Higher keeps the stem thick for longer before it tapers. */
  readonly power: number;
  /** Low-frequency thickness irregularity, as a fraction of radius. */
  readonly wave: number;
  /** Swelling where a side branch or stalk leaves, as a fraction of radius. */
  readonly collar: number;
  /** Base-to-tip tone strength; 1 is the herbaceous default. */
  readonly tone: number;
  /** Cross-section ovalness, as a fraction of radius. */
  readonly oval: number;
  /** How much an uncut growing tip narrows (1 would close to nothing). */
  readonly tipClose: number;
  /** Higher keeps a growing tip round and blunt; lower makes it a point. */
  readonly tipRound: number;
}

const HERBACEOUS: StemCharacter = Object.freeze({ tipRatio: 0.58, power: 1.35, wave: 0.03, collar: 0.1, tone: 1, oval: 0.05, tipClose: 0.42, tipRound: 3 });
const WOODY: StemCharacter = Object.freeze({ tipRatio: 0.34, power: 1.1, wave: 0.055, collar: 0.2, tone: 1.15, oval: 0.07, tipClose: 0.78, tipRound: 1.6 });
const GRASS: StemCharacter = Object.freeze({ tipRatio: 0.42, power: 2.4, wave: 0.02, collar: 0.06, tone: 0.9, oval: 0.04, tipClose: 0.85, tipRound: 1.3 });
const SUCCULENT: StemCharacter = Object.freeze({ tipRatio: 0.7, power: 1.6, wave: 0.025, collar: 0.08, tone: 0.8, oval: 0.04, tipClose: 0.35, tipRound: 3 });

/** Keyed by durable generator version, like material appearance. */
const CHARACTERS: Readonly<Record<string, StemCharacter>> = Object.freeze({
  "one-branch-v1": WOODY,
  "bare-branch-v1": WOODY,
  "berry-twig-v1": WOODY,
  "lobed-leaf-v1": Object.freeze({ ...WOODY, tipRatio: 0.42, collar: 0.16 }),
  "reed-v1": GRASS,
  "broad-blade-v1": GRASS,
  "parasol-leaf-v1": SUCCULENT,
});

/** Short stalks taper gently; they are already thin. */
const KIND_SCALE: Readonly<Record<BranchKind, number>> = Object.freeze({
  trunk: 1, lateral: 1, twig: 1, petiole: 0.45, pedicel: 0.45,
});

export function stemCharacter(generatorVersion: string): StemCharacter {
  return CHARACTERS[generatorVersion] ?? HERBACEOUS;
}

const STOCK_LIMIT = 96;
type StockTip = "pointed" | "receptacle" | "attached";
interface BranchStock { length: number; tip: StockTip }

function stockTip(graph: PlantGraph, branch: Branch): StockTip {
  const threshold = branch.activeLength - Math.max(0.02, (branch.restLengths.at(-1) ?? 0) * 0.5);
  const organ = [...graph.organs.values()].find(item => item.active && item.branchId === branch.id && item.distance >= threshold);
  if (!organ) return "pointed";
  return ["bloom", "berry", "seedpod"].includes(organ.kind) ? "receptacle" : "attached";
}
const stockCache = new Map<string, ReadonlyMap<string, BranchStock>>();

/**
 * Uncut length of every branch, from the deterministic generator. Rest lengths
 * do not depend on where the cutting is seated, so a fixed base is used and the
 * result is cached by identity. Unknown generators fall back to active length.
 */
function branchStock(graph: PlantGraph): ReadonlyMap<string, BranchStock> {
  const key = `${graph.generatorVersion}|${graph.id}|${graph.seed}`;
  const cached = stockCache.get(key);
  if (cached) return cached;
  const lengths = new Map<string, BranchStock>();
  const definition = getGeneratorDefinition(graph.generatorVersion);
  if (definition) {
    try {
      const stock = definition.generate(graph.id, graph.seed, { x: 0, y: 0.55, z: 0 });
      for (const branch of stock.branches.values()) lengths.set(branch.id, { length: branch.activeLength, tip: stockTip(stock, branch) });
    } catch { /* Presentation never fails on an unreadable stock. */ }
  }
  if (stockCache.size >= STOCK_LIMIT) stockCache.delete(stockCache.keys().next().value!);
  stockCache.set(key, lengths);
  return lengths;
}

/** Independent deterministic channels in [0, 1). */
function channel(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export type StemTip = "cut" | "pointed" | "receptacle" | "attached";

export interface StemShape {
  readonly stockLength: number;
  /** How far a growing point's cap extends past the last ring, in ring radii. */
  readonly tipReach: number;
  /** Base radius after fitting inside the parent where it leaves. */
  readonly baseRadius: number;
  readonly tip: StemTip;
  /** Mean radius at a stock distance, without the cross-section shape. */
  meanRadiusAt(distance: number): number;
  radiusAt(distance: number, angle: number): number;
  toneAt(distance: number): readonly [number, number, number];
}

/**
 * Builds the shape of one branch. `parentShape` lets a side branch fit inside
 * its parent where it leaves; callers memoise per graph with stemShapes().
 */
function buildShape(graph: PlantGraph, branch: Branch, stock: ReadonlyMap<string, BranchStock>, parentShape: StemShape | null): StemShape {
  const character = stemCharacter(graph.generatorVersion);
  const seed = botanicalSeed(`stem:${branch.id}`, graph.seed);
  const stockLength = Math.max(branch.activeLength, stock.get(branch.id)?.length ?? branch.activeLength, 1e-6);
  const fitted = parentShape ? Math.min(branch.radius, 0.9 * parentShape.meanRadiusAt(branch.parentDistance)) : branch.radius;
  const baseRadius = Math.max(fitted, branch.radius * 0.45);
  const kindScale = KIND_SCALE[branch.kind];
  const tipRatio = 1 - (1 - character.tipRatio) * kindScale;

  const cut = branch.activeLength < stockLength - 1e-5;
  // Pruning exposes a new face; the wood below it still belongs to the original tip.
  const originalTip = stock.get(branch.id)?.tip ?? stockTip(graph, branch);
  const tip: StemTip = cut ? "cut" : originalTip;

  // Stock-coordinate features, fixed by identity.
  const phase1 = channel(seed, 1) * Math.PI * 2;
  const phase2 = channel(seed, 2) * Math.PI * 2;
  const ovalPhase = channel(seed, 3) * Math.PI;
  const ovalTurn = (channel(seed, 4) - 0.5) * 2.4;
  const tint: readonly [number, number, number] = [
    1 + (channel(seed, 5) - 0.5) * 0.07,
    1 + (channel(seed, 6) - 0.5) * 0.05,
    1 + (channel(seed, 7) - 0.5) * 0.06,
  ];
  const collars = [...graph.branches.values()]
    .filter((child) => child.parentId === branch.id)
    .map((child) => child.parentDistance);
  const collarWidth = Math.max(2.5 * baseRadius, 0.16);
  // Uncut growing tips close over their last stretch of stock.
  const closeLength = Math.min(0.35 * stockLength, Math.max(4 * baseRadius, 0.12));

  const meanRadiusAt = (distance: number): number => {
    const s = Math.min(Math.max(distance, 0), stockLength);
    const u = s / stockLength;
    let radius = baseRadius * (1 - (1 - tipRatio) * Math.pow(u, character.power));
    radius *= 1 + character.wave * kindScale * (0.6 * Math.sin(s * 7.6 + phase1) + 0.4 * Math.sin(s * 21.7 + phase2));
    for (const at of collars) {
      const x = (s - at) / collarWidth;
      if (Math.abs(x) < 3) radius *= 1 + character.collar * Math.exp(-x * x);
    }
    if (originalTip === "pointed") {
      const v = clamp01((s - (stockLength - closeLength)) / closeLength);
      radius *= 1 - character.tipClose * Math.pow(v, character.tipRound);
    } else if (originalTip === "receptacle") {
      const v = clamp01((s - (stockLength - closeLength * 0.6)) / (closeLength * 0.6));
      radius *= 1 + 0.16 * smooth(v);
    }
    return Math.max(radius, baseRadius * 0.12);
  };

  return {
    stockLength,
    tipReach: 0.4 + 1.2 * character.tipClose,
    baseRadius,
    tip,
    meanRadiusAt,
    radiusAt(distance, angle) {
      const s = Math.min(Math.max(distance, 0), stockLength);
      const oval = 1 + character.oval * Math.cos(2 * (angle - ovalPhase - ovalTurn * s / stockLength));
      return meanRadiusAt(s) * oval;
    },
    toneAt(distance) {
      const u = clamp01(distance / stockLength);
      // Older tissue at the base is a little darker and warmer; young growth is lighter.
      const depth = character.tone * (branch.kind === "petiole" || branch.kind === "pedicel" ? 0.5 : 1);
      const t = smooth(u);
      const base: readonly [number, number, number] = [1 - 0.1 * depth, 1 - 0.14 * depth, 1 - 0.17 * depth];
      const young: readonly [number, number, number] = [1 + 0.03 * depth, 1 + 0.07 * depth, 1 + 0.02 * depth];
      const mottle = 1 + 0.035 * Math.sin(distance * 5.3 + phase2) * Math.sin(distance * 1.9 + phase1);
      return [
        (base[0] + (young[0] - base[0]) * t) * tint[0] * mottle,
        (base[1] + (young[1] - base[1]) * t) * tint[1] * mottle,
        (base[2] + (young[2] - base[2]) * t) * tint[2] * mottle,
      ];
    },
  };
}

/** Shapes for every branch of a graph, parents first. */
export function stemShapes(graph: PlantGraph): ReadonlyMap<string, StemShape> {
  const stock = branchStock(graph);
  const shapes = new Map<string, StemShape>();
  const resolve = (branch: Branch, depth = 0): StemShape => {
    const existing = shapes.get(branch.id);
    if (existing) return existing;
    const parent = branch.parentId && depth < 16 ? graph.branches.get(branch.parentId) : undefined;
    const shape = buildShape(graph, branch, stock, parent ? resolve(parent, depth + 1) : null);
    shapes.set(branch.id, shape);
    return shape;
  };
  for (const branch of graph.branches.values()) resolve(branch);
  return shapes;
}

/** Stock distance at each point, starting from `start` (a cut for a distal piece). */
export function pointDistances(restLengths: readonly number[], count: number, start = 0): number[] {
  const distances = [start];
  for (let index = 1; index < count; index += 1) distances.push(distances[index - 1] + (restLengths[index - 1] ?? 0));
  return distances;
}

/** The tube skin for a whole branch, or one side of a previewed cut. */
export function tubeSkin(shape: StemShape, distances: readonly number[], end: "natural" | "cut"): TubeSkin {
  return {
    distances,
    radius: (distance, angle) => shape.radiusAt(distance, angle),
    tone: (distance) => shape.toneAt(distance),
    tipReach: shape.tipReach,
    endCap: end === "cut" || shape.tip === "cut" ? "cut" : shape.tip === "pointed" ? "point" : "closed",
  };
}
