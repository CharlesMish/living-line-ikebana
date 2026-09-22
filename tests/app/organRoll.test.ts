import assert from "node:assert/strict";
import test from "node:test";

import { canonicalCameraPose } from "../../src/app/camera.ts";
import { readExperimentConfig } from "../../src/app/config.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { createSingleFlower } from "../../src/core/singleFlower.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";

test("organ roll flag is off unless the experiment entry point is set", () => {
  assert.equal(readExperimentConfig(new URL("http://studio.local/")).organRoll, false);
  assert.equal(readExperimentConfig(new URL("http://studio.local/?experiment=organ-roll")).organRoll, true);
  assert.equal(readExperimentConfig(new URL("http://studio.local/?experiment=something-else")).organRoll, false);
});

test("a roll transaction commits bloom spin from the snapshot and cancel restores it", () => {
  const graph = createSingleFlower("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const bloom = graph.organs.get("plant-1:bloom")!;
  const stemPoints = graph.branches.get(graph.rootBranchId)!.points.map((point) => ({ ...point }));
  const pedicelPoints = graph.branches.get(bloom.branchId)!.points.map((point) => ({ ...point }));
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: [[graph.id, graph]],
    camera: canonicalCameraPose("front"),
    selectedPlantId: graph.id,
    successfulPlantOrdinal: 1,
  });

  assert.equal(coordinator.beginRoll(1, {
    plantId: graph.id,
    organId: bloom.id,
    context: {},
  }, { deltaRadians: 0.25 }).ok, true);
  coordinator.updateRoll(1, { deltaRadians: 0.55 });
  coordinator.updateRoll(1, { deltaRadians: 0.2 });
  const preview = coordinator.getPresentationState().active;
  assert.equal(preview?.kind, "roll");
  if (preview?.kind !== "roll") return;
  assert.equal(preview.graph.organs.get(bloom.id)!.spin, bloom.spin + 0.2);
  assert.deepEqual(preview.graph.branches.get(graph.rootBranchId)!.points, stemPoints);

  assert.equal(coordinator.cancel(1, "explicit-cancel").ok, true);
  assert.equal(coordinator.getDocumentSnapshot().plants.get(graph.id)!.organs.get(bloom.id)!.spin, bloom.spin);

  coordinator.beginRoll(1, { plantId: graph.id, organId: bloom.id, context: {} }, { deltaRadians: 0 });
  coordinator.updateRoll(1, { deltaRadians: 0.35 });
  assert.equal(coordinator.release(1).ok, true);
  const committed = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  assert.equal(committed.organs.get(bloom.id)!.spin, bloom.spin + 0.35);
  assert.deepEqual(committed.branches.get(graph.rootBranchId)!.points, stemPoints);
  assert.deepEqual(committed.branches.get(bloom.branchId)!.points, pedicelPoints);
  assert.equal(committed.organs.get("plant-1:leaf-1")!.spin, graph.organs.get("plant-1:leaf-1")!.spin);
});
