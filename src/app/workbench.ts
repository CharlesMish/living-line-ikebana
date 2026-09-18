import { getMaterialDefinitions, assertValidPlantGraph, toCanonicalPlantGraph } from "../core/index.ts";
import { canonicalCameraPose } from "./camera.ts";
import type { ArrangementSnapshot } from "./garden.ts";
import { KENZAN_BASE } from "./materialInsertion.ts";

export const WORKBENCH_SEEDS = [8278, 9255, 10232] as const;
/** Explicit fixtures bypass seating only in the isolated developer bowl. */
export function createWorkbenchFixture(materialId: string, seed: number, count: number): ArrangementSnapshot {
  const materials = getMaterialDefinitions();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || ![1, 2, 6, 12].includes(count)) throw new Error("Choose a uint32 seed and a supported cutting count.");
  if (materialId !== "mixed" && !materials.some((material) => material.materialId === materialId)) throw new Error("Unknown fixture material.");
  const plants = Array.from({ length: count }, (_, index) => {
    const material = materialId === "mixed" ? materials[index % materials.length] : materials.find((item) => item.materialId === materialId)!;
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
export function describeFixture(snapshot: ArrangementSnapshot) {
  return {
    successfulPlantOrdinal: snapshot.successfulPlantOrdinal,
    plants: snapshot.plants.map((plant) => ({ id: plant.id, generatorVersion: plant.generatorVersion, seed: plant.seed,
      branches: plant.branches.length, organs: plant.organs.length,
      activeBranches: plant.branches.filter((branch) => branch.active).length,
      activeOrgans: plant.organs.filter((organ) => organ.active).length })),
  };
}
