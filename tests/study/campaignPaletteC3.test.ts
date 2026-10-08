// @ts-nocheck
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fromCanonicalPlantGraph, toCanonicalPlantGraph, type CanonicalPlantGraph } from "../../src/core/index.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { configureCampaignPaletteStudy, createCampaignPaletteSidecar, resetCampaignPaletteStudyForTest } from "../../src/study/campaignPaletteStudy.ts";
import {
  C3_INK_CITRUS_BLOOM,
  C3_INK_CITRUS_BERRY,
  C3_INK_CITRUS_LEAF,
  C3_INK_CITRUS_RECIPE_ID,
  C3_INK_CITRUS_STEM,
  C3_INK_CITRUS_VEIN,
} from "../../src/study/campaignPaletteRecipes.ts";

const CAMPAIGN_PALETTE_EXPECTED_BUILD = "campaign-01-c3";

function canonicalHash(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function configureC3(flagEnabled: boolean, sidecarRaw: string | null = null) {
  return configureCampaignPaletteStudy({
    flagEnabled,
    expectedBuild: CAMPAIGN_PALETTE_EXPECTED_BUILD,
    defaultRecipeId: flagEnabled ? C3_INK_CITRUS_RECIPE_ID : null,
    sidecarRaw,
  });
}

test("campaign C3 recipe applies only when campaignC3 flag is enabled", () => {
  resetCampaignPaletteStudyForTest();
  configureC3(false);
  const control = getMaterialAppearance("one-branch-v1");
  assert.equal(control.branchColors.trunk, 0x4e3529);
  assert.equal(control.leaf.color, 0x56755a);
  assert.equal(control.bloom.color, 0xe2a0a4);

  configureC3(true);
  const c3 = getMaterialAppearance("one-branch-v1");
  assert.equal(c3.branchColors.trunk, C3_INK_CITRUS_STEM);
  assert.equal(c3.branchColors.lateral, C3_INK_CITRUS_STEM);
  assert.equal(c3.branchColors.twig, C3_INK_CITRUS_STEM);
  // Structural-only rule: supporting stalk classes are unchanged.
  assert.equal(c3.branchColors.pedicel, control.branchColors.pedicel);
  assert.equal(c3.branchColors.petiole, control.branchColors.petiole);
  assert.equal(c3.leaf.color, C3_INK_CITRUS_LEAF);
  assert.equal(c3.leaf.veinColor, C3_INK_CITRUS_VEIN);
  assert.equal(c3.bloom.color, C3_INK_CITRUS_BLOOM);
});

test("nodding-flower-v2 bloom collar follows bloom color while calyx path remains independent", () => {
  resetCampaignPaletteStudyForTest();
  configureC3(true);
  const c3 = getMaterialAppearance("nodding-flower-v2");
  assert.equal(c3.bloom.color, C3_INK_CITRUS_BLOOM);
  assert.equal(c3.bloom.collarColor, C3_INK_CITRUS_BLOOM);
});

test("berry palette is recolored only for berry-bearing generators", () => {
  resetCampaignPaletteStudyForTest();
  configureC3(true);
  assert.equal(getMaterialAppearance("berry-twig-v1").berry?.color, C3_INK_CITRUS_BERRY);
  assert.equal(getMaterialAppearance("one-branch-v1").berry, undefined);
});

test("flag-absent mode ignores sidecar recipe payload", () => {
  resetCampaignPaletteStudyForTest();
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: C3_INK_CITRUS_RECIPE_ID,
    build: CAMPAIGN_PALETTE_EXPECTED_BUILD,
  });
  const state = configureC3(false, JSON.stringify(sidecar));
  assert.equal(state.reason, "flag-required");
  assert.equal(state.activeRecipeId, null);
  assert.equal(getMaterialAppearance("one-branch-v1").bloom.color, 0xe2a0a4);
});

test("sidecar build mismatch is refused fail-closed", () => {
  resetCampaignPaletteStudyForTest();
  const sidecar = createCampaignPaletteSidecar({
    studyRecipe: C3_INK_CITRUS_RECIPE_ID,
    build: "campaign-01-c2",
  });
  const state = configureC3(true, JSON.stringify(sidecar));
  assert.equal(state.reason, "sidecar-build-mismatch");
  assert.equal(state.activeRecipeId, null);
});

test("canonical graph bytes are unchanged for fixture F1 and fixture F2 arrangement", () => {
  resetCampaignPaletteStudyForTest();
  configureC3(false);
  const fixtureF1 = JSON.parse(readFileSync(new URL("../../fixtures/plant-1-one-branch-v1.json", import.meta.url), "utf8"));
  const polish = JSON.parse(
    readFileSync(new URL("../fixtures/polish-baseline-arrangements.plants.json", import.meta.url), "utf8"),
  );
  const fixtureF2 = polish.arrangements.find((entry: { id: string }) => entry.id === "5a03717a-b69d-4be6-8c1a-d09a1474d8a5");
  assert.ok(fixtureF2, "fixture F2 arrangement must exist");

  const f1HashControl = canonicalHash(fixtureF1);
  const f2HashControl = canonicalHash(fixtureF2.plants);

  configureC3(true);
  const f1RoundTrip = toCanonicalPlantGraph(fromCanonicalPlantGraph(fixtureF1 as CanonicalPlantGraph));
  const f2RoundTrip = fixtureF2.plants.map((plant: CanonicalPlantGraph) =>
    toCanonicalPlantGraph(fromCanonicalPlantGraph(plant)));

  assert.equal(canonicalHash(f1RoundTrip), f1HashControl);
  assert.equal(canonicalHash(f2RoundTrip), f2HashControl);
});
