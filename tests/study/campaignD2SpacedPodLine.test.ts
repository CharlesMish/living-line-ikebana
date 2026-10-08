// @ts-nocheck
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  fromCanonicalPlantGraph,
  getMaterialDefinitions,
  isSupportedGeneratorVersion,
  prepareMaterialInsertion,
  toCanonicalPlantGraph,
} from "../../src/core/index.ts";
import { SPACED_POD_LINE_D2_VERSION } from "../../src/core/spacedPodLineD2.ts";
import {
  CAMPAIGN_D2_MATERIAL_ID,
  configureCampaignD2Runtime,
} from "../../src/study/campaignD2SpacedPodLine.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const CONTROL_MATERIAL_IDS = [
  "flowering-branch",
  "leafy-shoot",
  "bare-branch",
  "single-flower",
  "reed",
  "flower-volume",
  "arching-trailer",
  "foliage-fan",
  "blossom-spray",
  "nodding-flower",
  "berry-twig",
  "fern-frond",
];

function sha256(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

test("campaign D2 is fully opt-in: flag-absent catalog and generator support stay unchanged", () => {
  configureCampaignD2Runtime(false);
  assert.deepEqual(getMaterialDefinitions().map((definition) => definition.materialId), CONTROL_MATERIAL_IDS);
  assert.equal(isSupportedGeneratorVersion(SPACED_POD_LINE_D2_VERSION), false);
  assert.deepEqual(
    prepareMaterialInsertion(CAMPAIGN_D2_MATERIAL_ID, 1, BASE),
    { ok: false, reason: "unknown-material", materialId: CAMPAIGN_D2_MATERIAL_ID },
  );
});

test("campaign D2 material registers additively and deterministically when enabled", () => {
  configureCampaignD2Runtime(true);
  try {
    const ids = getMaterialDefinitions().map((definition) => definition.materialId);
    assert.deepEqual(ids.slice(0, CONTROL_MATERIAL_IDS.length), CONTROL_MATERIAL_IDS);
    assert.equal(ids[ids.length - 1], CAMPAIGN_D2_MATERIAL_ID);
    assert.equal(isSupportedGeneratorVersion(SPACED_POD_LINE_D2_VERSION), true);

    const first = prepareMaterialInsertion(CAMPAIGN_D2_MATERIAL_ID, 1, BASE);
    const second = prepareMaterialInsertion(CAMPAIGN_D2_MATERIAL_ID, 1, BASE);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(first.graph.generatorVersion, SPACED_POD_LINE_D2_VERSION);
    assert.equal(sha256(toCanonicalPlantGraph(first.graph)), sha256(toCanonicalPlantGraph(second.graph)));
    const berries = [...first.graph.organs.values()].filter((organ) => organ.kind === "berry");
    assert.ok(berries.length >= 3 && berries.length <= 6);
  } finally {
    configureCampaignD2Runtime(false);
  }
});

test("D2 save payload round-trips only when enabled and fail-closes when disabled", () => {
  configureCampaignD2Runtime(true);
  const prepared = prepareMaterialInsertion(CAMPAIGN_D2_MATERIAL_ID, 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const canonical = toCanonicalPlantGraph(prepared.graph);
  assert.equal(fromCanonicalPlantGraph(canonical).generatorVersion, SPACED_POD_LINE_D2_VERSION);

  configureCampaignD2Runtime(false);
  assert.throws(
    () => fromCanonicalPlantGraph(canonical),
    /Unsupported generatorVersion spaced-pod-line-d2-v1/,
  );
});

test("existing fixture canonical bytes are unchanged by campaign D2 enablement", () => {
  const fixtureF1 = JSON.parse(readFileSync(new URL("../../fixtures/plant-1-one-branch-v1.json", import.meta.url), "utf8"));
  const polish = JSON.parse(
    readFileSync(new URL("../fixtures/polish-baseline-arrangements.plants.json", import.meta.url), "utf8"),
  );
  const fixtureF2 = polish.arrangements.find((entry: { id: string }) => entry.id === "5a03717a-b69d-4be6-8c1a-d09a1474d8a5");
  assert.ok(fixtureF2);

  configureCampaignD2Runtime(false);
  const controlF1 = sha256(fixtureF1);
  const controlF2 = sha256(fixtureF2.plants);

  configureCampaignD2Runtime(true);
  try {
    assert.equal(sha256(fixtureF1), controlF1);
    assert.equal(sha256(fixtureF2.plants), controlF2);
  } finally {
    configureCampaignD2Runtime(false);
  }
});
