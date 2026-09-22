import { canonicalCameraPose } from "../../src/app/camera.ts";
import type { GardenDocument } from "../../src/app/garden.ts";
import {
  aimBranch,
  bendBranch,
  createReed,
  pruneBranch,
  sampleBranch,
  successfulSeatIdentity,
  toCanonicalPlantGraph,
  translatePlantBase,
  type PlantGraph,
  type Vec3,
} from "../../src/core/index.ts";

/** One seated reed in the study bowl. Lean is the aimed horizontal component. */
export interface ReedStudyPlacement {
  readonly ordinal: number;
  readonly base: Vec3;
  readonly azimuth: number;
  readonly lean: number;
  readonly pruneTo: number | null;
  readonly bendOffset: Vec3 | null;
}

/**
 * Five separate cuttings. Height comes from seeded stock plus two prunes.
 * Lean is aim. Spacing is where the base sits. One culm is bent.
 * There is no length control and no bundled sheaf.
 */
export const REED_STUDY_PLACEMENTS: readonly ReedStudyPlacement[] = [
  { ordinal: 1, base: { x: -0.58, y: 0.55, z: -0.12 }, azimuth: -2.45, lean: 0.14, pruneTo: null, bendOffset: null },
  { ordinal: 2, base: { x: 0.24, y: 0.55, z: 0.08 }, azimuth: 0.42, lean: 0.36, pruneTo: null, bendOffset: null },
  { ordinal: 3, base: { x: -0.16, y: 0.55, z: 0.62 }, azimuth: 1.7, lean: 0.2, pruneTo: 2.15, bendOffset: null },
  { ordinal: 4, base: { x: 0.8, y: 0.55, z: -0.28 }, azimuth: -0.15, lean: 0.22, pruneTo: null, bendOffset: { x: 0.32, y: 0.04, z: -0.12 } },
  { ordinal: 5, base: { x: 0.12, y: 0.55, z: -0.7 }, azimuth: -1.25, lean: 0.18, pruneTo: 3.35, bendOffset: null },
];

export function buildReedStudyGraph(placement: ReedStudyPlacement): PlantGraph {
  const identity = successfulSeatIdentity(placement.ordinal);
  let graph = createReed(identity.id, identity.seed, { x: 0, y: 0.55, z: 0 });
  graph = translatePlantBase(graph, placement.base);
  const culmId = graph.rootBranchId;
  let culm = graph.branches.get(culmId)!;
  const grabbed = sampleBranch(culm, culm.activeLength * 0.86);
  const root = culm.points[0]!;
  const reach = culm.activeLength * 0.86;
  const upright = Math.sqrt(Math.max(0.2, 1 - placement.lean * placement.lean));
  graph = aimBranch(graph, culmId, grabbed.position, {
    x: root.x + Math.cos(placement.azimuth) * placement.lean * reach,
    y: root.y + reach * upright,
    z: root.z + Math.sin(placement.azimuth) * placement.lean * reach,
  });
  if (placement.bendOffset) {
    culm = graph.branches.get(culmId)!;
    const stationDistance = culm.activeLength * 0.54;
    const station = sampleBranch(culm, stationDistance);
    graph = bendBranch(graph, {
      branchId: culmId,
      stationDistance,
      target: {
        x: station.position.x + placement.bendOffset.x,
        y: station.position.y + placement.bendOffset.y,
        z: station.position.z + placement.bendOffset.z,
      },
    });
  }
  if (placement.pruneTo !== null) graph = pruneBranch(graph, culmId, placement.pruneTo);
  return graph;
}

export function buildReedStudyGraphs(): PlantGraph[] {
  return REED_STUDY_PLACEMENTS.map((placement) => buildReedStudyGraph(placement));
}

export function reedStudyGardenDocument(): GardenDocument {
  return {
    gardenVersion: 1,
    entries: [{
      id: "reed-lines-study",
      title: "Reed lines and the spaces between",
      keptAt: "2026-09-22T05:00:00.000Z",
      thumbnail: null,
      arrangement: {
        plants: buildReedStudyGraphs().map((graph) => toCanonicalPlantGraph(graph)),
        successfulPlantOrdinal: REED_STUDY_PLACEMENTS.length,
        camera: canonicalCameraPose("front"),
      },
    }],
  };
}
