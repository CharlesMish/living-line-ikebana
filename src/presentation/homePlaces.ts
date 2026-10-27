import type { CanonicalPlantGraph, OrganKind } from "../core/index.ts";
import { ORIGINAL_VESSEL, VESSEL_PROFILES, vesselParts } from "../study/vesselProfiles.ts";

/**
 * The home is a washitsu-inspired room: a tokonoma alcove with its hanging
 * scroll, staggered chigaidana shelves beside it, a shoji-lit window desk and a
 * low table. Room units are botanical units (the Original bowl is about 5.3
 * across), so a kept arrangement is never rescaled to suit a place.
 *
 * Pure data and arithmetic: no renderer, DOM or storage. The room builder and
 * the placement UI both read these numbers, so a "fits" answer always matches
 * the geometry the visitor sees.
 */
export type HomePlaceKind = "arrangement" | "photograph";
export type HomePlaceId = "tokonoma" | "table" | "shoin" | "shelf-low" | "shelf-high" | "scroll";

export interface HomePlace {
  readonly id: HomePlaceId;
  readonly kind: HomePlaceKind;
  readonly label: string;
  /** How a sentence puts something there: "in the tokonoma", "on the low table". */
  readonly at: string;
  /** One line about the place itself, shown when it is chosen. */
  readonly description: string;
  /** What the place suits. Data, not a rule; later requests can reuse it. */
  readonly suits: string;
  /** World position of the surface centre (arrangement) or scroll centre. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Headroom above the surface before the arrangement meets the room. */
  readonly clearance: number;
  /** Largest vessel half-extent the surface can carry, in x and z. */
  readonly surfaceHalfX: number;
  readonly surfaceHalfZ: number;
  /** Walls, paper and boards beside the place that a piece could reach into. */
  readonly obstacles: readonly PlaceObstacle[];
}

/**
 * A vertical plane beside a place, in place-local units (the place centre at
 * surface height is the origin). A piece must stay on the near side of it.
 * Pieces are never turned to fit: each keeps the front it was photographed from.
 */
export interface PlaceObstacle {
  /** Worded for the visitor: "the shoji behind it". */
  readonly label: string;
  readonly axis: "x" | "z";
  /** -1: points must stay above -limit; +1: below +limit. */
  readonly sign: -1 | 1;
  readonly limit: number;
  /** The plane exists only between these local heights. */
  readonly minY?: number;
  readonly maxY?: number;
  /** ...and only where the other horizontal axis lies in this local range. */
  readonly across?: readonly [number, number];
}

/** Room frame, shared with the renderer. */
export const HOME_ROOM = Object.freeze({
  left: -22, right: 22, back: -12, front: 21, ceiling: 30,
  alcoveBack: -21, alcoveFloor: 1.2, lintel: 24, alcoveCeiling: 27,
  /** x where the tokonoma ends and the shelf alcove begins (the tokobashira). */
  post: 1.3,
  shelfLowTop: 10.2, shelfHighTop: 14.2, cupboardBottom: 21.6,
  shoinDepth: 5.8, shoinTop: 4.4, shojiTop: 19.4,
  /** Paper, stiles and kumiko: how far the shoji stands in from the bay's back. */
  shojiFrame: .45,
  /** Half-length of the window bay along the wall. */
  shoinHalfLength: 6.6,
  tableTop: 3.4, tableRadius: 5.8, tableX: 3.5, tableZ: 5,
  /** Hanging scroll: bottom roller height and mount width. */
  scrollBottom: 8.2, scrollWidth: 7.4,
});

const R = HOME_ROOM;
/** The shelf alcove's left side: the face of the partition by the post. */
const SHELF_ALCOVE_LEFT = R.post + .15;
const SHELF_LOW = { x: 6.6, z: -16.6 }, SHELF_HIGH = { x: 16.6, z: -16.6 };
const TOKONOMA = { x: -10.4, z: -16.6 };
/** The sill runs from the shoji's inner face to a lip just past the wall line. */
const SILL_BACK = R.left - R.shoinDepth + R.shojiFrame, SILL_FRONT = R.left + .5;
const SHOIN = { x: (SILL_BACK + SILL_FRONT) / 2, z: -2, half: (SILL_FRONT - SILL_BACK) / 2 };
/** The scroll hangs .12 off the alcove back; its roller and end caps stand
 * .66 out at the bottom, the mount itself about .2. */
const SCROLL_Z = R.alcoveBack + .12;

const behind = (label: string, limit: number, extra: Partial<PlaceObstacle> = {}): PlaceObstacle =>
  Object.freeze({ label, axis: "z", sign: -1, limit, ...extra });
const TOKONOMA_OBSTACLES: readonly PlaceObstacle[] = Object.freeze([
  behind("the back of the alcove", TOKONOMA.z - R.alcoveBack),
  behind("the hanging scroll", TOKONOMA.z - (R.alcoveBack + .66), { minY: R.scrollBottom - .34 - R.alcoveFloor, maxY: R.scrollBottom + .34 - R.alcoveFloor,
    across: [-(R.scrollWidth / 2 + .85), R.scrollWidth / 2 + .85] as const }),
  behind("the hanging scroll", TOKONOMA.z - (R.alcoveBack + .21), { minY: R.scrollBottom - R.alcoveFloor, across: [-R.scrollWidth / 2, R.scrollWidth / 2] as const }),
  Object.freeze({ label: "the side of the alcove", axis: "x", sign: -1, limit: TOKONOMA.x - R.left }),
  Object.freeze({ label: "the side of the alcove", axis: "x", sign: 1, limit: R.post - .15 - TOKONOMA.x }),
]);
const SHOIN_OBSTACLES: readonly PlaceObstacle[] = Object.freeze([
  Object.freeze({ label: "the shoji behind it", axis: "x", sign: -1, limit: SHOIN.x - SILL_BACK }),
  ...([-1, 1] as const).map(sign => Object.freeze({ label: "the side of the window bay", axis: "z" as const, sign, limit: R.shoinHalfLength,
    across: [R.left - R.shoinDepth - SHOIN.x, R.left - SHOIN.x] as const })),
]);
const SHELF_LOW_OBSTACLES: readonly PlaceObstacle[] = Object.freeze([
  behind("the back wall", SHELF_LOW.z - R.alcoveBack),
  Object.freeze({ label: "the side of the shelf alcove", axis: "x", sign: -1, limit: SHELF_LOW.x - SHELF_ALCOVE_LEFT }),
  // The upper shelf's board begins 5.4 left of its centre, .38 thick.
  Object.freeze({ label: "the upper shelf", axis: "x", sign: 1, limit: SHELF_HIGH.x - 5.4 - SHELF_LOW.x, minY: R.shelfHighTop - .38 - R.shelfLowTop }),
  // The little ebizuka post joining the two shelves, near their front.
  Object.freeze({ label: "the little post between the shelves", axis: "x", sign: 1, limit: 4.9, maxY: R.shelfHighTop - .38 - R.shelfLowTop,
    across: [R.back - 2.6 - SHELF_LOW.z, R.back - 2.3 - SHELF_LOW.z] as const }),
]);
const SHELF_HIGH_OBSTACLES: readonly PlaceObstacle[] = Object.freeze([
  behind("the back wall", SHELF_HIGH.z - R.alcoveBack),
  Object.freeze({ label: "the side wall", axis: "x", sign: 1, limit: R.right - SHELF_HIGH.x }),
]);
export const HOME_PLACES: readonly HomePlace[] = Object.freeze([
  Object.freeze({ id: "tokonoma", at: "in the tokonoma", kind: "arrangement", label: "Tokonoma",
    description: "The alcove. One piece, seen across the room with the scroll behind it.",
    suits: "Tall and unhurried. It shares the alcove with the scroll, so leave air above and behind it.",
    x: TOKONOMA.x, y: R.alcoveFloor, z: TOKONOMA.z, clearance: R.lintel - R.alcoveFloor - .6, surfaceHalfX: 10.5, surfaceHalfZ: 4.3, obstacles: TOKONOMA_OBSTACLES }),
  Object.freeze({ id: "table", at: "on the low table", kind: "arrangement", label: "Low table",
    description: "Close at hand, seen from every side.",
    suits: "Seen from every cushion, so it should read from all sides and stay low enough to talk across.",
    x: R.tableX, y: R.tableTop, z: R.tableZ, clearance: R.ceiling - R.tableTop - 1, surfaceHalfX: R.tableRadius, surfaceHalfZ: R.tableRadius, obstacles: [] }),
  Object.freeze({ id: "shoin", at: "on the window desk", kind: "arrangement", label: "Window desk",
    description: "A deep sill under the shoji, lit from behind.",
    suits: "Lit through the shoji behind it, so a spare, open outline reads best against the paper.",
    x: SHOIN.x, y: R.shoinTop, z: SHOIN.z, clearance: R.shojiTop - R.shoinTop - .5, surfaceHalfX: SHOIN.half, surfaceHalfZ: R.shoinHalfLength - .1, obstacles: SHOIN_OBSTACLES }),
  Object.freeze({ id: "shelf-low", at: "on the lower shelf", kind: "arrangement", label: "Lower shelf",
    description: "The lower of the staggered shelves beside the alcove.",
    suits: "A quiet companion to the tokonoma. Keep it modest, and mind the upper shelf to its right.",
    x: SHELF_LOW.x, y: R.shelfLowTop, z: SHELF_LOW.z, clearance: R.cupboardBottom - R.shelfLowTop - .5, surfaceHalfX: 5, surfaceHalfZ: 4.3, obstacles: SHELF_LOW_OBSTACLES }),
  Object.freeze({ id: "shelf-high", at: "on the upper shelf", kind: "arrangement", label: "Upper shelf",
    description: "The higher shelf, under the little cupboard.",
    suits: "Something small, or a stem that trails; it has the least headroom in the room.",
    x: SHELF_HIGH.x, y: R.shelfHighTop, z: SHELF_HIGH.z, clearance: R.cupboardBottom - R.shelfHighTop - .5, surfaceHalfX: 5, surfaceHalfZ: 4.3, obstacles: SHELF_HIGH_OBSTACLES }),
  Object.freeze({ id: "scroll", at: "as the scroll", kind: "photograph", label: "Scroll",
    description: "A kept photograph, mounted as the hanging scroll in the tokonoma.",
    suits: "Any kept photograph.",
    x: TOKONOMA.x, y: 17.6, z: SCROLL_Z, clearance: 0, surfaceHalfX: 0, surfaceHalfZ: 0, obstacles: [] }),
]);
export const HOME_PLACE_IDS = HOME_PLACES.map(place => place.id);
export const ARRANGEMENT_PLACE_IDS = HOME_PLACES.filter(place => place.kind === "arrangement").map(place => place.id);

export function homePlace(id: string): HomePlace | null {
  return HOME_PLACES.find(place => place.id === id) ?? null;
}

/**
 * How far the rendered material reaches beyond the graph: [up, side], per unit
 * organ scale, measured from the botanical meshes (see homePlaces.test.ts,
 * which builds every cutting and fails if an estimate falls short). Bare wood
 * barely passes its branch points; a fern pinna or a single flower's head
 * stands well clear of its anchor. Unknown generators get the widest reach.
 */
type Reach = readonly [up: number, side: number];
type ReachTable = Partial<Record<OrganKind | "stem", Reach>>;
const DEFAULT_REACH: Required<ReachTable> = Object.freeze({
  stem: [.08, .12], leaf: [1.25, 1.3], bloom: [.8, .8], bud: [.35, .35], berry: [.2, .2], seedpod: [.75, .45],
});
const REACH: Readonly<Record<string, ReachTable>> = Object.freeze({
  "one-branch-v1": { leaf: [.65, .65], bloom: [.6, .6] },
  "arching-trailer-v1": { leaf: [.6, .65] },
  "blossom-spray-v2": { bloom: [.55, .55] },
  "broad-blade-v1": { stem: [.05, .55] },
  "compact-flower-v1": { leaf: [.45, .65], bloom: [.7, .7] },
  "fern-frond-v2": { leaf: [1.2, 1.25] },
  "flower-volume-v1": { leaf: [.45, .65], bloom: [.7, .7] },
  "foliage-fan-v1": { leaf: [.7, .7] },
  "indigo-spire-v1": { leaf: [.4, 1.05], bloom: [.3, .5] },
  "leafy-shoot-v1": { leaf: [.85, 1.05] },
  "lobed-leaf-v1": { leaf: [1.25, 1.3] },
  "nodding-flower-v2": { leaf: [.4, .6], bloom: [.35, .75] },
  "single-flower-v1": { leaf: [.5, .65], bloom: [.8, .8] },
  "starry-pincushion-v1": { leaf: [.9, 1.3], bloom: [.5, .5] },
  "violet-sprig-v1": { leaf: [.95, 1.3], bloom: [.45, .45] },
  "silver-seed-v1": { seedpod: [.75, .45] },
});
export function materialReach(generatorVersion: string, kind: OrganKind | "stem"): Reach {
  return REACH[generatorVersion]?.[kind] ?? DEFAULT_REACH[kind];
}

const VESSEL_RADIUS = 2.64;
const VESSEL_TOP = .66;

/** A point of material with how far it reaches up and sideways. */
export interface ReachSample { readonly x: number; readonly y: number; readonly z: number; readonly up: number; readonly side: number }

export interface ArrangementExtent {
  /** Highest point above the arrangement's datum. */
  height: number;
  /** Vessel footprint half-extents: what must rest on the surface. */
  vesselHalfX: number;
  vesselHalfZ: number;
  /** Branch points and organ anchors, for checking walls beside a place. */
  samples?: readonly ReachSample[];
}

interface ExtentSource {
  plants: readonly Pick<CanonicalPlantGraph, "branches" | "organs" | "generatorVersion">[];
  scene?: { layoutId?: string };
}

type Polyline = Pick<CanonicalPlantGraph["branches"][number], "points" | "restLengths">;
function pointAlong(branch: Polyline, distance: number) {
  let cursor = 0;
  for (let index = 0; index < branch.restLengths.length; index++) {
    const length = branch.restLengths[index]!;
    if (distance <= cursor + length) {
      const t = length > 0 ? Math.min(1, Math.max(0, (distance - cursor) / length)) : 0;
      const a = branch.points[index]!, b = branch.points[index + 1]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    cursor += length;
  }
  return branch.points[branch.points.length - 1] ?? null;
}

export function arrangementExtent(arrangement: ExtentSource): ArrangementExtent {
  const profile = VESSEL_PROFILES.find(item => item.id === arrangement.scene?.layoutId) ?? ORIGINAL_VESSEL;
  let vesselHalfX = 0, vesselHalfZ = 0;
  for (const part of vesselParts(profile)) {
    vesselHalfX = Math.max(vesselHalfX, Math.abs(part.x) + VESSEL_RADIUS * part.scaleX);
    vesselHalfZ = Math.max(vesselHalfZ, Math.abs(part.z) + VESSEL_RADIUS * part.scaleZ);
  }
  const samples: ReachSample[] = [];
  const add = (point: { x: number; y: number; z: number } | null, up: number, side: number) => {
    if (point && [point.x, point.y, point.z].every(Number.isFinite)) samples.push({ x: point.x, y: point.y, z: point.z, up, side });
  };
  for (const plant of arrangement.plants) {
    const branches = new Map(plant.branches.map(branch => [branch.id, branch]));
    const [stemUp, stemSide] = materialReach(plant.generatorVersion, "stem");
    for (const branch of plant.branches) {
      if (!branch.active) continue;
      for (const point of branch.points) add(point, stemUp, stemSide);
    }
    for (const organ of plant.organs ?? []) {
      const branch = branches.get(organ.branchId);
      if (!organ.active || !branch?.active || !(organ.scale > 0)) continue;
      const [up, side] = materialReach(plant.generatorVersion, organ.kind);
      add(pointAlong(branch, organ.distance), up * organ.scale, side * organ.scale);
    }
  }
  const height = samples.reduce((top, sample) => Math.max(top, sample.y + sample.up), VESSEL_TOP);
  return { height, vesselHalfX, vesselHalfZ, samples };
}

/** How far into an obstacle a piece may brush before it no longer fits. */
export const GRAZE = .4;

export type PlaceFit = { fits: true; note?: string } | { fits: false; reason: string };

/** The deepest reach into any of a place's obstacles: how far, and into what. */
export function deepestReach(place: HomePlace, samples: readonly ReachSample[]) {
  let worst: { obstacle: PlaceObstacle; reach: number; depth: number } | null = null;
  for (const obstacle of place.obstacles) {
    const other = obstacle.axis === "x" ? "z" : "x";
    for (const sample of samples) {
      if (obstacle.minY !== undefined && sample.y + sample.up < obstacle.minY) continue;
      if (obstacle.maxY !== undefined && sample.y - sample.side > obstacle.maxY) continue;
      if (obstacle.across && (sample[other] + sample.side < obstacle.across[0] || sample[other] - sample.side > obstacle.across[1])) continue;
      const reach = obstacle.sign * sample[obstacle.axis] + sample.side;
      const depth = reach - obstacle.limit;
      if (depth > 0 && (!worst || depth > worst.depth)) worst = { obstacle, reach, depth };
    }
  }
  return worst;
}

/** Physical fit only. Never a judgement of the arrangement. */
export function placeFit(place: HomePlace, extent: ArrangementExtent | null): PlaceFit {
  if (place.kind === "photograph") return { fits: true };
  if (!extent) return { fits: false, reason: "Choose a kept arrangement." };
  if (extent.vesselHalfX > place.surfaceHalfX || extent.vesselHalfZ > place.surfaceHalfZ) {
    return { fits: false, reason: "This vessel is wider than the surface." };
  }
  if (extent.height > place.clearance) {
    return { fits: false, reason: `Too tall here: about ${extent.height.toFixed(1)} high, with ${place.clearance.toFixed(1)} of room.` };
  }
  const worst = deepestReach(place, extent.samples ?? []);
  if (worst && worst.depth > GRAZE) {
    return { fits: false, reason: `It reaches into ${worst.obstacle.label}: about ${worst.reach.toFixed(1)} out, with ${worst.obstacle.limit.toFixed(1)} of room.` };
  }
  if (worst) return { fits: true, note: `Its edge just brushes ${worst.obstacle.label}.` };
  return { fits: true };
}
