import { canonicalCameraPose } from "../../src/app/camera.ts";
import type { GardenDocument } from "../../src/app/garden.ts";
import {
  applyPrune,
  createBerryTwig,
  createFernFrond,
  createFloweringBranch,
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

/** Non-trunk minimum is 0.045. 0.12 sits above that and below the first berry stem. */
export const BERRY_CLUSTER_CLEAR_DISTANCE = 0.12;

/** On a pinna stalk, above the shared non-trunk minimum and below the blade. */
export const FERN_PINNA_CUT_DISTANCE = 0.06;

export interface Phase2Placement {
  readonly ordinal: number;
  readonly material: "flowering-branch" | "leafy-shoot" | "foliage-fan" | "berry-twig" | "fern-frond";
  readonly base: Vec3;
  readonly edit: "keep" | "clear-cluster" | "cut-pinna" | "cut-rachis";
  /** Cluster lateral to clear. Ignored unless edit is clear-cluster. */
  readonly clusterId?: string;
  /** Pinna stalk to cut. Ignored unless edit is cut-pinna. */
  readonly pinnaId?: string;
}

/**
 * Flowering line, a berry twig with every cluster still on the wood, and a
 * fern with one pinna removed. The other pinnae stay.
 */
export const PHASE2_KEPT_PLACEMENTS: readonly Phase2Placement[] = [
  { ordinal: 1, material: "flowering-branch", base: { x: -0.46, y: 0.55, z: 0.24 }, edit: "keep" },
  { ordinal: 2, material: "berry-twig", base: { x: 0.4, y: 0.55, z: 0.3 }, edit: "keep" },
  {
    ordinal: 3,
    material: "fern-frond",
    base: { x: 0.02, y: 0.55, z: -0.5 },
    edit: "cut-pinna",
    pinnaId: "plant-3:pinna-2",
  },
];

/**
 * Leafy line, a foliage fan, a berry twig with one cluster cleared, and a
 * fern whose upper pinnae are gone. The other berry clusters stay.
 */
export const PHASE2_OPENED_PLACEMENTS: readonly Phase2Placement[] = [
  { ordinal: 1, material: "leafy-shoot", base: { x: -0.38, y: 0.55, z: 0.46 }, edit: "keep" },
  {
    ordinal: 2,
    material: "berry-twig",
    base: { x: 0.52, y: 0.55, z: 0.08 },
    edit: "clear-cluster",
    clusterId: "plant-2:cluster-2",
  },
  { ordinal: 3, material: "fern-frond", base: { x: -0.12, y: 0.55, z: -0.44 }, edit: "cut-rachis" },
  { ordinal: 4, material: "foliage-fan", base: { x: 0.18, y: 0.55, z: 0.12 }, edit: "keep" },
];

/** Midpoint between the fourth and fifth pinna attachments on the rachis. */
export function fernRachisOpenDistance(graph: PlantGraph): number {
  const distances = [...graph.branches.values()]
    .filter((branch) => branch.parentId === graph.rootBranchId && branch.active)
    .map((branch) => branch.parentDistance)
    .sort((left, right) => left - right);
  return (distances[3]! + distances[4]!) / 2;
}

function createPlacement(placement: Phase2Placement): PlantGraph {
  const identity = successfulSeatIdentity(placement.ordinal);
  const created = placement.material === "flowering-branch"
    ? createFloweringBranch(identity.id, identity.seed, ORIGIN)
    : placement.material === "leafy-shoot"
      ? createLeafyShoot(identity.id, identity.seed, ORIGIN)
      : placement.material === "foliage-fan"
        ? createFoliageFan(identity.id, identity.seed, ORIGIN)
        : placement.material === "berry-twig"
          ? createBerryTwig(identity.id, identity.seed, ORIGIN)
          : createFernFrond(identity.id, identity.seed, ORIGIN);
  let graph = translatePlantBase(created, placement.base);
  if (placement.edit === "clear-cluster") {
    const branchId = placement.clusterId ?? `${identity.id}:cluster-2`;
    graph = applyPrune(graph, previewPrune(graph, branchId, BERRY_CLUSTER_CLEAR_DISTANCE));
  } else if (placement.edit === "cut-pinna") {
    const branchId = placement.pinnaId ?? `${identity.id}:pinna-2`;
    graph = applyPrune(graph, previewPrune(graph, branchId, FERN_PINNA_CUT_DISTANCE));
  } else if (placement.edit === "cut-rachis") {
    graph = applyPrune(graph, previewPrune(graph, graph.rootBranchId, fernRachisOpenDistance(graph)));
  }
  return graph;
}

export function buildPhase2KeptGraphs(): PlantGraph[] {
  return PHASE2_KEPT_PLACEMENTS.map((placement) => createPlacement(placement));
}

export function buildPhase2OpenedGraphs(): PlantGraph[] {
  return PHASE2_OPENED_PLACEMENTS.map((placement) => createPlacement(placement));
}

function entry(
  id: string,
  title: string,
  graphs: readonly PlantGraph[],
): GardenDocument["entries"][number] {
  return {
    id,
    title,
    keptAt: "2026-09-23T20:00:00.000Z",
    thumbnail: null,
    arrangement: {
      plants: graphs.map((graph) => toCanonicalPlantGraph(graph)),
      successfulPlantOrdinal: graphs.length,
      camera: canonicalCameraPose("front"),
    },
  };
}

export function phase2ArrangementsGardenDocument(): GardenDocument {
  return {
    gardenVersion: 1,
    entries: [
      entry(
        "phase2-clusters-kept-pinna-cut",
        "Clusters kept, one pinna cut",
        buildPhase2KeptGraphs(),
      ),
      entry(
        "phase2-cluster-cleared-rachis-cut",
        "One cluster cleared, upper frond cut",
        buildPhase2OpenedGraphs(),
      ),
    ],
  };
}
