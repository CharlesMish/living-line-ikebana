import { canonicalCameraPose } from "../../src/app/camera.ts";
import type { GardenDocument } from "../../src/app/garden.ts";
import {
  applyPrune,
  createFoliageFan,
  createLeafyShoot,
  previewPrune,
  successfulSeatIdentity,
  toCanonicalPlantGraph,
  translatePlantBase,
  type PlantGraph,
  type Vec3,
} from "../../src/core/index.ts";

const ORIGIN: Vec3 = { x: 0, y: 0.55, z: 0 };

/** Below every leaf stalk on the opening arm, above the shared non-trunk minimum. */
export const FOLIAGE_FAN_OPENING_CUT = 0.18;

export interface FoliageFanStudyPlacement {
  readonly ordinal: number;
  readonly role: "leafy" | "fan";
  readonly base: Vec3;
  readonly cutOpeningArm: boolean;
}

/**
 * One tall leafy shoot beside two foliage fans. The second fan has its
 * opening arm cut short so that side is a gap. The answering and crown arms
 * stay. Bases sit inside the usable kenzan.
 */
export const FOLIAGE_FAN_STUDY_PLACEMENTS: readonly FoliageFanStudyPlacement[] = [
  { ordinal: 1, role: "leafy", base: { x: -0.58, y: 0.55, z: 0.12 }, cutOpeningArm: false },
  { ordinal: 2, role: "fan", base: { x: 0.62, y: 0.55, z: -0.28 }, cutOpeningArm: false },
  { ordinal: 3, role: "fan", base: { x: 0.18, y: 0.55, z: 0.58 }, cutOpeningArm: true },
];

export function buildFoliageFanStudyGraph(placement: FoliageFanStudyPlacement): PlantGraph {
  const identity = successfulSeatIdentity(placement.ordinal);
  const created = placement.role === "leafy"
    ? createLeafyShoot(identity.id, identity.seed, ORIGIN)
    : createFoliageFan(identity.id, identity.seed, ORIGIN);
  let graph = translatePlantBase(created, placement.base);
  if (placement.cutOpeningArm) {
    const armId = `${identity.id}:arm-opening`;
    graph = applyPrune(graph, previewPrune(graph, armId, FOLIAGE_FAN_OPENING_CUT));
  }
  return graph;
}

export function buildFoliageFanStudyGraphs(): PlantGraph[] {
  return FOLIAGE_FAN_STUDY_PLACEMENTS.map((placement) => buildFoliageFanStudyGraph(placement));
}

export function foliageFanStudyGardenDocument(): GardenDocument {
  return {
    gardenVersion: 1,
    entries: [{
      id: "foliage-fan-beside-leafy",
      title: "A leafy line beside an opened fan",
      keptAt: "2026-09-23T12:00:00.000Z",
      thumbnail: null,
      arrangement: {
        plants: buildFoliageFanStudyGraphs().map((graph) => toCanonicalPlantGraph(graph)),
        successfulPlantOrdinal: FOLIAGE_FAN_STUDY_PLACEMENTS.length,
        camera: canonicalCameraPose("front"),
      },
    }],
  };
}
