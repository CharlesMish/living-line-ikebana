// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { createFloweringBranch, createBerryTwig, serializePlantGraph, getMaterialDefinitions } from "../../src/core/index.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { C1_WARM_MINERAL_BERRY, C1_WARM_MINERAL_BLOOM, C1_WARM_MINERAL_RECIPE_ID } from "../../src/study/campaignPaletteRecipes.ts";
import { configureCampaignPaletteStudy, createCampaignPaletteSidecar, resetCampaignPaletteStudyForTest } from "../../src/study/campaignPaletteStudy.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

function activateC1(sidecarRaw: string | null = null) {
  configureCampaignPaletteStudy({
    flagEnabled: true,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: C1_WARM_MINERAL_RECIPE_ID,
    sidecarRaw,
  });
}

test("C1 recipe applies only when campaign flag is enabled", () => {
  resetCampaignPaletteStudyForTest();
  configureCampaignPaletteStudy({
    flagEnabled: false,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: C1_WARM_MINERAL_RECIPE_ID,
    sidecarRaw: null,
  });
  assert.equal(getMaterialAppearance("one-branch-v1").bloom.color, 0xe2a0a4);
  assert.equal(getMaterialAppearance("berry-twig-v1").berry?.color, 0xa63e56);

  activateC1();
  assert.equal(getMaterialAppearance("one-branch-v1").bloom.color, C1_WARM_MINERAL_BLOOM);
  assert.equal(getMaterialAppearance("berry-twig-v1").berry?.color, C1_WARM_MINERAL_BERRY);
});

test("C1 sidecar mismatches are refused and flag-absent sidecar is ignored", () => {
  resetCampaignPaletteStudyForTest();
  const good = createCampaignPaletteSidecar({
    studyRecipe: C1_WARM_MINERAL_RECIPE_ID,
    build: "campaign-01-c1",
  });
  configureCampaignPaletteStudy({
    flagEnabled: false,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: null,
    sidecarRaw: JSON.stringify(good),
  });
  assert.equal(getMaterialAppearance("single-flower-v1").bloom.color, 0xf0d2ae);

  const wrongBuild = createCampaignPaletteSidecar({
    studyRecipe: C1_WARM_MINERAL_RECIPE_ID,
    build: "other-build",
  });
  activateC1(JSON.stringify(wrongBuild));
  assert.equal(getMaterialAppearance("single-flower-v1").bloom.color, 0xf0d2ae);
});

test("C1 does not alter canonical graph bytes, catalog order, or hit/roughness fields", () => {
  const controlFlower = serializePlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  const controlBerry = serializePlantGraph(createBerryTwig("plant-1", 8278, BASE));
  const controlCatalog = getMaterialDefinitions().map((item) => item.materialId);
  const control = getMaterialAppearance("nodding-flower-v2");

  activateC1();

  assert.equal(serializePlantGraph(createFloweringBranch("plant-1", 8278, BASE)), controlFlower);
  assert.equal(serializePlantGraph(createBerryTwig("plant-1", 8278, BASE)), controlBerry);
  assert.deepEqual(getMaterialDefinitions().map((item) => item.materialId), controlCatalog);

  const c1 = getMaterialAppearance("nodding-flower-v2");
  assert.equal(c1.stemRoughness, control.stemRoughness);
  assert.equal(c1.bloom.hitRadius, control.bloom.hitRadius);
  assert.equal(c1.leaf.hitRadius, control.leaf.hitRadius);
  assert.equal(c1.branchColors.trunk, control.branchColors.trunk);
  assert.equal(c1.bloom.color, C1_WARM_MINERAL_BLOOM);
  assert.equal(c1.bloom.collarColor, C1_WARM_MINERAL_BLOOM);
});

