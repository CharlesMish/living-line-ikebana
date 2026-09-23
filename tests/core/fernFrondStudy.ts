import { canonicalCameraPose } from "../../src/app/camera.ts";
import type { GardenDocument } from "../../src/app/garden.ts";
import {
  applyPrune,
  createFernFrond,
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

/** On a pinna stalk, above the shared non-trunk minimum and below the blade. */
export const FERN_FROND_PINNA_CUT = 0.06;

export interface FernFrondStudyPlacement {
  readonly ordinal: number;
  readonly role: "leafy" | "fan" | "frond";
  readonly base: Vec3;
  readonly cutDistal: boolean;
}

/**
 * Leafy shoot, foliage fan, one whole frond, and one frond whose upper
 * pinnae are gone. Bases sit inside the usable kenzan. The cut is the gap
 * between pinna 4 and pinna 5, so the basal four feathers stay.
 */
export const FERN_FROND_STUDY_PLACEMENTS: readonly FernFrondStudyPlacement[] = [
  { ordinal: 1, role: "leafy", base: { x: -0.62, y: 0.55, z: 0.18 }, cutDistal: false },
  { ordinal: 2, role: "fan", base: { x: 0.58, y: 0.55, z: -0.36 }, cutDistal: false },
  { ordinal: 3, role: "frond", base: { x: 0.12, y: 0.55, z: 0.64 }, cutDistal: false },
  { ordinal: 4, role: "frond", base: { x: -0.22, y: 0.55, z: -0.52 }, cutDistal: true },
];

/** Midpoint between the fourth and fifth pinna attachments on the rachis. */
export function fernFrondDistalCutDistance(graph: PlantGraph): number {
  const distances = [...graph.branches.values()]
    .filter((branch) => branch.parentId === graph.rootBranchId)
    .map((branch) => branch.parentDistance)
    .sort((left, right) => left - right);
  return (distances[3]! + distances[4]!) / 2;
}

export function buildFernFrondStudyGraph(placement: FernFrondStudyPlacement): PlantGraph {
  const identity = successfulSeatIdentity(placement.ordinal);
  const created = placement.role === "leafy"
    ? createLeafyShoot(identity.id, identity.seed, ORIGIN)
    : placement.role === "fan"
      ? createFoliageFan(identity.id, identity.seed, ORIGIN)
      : createFernFrond(identity.id, identity.seed, ORIGIN);
  let graph = translatePlantBase(created, placement.base);
  if (placement.cutDistal) {
    graph = applyPrune(graph, previewPrune(graph, graph.rootBranchId, fernFrondDistalCutDistance(graph)));
  }
  return graph;
}

export function buildFernFrondStudyGraphs(): PlantGraph[] {
  return FERN_FROND_STUDY_PLACEMENTS.map((placement) => buildFernFrondStudyGraph(placement));
}

export function fernFrondStudyGardenDocument(): GardenDocument {
  return {
    gardenVersion: 1,
    entries: [{
      id: "fern-frond-beside-leafy-and-fan",
      title: "A feather beside a leafy line and a fan",
      keptAt: "2026-09-23T18:00:00.000Z",
      thumbnail: null,
      arrangement: {
        plants: buildFernFrondStudyGraphs().map((graph) => toCanonicalPlantGraph(graph)),
        successfulPlantOrdinal: FERN_FROND_STUDY_PLACEMENTS.length,
        camera: canonicalCameraPose("front"),
      },
    }],
  };
}
