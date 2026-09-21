import { getMaterialDefinitions } from "../core/index.ts";
import type { ArrangementSnapshot } from "./garden.ts";
import { createWorkbenchArrangement } from "./workbench.ts";

/**
 * Stable named comparison profiles for the material workbench.
 *
 * Expected Workbench-agent import path: `src/app/workbenchProfiles.ts`.
 * This Round 2 stub owns IDs and material lists only. Named fixture graph DATA,
 * report metadata and focused profile tests belong on the Workbench agent's
 * branch. When that DATA lands, replace `createWorkbenchProfileFixture` to load
 * it; do not change these IDs when the catalog grows.
 */
export const WORKBENCH_FIXTURE_PROFILE_IDS = [
  "reference-pair",
  "references-plus-bare",
  "references-plus-single-flower",
  "all-four",
  "all-registered-materials",
] as const;

export type WorkbenchFixtureProfileId = typeof WORKBENCH_FIXTURE_PROFILE_IDS[number];

export const WORKBENCH_FIXTURE_PROFILE_LABELS: Readonly<Record<WorkbenchFixtureProfileId, string>> = Object.freeze({
  "reference-pair": "reference-pair · flowering + leafy",
  "references-plus-bare": "references-plus-bare",
  "references-plus-single-flower": "references-plus-single-flower",
  "all-four": "all-four",
  "all-registered-materials": "all-registered-materials (dynamic)",
});

export function isWorkbenchFixtureProfileId(value: string): value is WorkbenchFixtureProfileId {
  return (WORKBENCH_FIXTURE_PROFILE_IDS as readonly string[]).includes(value);
}

/** Material IDs cycled by a named profile. Catalog growth must not change these IDs. */
export function materialsForWorkbenchProfile(profileId: string): readonly string[] {
  if (!isWorkbenchFixtureProfileId(profileId)) throw new Error("Unknown workbench profile.");
  switch (profileId) {
    case "reference-pair":
      return ["flowering-branch", "leafy-shoot"];
    case "references-plus-bare":
      return ["flowering-branch", "leafy-shoot", "bare-branch"];
    case "references-plus-single-flower":
      return ["flowering-branch", "leafy-shoot", "single-flower"];
    case "all-four":
      return ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower"];
    case "all-registered-materials":
      return getMaterialDefinitions().map((material) => material.materialId);
  }
}

/**
 * Generates a named comparison bowl with the same spiral, seeds and plant IDs
 * as `createWorkbenchFixture`. `reference-pair` preserves the two-reference
 * mixed graphs. Swap this helper for named DATA when the Workbench agent lands it.
 */
export function createWorkbenchProfileFixture(
  profileId: string,
  seed: number,
  count: number,
): ArrangementSnapshot {
  return createWorkbenchArrangement(materialsForWorkbenchProfile(profileId), seed, count);
}
