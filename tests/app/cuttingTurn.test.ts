import assert from "node:assert/strict";
import test from "node:test";
import { turnCutting } from "../../src/core/turnCutting.ts";
import { StemPrevention } from "../../src/app/stemPrevention.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { contactEnvironment, insertionContacts } from "../../src/core/stemContact.ts";
import { serializePlantGraph, createFloweringBranch } from "../../src/core/index.ts";
import { stem } from "../fixtures/stemOverlapFixture.ts";
import { vec3 as p } from "../../src/core/math.ts";
import { assertRestLengthsPreserved } from "../core/helpers.ts";

const angle = Math.PI / 12;
const create = () => createFloweringBranch("plant-1", 8278, p(.2, .55, -.1));
test("turn prewrites once, preserves camera/ordinal and Undo restores the exact canonical graph", () => {
  const graph = create(), camera = canonicalCameraPose("three-quarter");
  const writes: string[] = [], notifications: string[] = [];
  let allow = false;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: [[graph.id, graph]], selectedPlantId: graph.id, camera, successfulPlantOrdinal: 7,
  }, {
    beforeRecoveryCommit(event) {
      assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), serializePlantGraph(graph));
      assert.equal(coordinator.commandTurnSelected(g => turnCutting(g, angle)).ok, false, "nested command is busy");
      if (!allow) return false;
      writes.push(event.operation); return true;
    },
    onAutosave: event => notifications.push(event.operation),
  });
  const before = coordinator.getDocumentSnapshot();
  assert.deepEqual(coordinator.commandTurnSelected(g => turnCutting(g, angle)), { ok: false, reason: "save-failed" });
  assert.deepEqual(coordinator.getDocumentSnapshot(), before); assert.equal(coordinator.canUndo(), false);
  allow = true;
  assert.equal(coordinator.commandTurnSelected(g => turnCutting(g, angle)).ok, true);
  assert.deepEqual(writes, ["turn"]); assert.deepEqual(notifications, ["turn"]);
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, camera);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 7);
  assert.equal(coordinator.getDebugState().selectedPlantId, graph.id);
  // The subsequent write observes the turned state; the old callback's stronger
  // before-turn assertion has served its purpose, so exercise Undo separately.
  const fresh = new TransactionCoordinator(createDomainAdapters(), before);
  fresh.commandTurnSelected(g => turnCutting(g, angle)); fresh.commandUndo();
  assert.deepEqual(fresh.getDocumentSnapshot(), before);
});

test("no-op and rejected turns keep the useful checkpoint; live gestures and Step Back cannot turn", () => {
  const graph = create(); let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: [[graph.id, graph]], selectedPlantId: graph.id, camera: canonicalCameraPose("front"),
  }, { onAutosave: () => saves++ });
  const before = coordinator.getDocumentSnapshot();
  coordinator.commandTurnSelected(g => turnCutting(g, angle));
  coordinator.commandTurnSelected(g => turnCutting(g, 0));
  assert.equal(saves, 1); assert.equal(coordinator.canUndo(), true);
  coordinator.commandPosture("step-back");
  assert.deepEqual(coordinator.commandTurnSelected(g => turnCutting(g, angle)), { ok: false, reason: "wrong-posture" });
  coordinator.commandPosture("arrange");
  coordinator.beginBase(8, { plantId: graph.id, context: {} }, { base: p(.9, .55) });
  assert.deepEqual(coordinator.commandTurnSelected(g => turnCutting(g, angle)), { ok: false, reason: "busy" });
  coordinator.interrupt(); assert.equal(coordinator.release(8).ok, false);
  coordinator.commandUndo(); assert.deepEqual(coordinator.getDocumentSnapshot(), before);
  assert.equal(saves, 2);
  coordinator.commandSelection(null);
  assert.deepEqual(coordinator.commandTurnSelected(g => turnCutting(g, angle)), { ok: false, reason: "plant-not-selected" });
});

test("protected Turn sweeps the arc and cannot jump through a blocker to a clear endpoint", () => {
  let enabled = true;
  const moving = stem("a", [p(0, .55), p(0, 2.55)], .012);
  const child = stem("arm", [p(0, 1.55), p(2, 1.55)], .012).branches.get("arm:trunk")!;
  Object.assign(child, { kind: "lateral", parentId: moving.rootBranchId, parentDistance: 1 });
  moving.branches.set(child.id, child);
  const x = 1.6 * Math.cos(angle / 2), z = -1.6 * Math.sin(angle / 2);
  const blocker = stem("b", [p(x, 1.4, z), p(x, 1.7, z)], .012);
  const environment = contactEnvironment(moving, [blocker]);
  assert.equal(environment.exempt.size, 0);
  assert.equal(insertionContacts(turnCutting(moving, angle), environment).length, 0, "end is clear");
  assert.equal(insertionContacts(turnCutting(moving, angle / 2), environment).length, 1, "middle crosses");
  const prevention = new StemPrevention(() => enabled, () => [moving, blocker]);
  const result = prevention.turn(moving, angle);
  assert.equal(prevention.feedback.reason, "contact");
  assert.equal(prevention.feedback.marks[0].branchA, child.id, "carried arm is checked even though trunk does not move");
  assert.notEqual(serializePlantGraph(result), serializePlantGraph(turnCutting(moving, angle)));
  assert.equal(insertionContacts(result, environment).length, 0);
  assertRestLengthsPreserved(moving, result);
  let repeated = result;
  for (let i = 0; i < 8; i++) {
    repeated = prevention.turn(repeated, angle);
    assert.equal(prevention.feedback.reason, "contact");
    assert.equal(prevention.feedback.existingPairs, 0, "a stopped contact must not become a legacy exemption");
    assert.equal(serializePlantGraph(repeated), serializePlantGraph(result), "repeat tap cannot creep through");
  }
  const back = prevention.turn(result, -angle);
  assert.equal(prevention.feedback.reason, "clear", "can immediately turn away");
  assert.equal(insertionContacts(back, environment).length, 0);
  enabled = false;
  assert.equal(serializePlantGraph(prevention.turn(moving, angle)), serializePlantGraph(turnCutting(moving, angle)));
});
