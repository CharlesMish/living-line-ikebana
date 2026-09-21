import {
  assertValidPlantGraph,
  getMaterialDefinitions,
  toCanonicalPlantGraph,
  type MaterialDefinition,
} from "../core/index.ts";
import { canonicalCameraPose } from "./camera.ts";
import type { ArrangementSnapshot } from "./garden.ts";
import {
  describeMaterialSequenceComposition,
  getWorkbenchFixtureProfile,
  isWorkbenchCount,
  planWorkbenchCuttings,
  resolveWorkbenchFixture,
  type ResolvedWorkbenchFixture,
  type WorkbenchCuttingPlan,
  type WorkbenchSequenceComposition,
} from "./workbenchProfiles.ts";

export {
  BARE_BRANCH_MATERIAL_ID,
  describeMaterialSequenceComposition,
  FLOWERING_BRANCH_MATERIAL_ID,
  getWorkbenchFixtureProfile,
  LEAFY_SHOOT_MATERIAL_ID,
  listWorkbenchFixtureOptions,
  MIXED_FIXTURE_ALIAS,
  planWorkbenchCuttings,
  REFERENCE_MATERIAL_IDS,
  resolveWorkbenchFixture,
  SINGLE_FLOWER_MATERIAL_ID,
  WORKBENCH_COUNTS,
  WORKBENCH_FIXTURE_PROFILES,
  WORKBENCH_SEEDS,
  workbenchCuttingBase,
  workbenchCuttingSeed,
  workbenchPlantId,
} from "./workbenchProfiles.ts";
export type {
  ResolvedWorkbenchFixture,
  WorkbenchCount,
  WorkbenchCuttingPlan,
  WorkbenchFixtureOption,
  WorkbenchFixtureProfile,
  WorkbenchFixtureProfileId,
  WorkbenchSequenceComposition,
} from "./workbenchProfiles.ts";

export interface CreateWorkbenchFixtureOptions {
  /** Override the live catalog. Production callers omit this. */
  readonly catalog?: readonly MaterialDefinition[];
  /** When false, do not record this construction as the last loaded fixture. */
  readonly remember?: boolean;
}

export interface WorkbenchFixtureLoad {
  readonly fixtureId: string;
  readonly profileId: string;
  readonly kind: ResolvedWorkbenchFixture["kind"];
  readonly dynamic: boolean;
  readonly seed: number;
  readonly count: number;
  readonly materialSequence: readonly string[];
  readonly composition: WorkbenchSequenceComposition;
  readonly construction: readonly WorkbenchCuttingPlan[];
  readonly notes: string;
  readonly cameraView: "front";
}

let lastWorkbenchFixtureLoad: WorkbenchFixtureLoad | null = null;

export function getLastWorkbenchFixtureLoad(): WorkbenchFixtureLoad | null {
  return lastWorkbenchFixtureLoad;
}

export function clearLastWorkbenchFixtureLoad(): void {
  lastWorkbenchFixtureLoad = null;
}

export function fixtureLoadIdentitiesMatch(
  load: WorkbenchFixtureLoad,
  snapshot: ArrangementSnapshot,
): boolean {
  if (snapshot.plants.length !== load.construction.length) return false;
  for (const cutting of load.construction) {
    const plant = snapshot.plants.find((item) => item.id === cutting.plantId);
    if (!plant || plant.seed !== cutting.seed) return false;
    if (cutting.generatorVersion && plant.generatorVersion !== cutting.generatorVersion) return false;
  }
  return true;
}

/**
 * Explicit fixtures bypass seating only in the isolated developer bowl.
 * `mixed` is a compatibility alias for `reference-pair` and does not cycle the
 * live catalog. Named profiles and registered material IDs are the contract.
 */
export function createWorkbenchFixture(
  fixtureId: string,
  seed: number,
  count: number,
  options: CreateWorkbenchFixtureOptions = {},
): ArrangementSnapshot {
  const catalog = options.catalog ?? getMaterialDefinitions();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !isWorkbenchCount(count)) {
    throw new Error("Choose a uint32 seed and a supported cutting count.");
  }
  const resolved = resolveWorkbenchFixture(fixtureId, catalog);
  if (resolved.missingMaterialIds.length) {
    if (getWorkbenchFixtureProfile(fixtureId)) {
      throw new Error(
        `Fixture profile '${resolved.profileId}' requires unregistered material(s): ${resolved.missingMaterialIds.join(", ")}.`,
      );
    }
    throw new Error("Unknown fixture material or profile.");
  }
  if (!resolved.materialSequence.length) throw new Error("Fixture material sequence is empty.");

  const planned = planWorkbenchCuttings(resolved.materialSequence, seed, count);
  const construction = planned.map((cutting) => {
    const material = catalog.find((item) => item.materialId === cutting.materialId);
    if (!material) throw new Error(`Unknown fixture material: ${cutting.materialId}.`);
    const graph = material.generator.generate(cutting.plantId, cutting.seed, cutting.base);
    if (graph.generatorVersion !== material.generator.generatorVersion) throw new Error("Fixture generator version mismatch.");
    assertValidPlantGraph(graph);
    return { cutting: { ...cutting, generatorVersion: graph.generatorVersion }, graph: toCanonicalPlantGraph(graph) };
  });
  const snapshot: ArrangementSnapshot = {
    plants: construction.map((item) => item.graph).sort((a, b) => a.id.localeCompare(b.id)),
    successfulPlantOrdinal: count,
    camera: canonicalCameraPose("front"),
  };
  if (options.remember !== false) {
    lastWorkbenchFixtureLoad = {
      fixtureId,
      profileId: resolved.profileId,
      kind: resolved.kind,
      dynamic: resolved.dynamic,
      seed,
      count,
      materialSequence: resolved.materialSequence,
      composition: describeMaterialSequenceComposition(resolved.materialSequence, count),
      construction: construction.map((item) => item.cutting),
      notes: resolved.notes,
      cameraView: "front",
    };
  }
  return snapshot;
}

export function describeFixture(snapshot: ArrangementSnapshot) {
  const plants = snapshot.plants.map((plant) => ({
    id: plant.id,
    generatorVersion: plant.generatorVersion,
    seed: plant.seed,
    branches: plant.branches.length,
    organs: plant.organs.length,
    activeBranches: plant.branches.filter((branch) => branch.active).length,
    activeOrgans: plant.organs.filter((organ) => organ.active).length,
  }));
  const byGeneratorVersion: Record<string, number> = {};
  for (const plant of plants) {
    byGeneratorVersion[plant.generatorVersion] = (byGeneratorVersion[plant.generatorVersion] ?? 0) + 1;
  }
  return {
    successfulPlantOrdinal: snapshot.successfulPlantOrdinal,
    plants,
    plantsInIdentityOrder: [...plants].sort(comparePlantIdentity),
    byGeneratorVersion,
  };
}

function comparePlantIdentity(left: { id: string }, right: { id: string }): number {
  const leftOrdinal = plantIdentityOrdinal(left.id);
  const rightOrdinal = plantIdentityOrdinal(right.id);
  if (leftOrdinal !== rightOrdinal) return leftOrdinal - rightOrdinal;
  return left.id.localeCompare(right.id);
}

function plantIdentityOrdinal(id: string): number {
  const match = /^plant-([1-9]\d*)$/.exec(id);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export { listWorkbenchFixtureOptions as listWorkbenchFixturePickerOptions } from "./workbenchProfiles.ts";
