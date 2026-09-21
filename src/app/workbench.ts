import { getMaterialDefinitions, assertValidPlantGraph, toCanonicalPlantGraph } from "../core/index.ts";
import { canonicalCameraPose } from "./camera.ts";
import type { ArrangementSnapshot } from "./garden.ts";
import { KENZAN_BASE } from "./materialInsertion.ts";

export const WORKBENCH_SEEDS = [8278, 9255, 10232] as const;
export const WORKBENCH_COUNTS = [1, 2, 6, 12] as const;

function requireWorkbenchSeedAndCount(seed: number, count: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || ![1, 2, 6, 12].includes(count)) {
    throw new Error("Choose a uint32 seed and a supported cutting count.");
  }
}

/**
 * Shared spiral used by ordinary mixed fixtures and named comparison profiles.
 * Bases, seeds and plant IDs stay identical for a given material list, seed and count.
 */
export function createWorkbenchArrangement(
  materialIds: readonly string[],
  seed: number,
  count: number,
): ArrangementSnapshot {
  requireWorkbenchSeedAndCount(seed, count);
  if (materialIds.length === 0) throw new Error("A workbench arrangement needs at least one material.");
  const catalog = getMaterialDefinitions();
  const plants = Array.from({ length: count }, (_, index) => {
    const materialId = materialIds[index % materialIds.length];
    const material = catalog.find((item) => item.materialId === materialId);
    if (!material) throw new Error("Unknown fixture material.");
    const angle = index * 2.399963;
    const radius = Math.min(0.86, Math.sqrt(index) * 0.28);
    const graph = material.generator.generate(`plant-${index + 1}`, (seed + 977 * index) >>> 0,
      { x: Math.sin(angle) * radius, y: KENZAN_BASE.y, z: Math.cos(angle) * radius });
    if (graph.generatorVersion !== material.generator.generatorVersion) throw new Error("Fixture generator version mismatch.");
    assertValidPlantGraph(graph);
    return toCanonicalPlantGraph(graph);
  });
  return { plants: plants.sort((a, b) => a.id.localeCompare(b.id)), successfulPlantOrdinal: count, camera: canonicalCameraPose("front") };
}

/** Explicit fixtures bypass seating only in the isolated developer bowl. */
export function createWorkbenchFixture(materialId: string, seed: number, count: number): ArrangementSnapshot {
  const materials = getMaterialDefinitions();
  if (materialId !== "mixed" && !materials.some((material) => material.materialId === materialId)) throw new Error("Unknown fixture material.");
  const materialIds = materialId === "mixed"
    ? materials.map((material) => material.materialId)
    : [materialId];
  return createWorkbenchArrangement(materialIds, seed, count);
}
export function describeFixture(snapshot: ArrangementSnapshot) {
  return {
    successfulPlantOrdinal: snapshot.successfulPlantOrdinal,
    plants: snapshot.plants.map((plant) => ({ id: plant.id, generatorVersion: plant.generatorVersion, seed: plant.seed,
      branches: plant.branches.length, organs: plant.organs.length,
      activeBranches: plant.branches.filter((branch) => branch.active).length,
      activeOrgans: plant.organs.filter((organ) => organ.active).length })),
  };
}
export function describeFixture(snapshot: ArrangementSnapshot) {
  return {
    successfulPlantOrdinal: snapshot.successfulPlantOrdinal,
    plants: snapshot.plants.map((plant) => ({ id: plant.id, generatorVersion: plant.generatorVersion, seed: plant.seed,
      branches: plant.branches.length, organs: plant.organs.length,
      activeBranches: plant.branches.filter((branch) => branch.active).length,
      activeOrgans: plant.organs.filter((organ) => organ.active).length })),
  };
}
