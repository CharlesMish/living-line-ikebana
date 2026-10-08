// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { CAMPAIGN_B2_MATERIAL_ID, campaignB2Enabled } from "../../src/app/campaignB2.ts";
import { toCanonicalPlantGraph } from "../../src/core/index.ts";

test("campaignB2 flag parser is opt-in and fail-closed", () => {
  assert.equal(campaignB2Enabled(new URL("https://example.test/")), false);
  assert.equal(campaignB2Enabled(new URL("https://example.test/?campaignB2=0")), false);
  assert.equal(campaignB2Enabled(new URL("https://example.test/?campaignB2=1")), true);
});

test("campaignB2 material prepares only when the flag is enabled", () => {
  const disabled = prepareMaterialInsertionForApp(CAMPAIGN_B2_MATERIAL_ID, 0);
  assert.deepEqual(disabled, {
    ok: false,
    reason: "unknown-material",
    materialId: CAMPAIGN_B2_MATERIAL_ID,
  });

  const enabled = prepareMaterialInsertionForApp(CAMPAIGN_B2_MATERIAL_ID, 0, { campaignB2: true });
  assert.equal(enabled.ok, true);
  if (!enabled.ok) return;
  assert.equal(enabled.graph.generatorVersion, "reed-fine-b2-v1");
  assert.equal(enabled.graph.id, "plant-1");
  assert.equal(enabled.seed, 8278);
  const branch = enabled.graph.branches.get(enabled.graph.rootBranchId)!;
  assert.equal(branch.radius, 0.0192);
});

test("campaignB2 insertion does not mutate the default catalog behavior", () => {
  const defaultReed = prepareMaterialInsertionForApp("reed", 0);
  const flaggedReed = prepareMaterialInsertionForApp("reed", 0, { campaignB2: true });
  assert.equal(defaultReed.ok, true);
  assert.equal(flaggedReed.ok, true);
  if (!defaultReed.ok || !flaggedReed.ok) return;
  assert.deepEqual(toCanonicalPlantGraph(defaultReed.graph), toCanonicalPlantGraph(flaggedReed.graph));
});
