// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  createBerryTwig,
  createFloweringBranch,
  getMaterialDefinitions,
  serializePlantGraph,
} from "../../src/core/index.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import {
  C2_COOL_CHALK_BERRY,
  C2_COOL_CHALK_BLOOM,
  C2_COOL_CHALK_LEAF,
  C2_COOL_CHALK_RECIPE_ID,
} from "../../src/study/campaignPaletteRecipes.ts";
import {
  configureCampaignPaletteStudy,
  createCampaignPaletteSidecar,
  resetCampaignPaletteStudyForTest,
} from "../../src/study/campaignPaletteStudy.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const BUILD = "campaign-01-c2";

function activateC2(sidecarRaw: string | null = null) {
  configureCampaignPaletteStudy({
    flagEnabled: true,
    expectedBuild: BUILD,
    defaultRecipeId: C2_COOL_CHALK_RECIPE_ID,
    sidecarRaw,
  });
}

test("C2 recipe is opt-in: flag absent stays control and ignores sidecar", () => {
  resetCampaignPaletteStudyForTest();
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: C2_COOL_CHALK_RECIPE_ID,
    build: BUILD,
  });
  configureCampaignPaletteStudy({
    flagEnabled: false,
    expectedBuild: BUILD,
    defaultRecipeId: C2_COOL_CHALK_RECIPE_ID,
    sidecarRaw: JSON.stringify(sidecar),
  });

  const flowering = getMaterialAppearance("one-branch-v1");
  const berryTwig = getMaterialAppearance("berry-twig-v1");
  assert.equal(flowering.bloom.color, 0xe2a0a4);
  assert.equal(flowering.leaf.color, 0x56755a);
  assert.equal(berryTwig.berry?.color, 0xa63e56);
});

test("C2 sidecar mismatched build is refused", () => {
  resetCampaignPaletteStudyForTest();
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: C2_COOL_CHALK_RECIPE_ID,
    build: "wrong-build",
  });
  activateC2(JSON.stringify(sidecar));

  const single = getMaterialAppearance("single-flower-v1");
  assert.equal(single.bloom.color, 0xf0d2ae);
  assert.equal(single.leaf.color, 0x4d6848);
});

test("C2 changes bloom + berry + leaf color only; stem/vein/roughness/hits stay unchanged", () => {
  resetCampaignPaletteStudyForTest();
  const control = getMaterialAppearance("nodding-flower-v2");
  const controlBerry = getMaterialAppearance("berry-twig-v1");
  activateC2();
  const c2 = getMaterialAppearance("nodding-flower-v2");
  const c2Berry = getMaterialAppearance("berry-twig-v1");

  assert.equal(c2.leaf.color, C2_COOL_CHALK_LEAF);
  assert.equal(c2.bloom.color, C2_COOL_CHALK_BLOOM);
  assert.equal(c2.bloom.collarColor, C2_COOL_CHALK_BLOOM);
  assert.equal(c2Berry.berry?.color, C2_COOL_CHALK_BERRY);

  assert.equal(c2.branchColors.trunk, control.branchColors.trunk);
  assert.equal(c2.leaf.veinColor, control.leaf.veinColor);
  assert.equal(c2.leaf.hitRadius, control.leaf.hitRadius);
  assert.equal(c2.bloom.hitRadius, control.bloom.hitRadius);
  assert.equal(c2.stemRoughness, control.stemRoughness);
  assert.equal(c2Berry.leaf.veinColor, controlBerry.leaf.veinColor);
});

test("C2 keeps graph bytes and default catalog identity unchanged", () => {
  resetCampaignPaletteStudyForTest();
  const flowerControl = serializePlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  const berryControl = serializePlantGraph(createBerryTwig("plant-1", 8278, BASE));
  const catalog = getMaterialDefinitions().map((item) => item.materialId);
  activateC2();
  assert.equal(serializePlantGraph(createFloweringBranch("plant-1", 8278, BASE)), flowerControl);
  assert.equal(serializePlantGraph(createBerryTwig("plant-1", 8278, BASE)), berryControl);
  assert.deepEqual(getMaterialDefinitions().map((item) => item.materialId), catalog);
});

