// @ts-nocheck
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  deserializePlantGraph,
  fromCanonicalPlantGraph,
  getMaterialDefinitions,
  isSupportedGeneratorVersion,
  prepareMaterialInsertion,
  toCanonicalPlantGraph,
} from "../../src/core/index.ts";
import {
  CAMPAIGN_D1_MATERIAL_ID,
  configureCampaignD1Runtime,
} from "../../src/study/campaignD1PairedLeaf.ts";
import { PAIRED_LEAF_D1_VERSION } from "../../src/core/pairedLeafD1.ts";

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

test("campaign D1 is fully opt-in: flag-absent catalog and generator support stay unchanged", () => {
  configureCampaignD1Runtime(false);
  assert.deepEqual(getMaterialDefinitions().map((definition) => definition.materialId), CONTROL_MATERIAL_IDS);
  assert.equal(isSupportedGeneratorVersion(PAIRED_LEAF_D1_VERSION), false);
  assert.deepEqual(
    prepareMaterialInsertion(CAMPAIGN_D1_MATERIAL_ID, 1, BASE),
    { ok: false, reason: "unknown-material", materialId: CAMPAIGN_D1_MATERIAL_ID },
  );
});

test("campaign D1 material registers additively and deterministically when enabled", () => {
  configureCampaignD1Runtime(true);
  try {
    const ids = getMaterialDefinitions().map((definition) => definition.materialId);
    assert.deepEqual(ids.slice(0, CONTROL_MATERIAL_IDS.length), CONTROL_MATERIAL_IDS);
    assert.equal(ids[ids.length - 1], CAMPAIGN_D1_MATERIAL_ID);
    assert.equal(isSupportedGeneratorVersion(PAIRED_LEAF_D1_VERSION), true);

    const left = prepareMaterialInsertion(CAMPAIGN_D1_MATERIAL_ID, 1, BASE);
    const right = prepareMaterialInsertion(CAMPAIGN_D1_MATERIAL_ID, 1, BASE);
    assert.equal(left.ok, true);
    assert.equal(right.ok, true);
    if (!left.ok || !right.ok) return;
    assert.equal(left.graph.generatorVersion, PAIRED_LEAF_D1_VERSION);
    assert.equal(sha256(toCanonicalPlantGraph(left.graph)), sha256(toCanonicalPlantGraph(right.graph)));
    const leafOrgans = [...left.graph.organs.values()].filter((organ) => organ.kind === "leaf");
    assert.equal(leafOrgans.length, 8);
    assert.equal(left.graph.organs.size, 8);
  } finally {
    configureCampaignD1Runtime(false);
  }
});

test("D1 save payload round-trips only when enabled and fail-closes when disabled", () => {
  configureCampaignD1Runtime(true);
  const prepared = prepareMaterialInsertion(CAMPAIGN_D1_MATERIAL_ID, 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const canonical = toCanonicalPlantGraph(prepared.graph);
  const synthetic = {
    storageVersion: 1,
    nextSuccessfulOrdinal: 2,
    plants: [canonical],
  };
  assert.equal(fromCanonicalPlantGraph(synthetic.plants[0]).generatorVersion, PAIRED_LEAF_D1_VERSION);
  assert.equal(deserializePlantGraph(JSON.stringify(canonical)).generatorVersion, PAIRED_LEAF_D1_VERSION);

  configureCampaignD1Runtime(false);
  assert.throws(
    () => fromCanonicalPlantGraph(synthetic.plants[0]),
    /Unsupported generatorVersion paired-leaf-d1-v1/,
  );
});

test("existing fixture canonical bytes are unchanged by campaign D1 enablement", () => {
  const fixtureF1 = JSON.parse(readFileSync(new URL("../../fixtures/plant-1-one-branch-v1.json", import.meta.url), "utf8"));
  const polish = JSON.parse(
    readFileSync(new URL("../fixtures/polish-baseline-arrangements.plants.json", import.meta.url), "utf8"),
  );
  const fixtureF2 = polish.arrangements.find((entry: { id: string }) => entry.id === "5a03717a-b69d-4be6-8c1a-d09a1474d8a5");
  assert.ok(fixtureF2);

  configureCampaignD1Runtime(false);
  const controlF1 = sha256(fixtureF1);
  const controlF2 = sha256(fixtureF2.plants);

  configureCampaignD1Runtime(true);
  try {
    assert.equal(sha256(fixtureF1), controlF1);
    assert.equal(sha256(fixtureF2.plants), controlF2);
  } finally {
    configureCampaignD1Runtime(false);
  }
});
