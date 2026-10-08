// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { SceneCommittedStore } from "../../src/app/scenePersistence.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { prepareMaterialInsertion, toCanonicalPlantGraph } from "../../src/core/index.ts";
import {
  CAMPAIGN_D1_MATERIAL_ID,
  configureCampaignD1Runtime,
} from "../../src/study/campaignD1PairedLeaf.ts";

function memoryStorage(seed: Record<string, string>) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

function makeSavedStudioRaw() {
  configureCampaignD1Runtime(true);
  const prepared = prepareMaterialInsertion(CAMPAIGN_D1_MATERIAL_ID, 1, { x: 0, y: 0.55, z: 0 });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) throw new Error("paired-leaf preparation failed");
  const value = {
    storageVersion: 2,
    savedAt: "2026-10-08T00:00:00.000Z",
    nextSuccessfulOrdinal: 2,
    plants: [toCanonicalPlantGraph(prepared.graph)],
    camera: canonicalCameraPose("front"),
    scene: { ...DEFAULT_SCENE },
  };
  return JSON.stringify(value);
}

function loadWithOrder(order: "old-order" | "fixed-order") {
  const key = "ikebana-web-alpha:studio-v2";
  const raw = makeSavedStudioRaw();
  const store = new SceneCommittedStore(
    key,
    undefined,
    () => ({
      scene: { ...DEFAULT_SCENE },
      camera: canonicalCameraPose("front"),
    }),
    memoryStorage({ [key]: raw }) as never,
  );
  configureCampaignD1Runtime(false);
  if (order === "old-order") {
    const loaded = store.load();
    configureCampaignD1Runtime(true);
    return { loaded, error: store.error };
  }
  configureCampaignD1Runtime(true);
  return { loaded: store.load(), error: store.error };
}

test("old startup ordering reproduces the D1 load failure", () => {
  const result = loadWithOrder("old-order");
  assert.equal(result.loaded, null);
  assert.equal(result.error, true);
});

test("fixed startup ordering loads the same D1 bytes under campaignD1=1", () => {
  const forceOldOrder = process.env.D1_STARTUP_ORDER_EXPECT_SUCCESS === "old-order";
  const result = loadWithOrder(forceOldOrder ? "old-order" : "fixed-order");
  assert.equal(result.error, false);
  assert.ok(result.loaded);
  assert.equal(result.loaded?.plants[0]?.generatorVersion, "paired-leaf-d1-v1");
});
