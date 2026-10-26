import type { CanonicalPlantGraph } from "../core/index.ts";
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
}

/** Room frame, shared with the renderer. */
export const HOME_ROOM = Object.freeze({
  left: -22, right: 22, back: -12, front: 21, ceiling: 30,
  alcoveBack: -21, alcoveFloor: 1.2, lintel: 24, alcoveCeiling: 27,
  /** x where the tokonoma ends and the shelf alcove begins (the tokobashira). */
  post: 1.3,
  shelfLowTop: 10.2, shelfHighTop: 14.2, cupboardBottom: 21.6,
  shoinDepth: 5.4, shoinTop: 4.4, shojiTop: 19.4,
  tableTop: 3.4, tableRadius: 5.8, tableX: 3.5, tableZ: 5,
});

const R = HOME_ROOM;
export const HOME_PLACES: readonly HomePlace[] = Object.freeze([
  Object.freeze({ id: "tokonoma", at: "in the tokonoma", kind: "arrangement", label: "Tokonoma",
    description: "The alcove. One piece, seen across the room with the scroll behind it.",
    suits: "Room to stand tall; the piece the room is about.",
    x: -10.4, y: R.alcoveFloor, z: -16.6, clearance: R.lintel - R.alcoveFloor - .6, surfaceHalfX: 10.5, surfaceHalfZ: 4.3 }),
  Object.freeze({ id: "table", at: "on the low table", kind: "arrangement", label: "Low table",
    description: "Close at hand, seen from every side.",
    suits: "Low and open, so people can talk across it.",
    x: R.tableX, y: R.tableTop, z: R.tableZ, clearance: R.ceiling - R.tableTop - 1, surfaceHalfX: R.tableRadius, surfaceHalfZ: R.tableRadius }),
  Object.freeze({ id: "shoin", at: "on the window desk", kind: "arrangement", label: "Window desk",
    description: "A deep sill under the shoji, lit from behind.",
    suits: "Narrow and quiet, with the paper light around it.",
    x: R.left - R.shoinDepth / 2, y: R.shoinTop, z: -2, clearance: R.shojiTop - R.shoinTop - .5, surfaceHalfX: R.shoinDepth / 2 + .6, surfaceHalfZ: 6.5 }),
  Object.freeze({ id: "shelf-low", at: "on the lower shelf", kind: "arrangement", label: "Lower shelf",
    description: "The lower of the staggered shelves beside the alcove.",
    suits: "A small companion to the tokonoma.",
    x: 6.6, y: R.shelfLowTop, z: -16.6, clearance: R.cupboardBottom - R.shelfLowTop - .5, surfaceHalfX: 5, surfaceHalfZ: 4.3 }),
  Object.freeze({ id: "shelf-high", at: "on the upper shelf", kind: "arrangement", label: "Upper shelf",
    description: "The higher shelf, under the little cupboard.",
    suits: "Something short; it has the least headroom in the room.",
    x: 16.6, y: R.shelfHighTop, z: -16.6, clearance: R.cupboardBottom - R.shelfHighTop - .5, surfaceHalfX: 5, surfaceHalfZ: 4.3 }),
  Object.freeze({ id: "scroll", at: "as the scroll", kind: "photograph", label: "Scroll",
    description: "A kept photograph, mounted as the hanging scroll in the tokonoma.",
    suits: "Any kept photograph.",
    x: -10.4, y: 17.6, z: R.alcoveBack + .12, clearance: 0, surfaceHalfX: 0, surfaceHalfZ: 0 }),
]);
export const HOME_PLACE_IDS = HOME_PLACES.map(place => place.id);
export const ARRANGEMENT_PLACE_IDS = HOME_PLACES.filter(place => place.kind === "arrangement").map(place => place.id);

export function homePlace(id: string): HomePlace | null {
  return HOME_PLACES.find(place => place.id === id) ?? null;
}

/** Leaves, petals and berries reach a little beyond their branch points. */
const ORGAN_MARGIN = .55;
const VESSEL_RADIUS = 2.64;
const VESSEL_TOP = .66;

export interface ArrangementExtent {
  /** Highest point above the arrangement's datum. */
  height: number;
  /** Vessel footprint half-extents: what must rest on the surface. */
  vesselHalfX: number;
  vesselHalfZ: number;
}

interface ExtentSource {
  plants: readonly Pick<CanonicalPlantGraph, "branches">[];
  scene?: { layoutId?: string };
}

export function arrangementExtent(arrangement: ExtentSource): ArrangementExtent {
  const profile = VESSEL_PROFILES.find(item => item.id === arrangement.scene?.layoutId) ?? ORIGINAL_VESSEL;
  let vesselHalfX = 0, vesselHalfZ = 0;
  for (const part of vesselParts(profile)) {
    vesselHalfX = Math.max(vesselHalfX, Math.abs(part.x) + VESSEL_RADIUS * part.scaleX);
    vesselHalfZ = Math.max(vesselHalfZ, Math.abs(part.z) + VESSEL_RADIUS * part.scaleZ);
  }
  let top = VESSEL_TOP;
  for (const plant of arrangement.plants) {
    for (const branch of plant.branches) {
      if (!branch.active) continue;
      for (const point of branch.points) if (Number.isFinite(point.y)) top = Math.max(top, point.y + ORGAN_MARGIN);
    }
  }
  return { height: top, vesselHalfX, vesselHalfZ };
}

export type PlaceFit = { fits: true } | { fits: false; reason: string };

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
  return { fits: true };
}
