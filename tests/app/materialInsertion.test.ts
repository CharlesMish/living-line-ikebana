// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalCameraPose } from "../../src/app/camera.ts";
import {
  prepareMaterialInsertionForApp,
  selectedBranchIdForSeatedGraph,
} from "../../src/app/materialInsertion.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import {
  clonePlantGraph, toCanonicalPlantGraph, validatePlantGraph,
} from "../../src/core/index.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

function reservationFrom(prepared) {
  return {
    ordinal: prepared.ordinal,
    plantId: prepared.plantId,
    seed: prepared.seed,
    graph: prepared.graph,
  };
}

test("production app adapter keeps invalid, cancelled, and unknown material insertions uncommitted", () => {
  const saves = [];
  const coordinator = new TransactionCoordinator(
    createDomainAdapters(),
    {
      plants: new Map(),
      camera: canonicalCameraPose("front"),
      selectedPlantId: null,
      successfulPlantOrdinal: 0,
    },
    { onAutosave: (event) => saves.push(event) },
  );

  const unknown = prepareMaterialInsertionForApp("unknown-material", 0);
  assert.deepEqual(unknown, {
    ok: false,
    reason: "unknown-material",
    materialId: "unknown-material",
  });
  assert.equal(coordinator.getDebugState().active, null);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  const prepared = prepareMaterialInsertionForApp("flowering-branch", 0);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  assert.deepEqual(
    coordinator.beginInsert(
      "invalid",
      reservationFrom(prepared),
      {},
      { base: BASE, valid: false },
    ),
    { ok: true },
  );
  const pending = coordinator.getPresentationState().active;
  assert.equal(pending?.kind, "insert");
  if (pending?.kind === "insert") {
    assert.equal("materialId" in pending.graph, false);
  }
  assert.deepEqual(coordinator.release("invalid"), { ok: true });
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  assert.deepEqual(
    coordinator.beginInsert(
      "cancelled",
      reservationFrom(prepared),
      {},
      { base: BASE, valid: true },
    ),
    { ok: true },
  );
  assert.deepEqual(coordinator.pointerCancel("cancelled"), { ok: true });
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  const malformedGraph = clonePlantGraph(prepared.graph);
  malformedGraph.branches.get(malformedGraph.rootBranchId).active = false;
  assert.equal(malformedGraph.generatorVersion, "one-branch-v1");
  assert.deepEqual(
    coordinator.beginInsert(
      "malformed",
      { ...reservationFrom(prepared), graph: malformedGraph },
      {},
      { base: BASE, valid: true },
    ),
    { ok: false, reason: "invalid-reservation" },
  );
  assert.equal(coordinator.getDebugState().active, null);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);
});

test("shared material preparation resolves exact catalog IDs and selection follows the declared root", () => {
  // These two calls model the common preparation invoked by pointer drag and
  // keyboard activation in IkebanaApp; neither accepts a caller-supplied generator.
  const pointerPreparation = prepareMaterialInsertionForApp("flowering-branch", 0);
  const keyboardPreparation = prepareMaterialInsertionForApp("flowering-branch", 0);
  assert.equal(pointerPreparation.ok, true);
  assert.equal(keyboardPreparation.ok, true);
  if (!pointerPreparation.ok || !keyboardPreparation.ok) return;

  assert.equal(pointerPreparation.plantId, "plant-1");
  assert.equal(pointerPreparation.seed, 8278);
  assert.equal(keyboardPreparation.graph.generatorVersion, "one-branch-v1");

  const declaredRoot = { rootBranchId: "plant-1:declared-root" };
  assert.equal(
    selectedBranchIdForSeatedGraph(declaredRoot),
    "plant-1:declared-root",
  );

  const unknown = prepareMaterialInsertionForApp("flowering-branch ", 0);
  assert.deepEqual(unknown, {
    ok: false,
    reason: "unknown-material",
    materialId: "flowering-branch ",
  });
});

test("mixed materials share successful ordinals and cancelled leafy ghosts never enter saves", () => {
  const saves = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"),
    selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: event => saves.push(event) });
  const flower = prepareMaterialInsertionForApp("flowering-branch", 0);
  assert.ok(flower.ok);
  coordinator.beginInsert("flower", reservationFrom(flower), {}, { base: { ...BASE, x: -0.45 }, valid: true });
  coordinator.release("flower");
  const flowerBefore = coordinator.getDocumentSnapshot().plants.get("plant-1");
  const shoot = prepareMaterialInsertionForApp("leafy-shoot", 1);
  assert.ok(shoot.ok);
  assert.equal(shoot.seed, 9255);
  coordinator.beginInsert("shoot-cancel", reservationFrom(shoot), {}, { base: BASE, valid: true });
  coordinator.pointerCancel("shoot-cancel");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 1);
  coordinator.beginInsert("shoot", reservationFrom(shoot), {}, { base: { ...BASE, x: 0.45 }, valid: true });
  coordinator.release("shoot");
  const document = coordinator.getDocumentSnapshot();
  assert.equal(document.plants.size, 2);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 2);
  assert.equal(saves.length, 2);
  assert.deepEqual(document.plants.get("plant-1"), flowerBefore);
  assert.equal(document.plants.get("plant-2").generatorVersion, "leafy-shoot-v1");
  const root = document.plants.get("plant-2").branches.get("plant-2:stem");
  const bendCandidate = {
    plantId: "plant-2", branchId: root.id, beadStationDistance: root.activeLength * 0.54,
    touchMaterialDistance: root.activeLength * 0.54, context: {},
  };
  assert.deepEqual(coordinator.beginBend("bend-cancel", bendCandidate, { target: { x: 1.5, y: 3, z: 0.4 } }), { ok: true });
  coordinator.pointerCancel("bend-cancel");
  assert.deepEqual(coordinator.getDocumentSnapshot().plants, document.plants);
  assert.equal(saves.length, 2);
  coordinator.beginBend("bend", bendCandidate, { target: { x: 1.5, y: 3, z: 0.4 } });
  coordinator.release("bend");
  coordinator.commandTool("prune");
  const cutSpec = { plantId: "plant-2", branchId: root.id, acquiredMaterialDistance: 3, context: {} };
  coordinator.beginPrune("prune-cancel", cutSpec, { distance: 3 });
  coordinator.pointerCancel("prune-cancel");
  assert.equal(saves.length, 3);
  coordinator.beginPrune("prune", cutSpec, { distance: 3 });
  coordinator.release("prune");
  const edited = coordinator.getDocumentSnapshot();
  assert.deepEqual(edited.plants.get("plant-1"), flowerBefore);
  assert.equal(saves.length, 4);
  const payload = JSON.parse(JSON.stringify({
    storageVersion: 1, nextSuccessfulOrdinal: 3,
    plants: [...edited.plants.values()].map(toCanonicalPlantGraph),
  }));
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    config: { fresh: false }, store: { load: () => payload },
  });
  const loaded = app.loadInitialDocument();
  assert.equal(app.restored, true);
  assert.equal(app.loadWarning, undefined);
  assert.equal(loaded.successfulPlantOrdinal, 2);
  for (const graph of loaded.plants.values()) assert.deepEqual(validatePlantGraph(graph), []);
  assert.deepEqual([...loaded.plants.values()].map(toCanonicalPlantGraph), payload.plants);

});
