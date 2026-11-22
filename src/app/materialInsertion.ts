import {
  prepareMaterialInsertion,
  settleNaturalPose,
  type MaterialInsertionPreparation,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";

export const KENZAN_BASE: Vec3 = { x: 0, y: 0.55, z: 0 };

/**
 * Shared app-level preparation for both tray pointer drag and keyboard
 * activation. The source material ID is consumed here and never enters the
 * transaction reservation or graph.
 */
/** `stock` hands over the generator's design exactly, for comparison. */
export type CuttingPose = "natural" | "stock";
export const ACCEPTED_CUTTING_POSE: CuttingPose = "natural";

export function prepareMaterialInsertionForApp(
  materialId: string,
  successfulPlantOrdinal: number,
  pose: CuttingPose = ACCEPTED_CUTTING_POSE,
): MaterialInsertionPreparation {
  const prepared = prepareMaterialInsertion(
    materialId,
    successfulPlantOrdinal + 1,
    KENZAN_BASE,
  );
  // A tray cutting arrives in its own natural pose: the generator's stock,
  // moved only by the shared Aim and Bend laws. Preview and commit share it.
  if (!prepared.ok || pose === "stock") return prepared;
  return { ...prepared, graph: settleNaturalPose(prepared.graph) };
}

/** The selected continuation after seating is the graph's declared root. */
export function selectedBranchIdForSeatedGraph(
  graph: Pick<PlantGraph, "rootBranchId">,
): string {
  return graph.rootBranchId;
}
