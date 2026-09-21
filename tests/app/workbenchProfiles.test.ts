import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchArrangement, createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  createWorkbenchProfileFixture,
  materialsForWorkbenchProfile,
  WORKBENCH_FIXTURE_PROFILE_IDS,
} from "../../src/app/workbenchProfiles.ts";

test("named workbench profile IDs are stable and reference-pair preserves two-material mixed graphs", () => {
  assert.deepEqual(WORKBENCH_FIXTURE_PROFILE_IDS, [
    "reference-pair",
    "references-plus-bare",
    "references-plus-single-flower",
    "all-four",
    "all-registered-materials",
  ]);
  assert.deepEqual(materialsForWorkbenchProfile("reference-pair"), ["flowering-branch", "leafy-shoot"]);
  const pair = createWorkbenchProfileFixture("reference-pair", 8278, 6);
  const twoMaterialMixed = createWorkbenchArrangement(["flowering-branch", "leafy-shoot"], 8278, 6);
  assert.deepEqual(pair, twoMaterialMixed);
  assert.deepEqual(pair.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1",
    "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const currentMixed = createWorkbenchFixture("mixed", 8278, 6);
  assert.notDeepEqual(currentMixed.plants.map((plant) => plant.generatorVersion), pair.plants.map((plant) => plant.generatorVersion));
  assert.deepEqual(createWorkbenchProfileFixture("all-four", 8278, 4).plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1",
  ]);
  assert.throws(() => materialsForWorkbenchProfile("not-a-profile"));
});
