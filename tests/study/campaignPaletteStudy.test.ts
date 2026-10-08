// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  configureCampaignPaletteStudy,
  createCampaignPaletteSidecar,
  getCampaignPaletteStudyState,
  registerCampaignPaletteRecipe,
  resetCampaignPaletteStudyForTest,
  resolveCampaignPaletteAppearance,
} from "../../src/study/campaignPaletteStudy.ts";

test("flag absent refuses sidecar activation", () => {
  resetCampaignPaletteStudyForTest();
  registerCampaignPaletteRecipe("test-recipe", (base) => ({ ...base, value: "changed" }));
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: "test-recipe",
    build: "campaign-01-c1",
  });
  const state = configureCampaignPaletteStudy({
    flagEnabled: false,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: null,
    sidecarRaw: JSON.stringify(sidecar),
  });
  assert.equal(state.activeRecipeId, null);
  assert.equal(state.reason, "flag-required");
  assert.equal(resolveCampaignPaletteAppearance("any", { value: "base" }).value, "base");
});

test("sidecar build mismatch is refused", () => {
  resetCampaignPaletteStudyForTest();
  registerCampaignPaletteRecipe("test-recipe", (base) => ({ ...base, value: "changed" }));
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: "test-recipe",
    build: "wrong-build",
  });
  const state = configureCampaignPaletteStudy({
    flagEnabled: true,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: null,
    sidecarRaw: JSON.stringify(sidecar),
  });
  assert.equal(state.activeRecipeId, null);
  assert.equal(state.reason, "sidecar-build-mismatch");
});

test("unregistered recipes stay inactive by default", () => {
  resetCampaignPaletteStudyForTest();
  const state = configureCampaignPaletteStudy({
    flagEnabled: true,
    expectedBuild: "campaign-01-c1",
    defaultRecipeId: "c1-warm-mineral",
    sidecarRaw: null,
  });
  assert.equal(state.activeRecipeId, null);
  assert.equal(state.reason, "recipe-unregistered");
  const snapshot = getCampaignPaletteStudyState();
  assert.equal(snapshot.activeRecipeId, null);
});

