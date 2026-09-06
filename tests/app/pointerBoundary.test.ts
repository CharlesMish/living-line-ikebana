import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { createFloweringBranch, sampleBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

function harness(kind: "aim" | "insert" = "aim") {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const saves: unknown[] = [];
  const cancellations: string[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: kind === "aim" ? new Map([[graph.id, graph]]) : new Map(),
    camera: canonicalCameraPose("front"), selectedPlantId: kind === "aim" ? graph.id : null,
    successfulPlantOrdinal: kind === "aim" ? 1 : 0,
  }, {
    onAutosave: (event) => saves.push(event),
    onCancel: (event) => cancellations.push(event.reason),
  });
  const point = sampleBranch(graph.branches.get(graph.rootBranchId)!, 2).position;
  const began = kind === "aim"
    ? coordinator.beginAim(7, { plantId: graph.id, branchId: graph.rootBranchId, grabbedMaterialDistance: 2, context: {} }, { target: point })
    : coordinator.beginInsert(7, { ordinal: 1, plantId: graph.id, seed: graph.seed, graph }, {}, { base: { x: 0, y: 0.55, z: 0 }, valid: true });
  assert.ok(began.ok);
  const initial = [...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph);
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    coordinator, hovering: false, sound: { unlock() {} },
    gesture: { kind, owner: 7, capture: { hasPointerCapture: () => false },
      grabbedPoint: point, startPlaneHit: point, plane: {}, plantId: graph.id },
    studio: {
      intersectClientPlane: () => ({ x: point.x + 1, y: point.y + 0.3, z: point.z }),
      intersectKenzanPlane: () => ({ point: { x: 0.25, y: 0.55, z: 0 }, valid: true }),
    },
    ui: { setStatus() {}, setState() {} },
    syncPresentation() {},
  });
  return { app, coordinator, saves, cancellations, initial };
}

function move(pointerId = 7, buttons = 1) {
  return { pointerId, pointerType: "mouse", buttons, clientX: 140, clientY: 220, preventDefault() {} };
}

test("a missed mouse release rolls back the live edit/insertion, and later release cannot save it", () => {
  for (const kind of ["aim", "insert"] as const) {
    for (const releasedButtons of [0, 2]) {
      const { app, coordinator, saves, cancellations, initial } = harness(kind);
      app.handlePointerMove(move());
      assert.ok(coordinator.getDebugState().active);
      app.handlePointerMove(move(7, releasedButtons));
      assert.equal(app.gesture, null);
      assert.equal(coordinator.getDebugState().active, null);
      assert.deepEqual([...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph), initial);
      assert.deepEqual(cancellations, ["pointer-cancel"]);
      app.handlePointerUp(move(7, 0));
      assert.equal(saves.length, 0);
      assert.equal(coordinator.getDebugState().successfulPlantOrdinal, kind === "aim" ? 1 : 0);
    }
  }
});

test("another pointer cannot cancel the owner; a held mouse drag still updates and commits once", () => {
  const { app, coordinator, saves, cancellations, initial } = harness();
  app.handlePointerMove(move(8, 0));
  assert.ok(app.gesture);
  assert.equal(cancellations.length, 0);
  app.handlePointerMove(move());
  app.handlePointerUp(move(7, 0));
  assert.equal(coordinator.getDebugState().active, null);
  assert.notDeepEqual([...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph), initial);
  assert.equal(saves.length, 1);
  app.handlePointerUp(move(7, 0));
  assert.equal(saves.length, 1);
});

test("opening view choices cancels the acquired branch before showing the menu without moving the camera", () => {
  const { app, coordinator, saves, cancellations, initial } = harness();
  const camera = coordinator.getDocumentSnapshot().camera;
  app.handlePointerMove(move());
  let opened = false;
  app.ui.setState = (patch: { viewMenuOpen: boolean; experimentPanelOpen: boolean }) => {
    assert.equal(coordinator.getDebugState().active, null);
    assert.deepEqual(patch, { viewMenuOpen: true, experimentPanelOpen: false });
    opened = true;
  };
  app.handleUICommand({ kind: "set-view-menu", open: true }, {});
  assert.equal(opened, true);
  assert.deepEqual(cancellations, ["view-command"]);
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, camera);
  assert.deepEqual([...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph), initial);
  app.handlePointerUp(move(7, 0));
  assert.equal(saves.length, 0);
});
