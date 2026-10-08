// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import {
  configureCampaignPaletteStudy,
  createCampaignPaletteSidecar,
  registerCampaignPaletteRecipe,
  resetCampaignPaletteStudyForTest,
} from "../../src/study/campaignPaletteStudy.ts";

test("flag-absent appearance stays byte-identical to control values", () => {
  resetCampaignPaletteStudyForTest();
  registerCampaignPaletteRecipe("test-recipe", (base) => ({
    ...base,
    bloom: { ...base.bloom, color: 0x010203 },
    berry: base.berry ? { ...base.berry, color: 0x040506 } : undefined,
  }));
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: "test-recipe",
    build: "campaign-01-c1",
  });
  configureCampaignPaletteStudy({
    flagEnabled: false,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: "test-recipe",
    sidecarRaw: JSON.stringify(sidecar),
  });

  assert.equal(getMaterialAppearance("one-branch-v1").bloom.color, 0xe2a0a4);
  assert.equal(getMaterialAppearance("single-flower-v1").bloom.color, 0xf0d2ae);
  assert.equal(getMaterialAppearance("berry-twig-v1").berry?.color, 0xa63e56);
});

