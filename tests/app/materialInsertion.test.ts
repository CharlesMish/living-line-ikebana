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
  clonePlantGraph,
} from "../../src/core/index.ts";
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
