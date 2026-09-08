import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose, dollyCameraPose, panCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { createFloweringBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";

function pointer(pointerId: number, clientX: number, clientY: number) {
  return { pointerId, clientX, clientY, pointerType: "touch", buttons: 1, preventDefault() {} };
}

function harness() {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const camera = canonicalCameraPose("front");
  const saves: unknown[] = [];
  const cancelled: string[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map([[graph.id, graph]]), camera, selectedPlantId: graph.id, successfulPlantOrdinal: 1,
  }, { onAutosave: (event) => saves.push(event), onCancel: (event) => cancelled.push(event.reason) });
  coordinator.commandPosture("step-back");
  const state = { cameraMode: "move", view: "front" };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    coordinator, gesture: null, hovering: false, cameraIsFree: false,
    canvas: { getBoundingClientRect: () => ({ height: 390 }), setPointerCapture() {}, hasPointerCapture: () => false },
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus() {} },
    sound: { unlock() {} }, metrics: { resetAttempt() {} },
    canonicalHash: () => "unchanged-graph", recordHit() {}, resolvePendingAcquisition() {}, syncPresentation() {},
  });
  const preview = () => {
    const active = coordinator.getPresentationState().active;
    assert.equal(active?.kind, "camera");
    return active?.kind === "camera" ? active.camera : null;
  };
  return { app, coordinator, graph, camera, saves, cancelled, preview };
}

test("Step Back Move freezes its mode and commits only camera framing; Arrange cannot acquire it", () => {
  const { app, coordinator, graph, camera, saves, preview } = harness();
  const botanicalBefore = toCanonicalPlantGraph(graph);
  app.beginCamera(pointer(1, 200, 180));
  app.ui.state.cameraMode = "orbit"; // Acquired mode, not subsequent UI state, owns this drag.
  app.handlePointerMove(pointer(1, 240, 150));
  const expected = panCameraPose(camera, 40, -30, 390, STUDIO_VERTICAL_FOV);
  assert.deepEqual(preview(), expected);
  app.handlePointerMove(pointer(1, 240, 150)); // No frame-to-frame accumulation.
  assert.deepEqual(preview(), expected);
  app.handlePointerUp(pointer(1, 240, 150));
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, expected);
  assert.deepEqual(toCanonicalPlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), botanicalBefore);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 0);
  coordinator.commandPosture("arrange");
  app.beginCamera(pointer(2, 100, 100));
  assert.equal(app.gesture, null);
  assert.equal(coordinator.getDebugState().active, null);
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, expected);
});

test("Move-to-pinch-to-Move stays continuous; cancellation restores the original camera and preset state", () => {
  const { app, coordinator, camera, cancelled, saves, preview } = harness();
  app.beginCamera(pointer(1, 200, 180));
  app.handlePointerMove(pointer(1, 240, 150));
  const moved = preview()!;
  app.addCameraPointer(pointer(2, 340, 150));
  app.handlePointerMove(pointer(2, 340, 150));
  assert.deepEqual(preview(), moved);
  app.handlePointerMove(pointer(2, 440, 150));
  const zoomed = dollyCameraPose(moved, 0.5);
  assert.deepEqual(preview(), zoomed);
  app.handlePointerUp(pointer(2, 440, 150));
  app.handlePointerMove(pointer(1, 240, 150));
  assert.deepEqual(preview(), zoomed);
  app.handlePointerMove(pointer(1, 240, 170));
  assert.deepEqual(preview(), panCameraPose(zoomed, 0, 20, 390, STUDIO_VERTICAL_FOV));
  app.handlePointerMove(pointer(99, 999, 999));
  assert.deepEqual(preview(), panCameraPose(zoomed, 0, 20, 390, STUDIO_VERTICAL_FOV));
  app.interruptActive("system-interruption");
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, camera);
  assert.equal(app.cameraIsFree, false);
  assert.deepEqual(cancelled, ["system-interruption"]);
  app.handlePointerUp(pointer(1, 240, 170));
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, camera);
  assert.equal(saves.length, 0);
});

test("camera mode commands cancel first, and a canonical view recenters a released pan", () => {
  const { app, coordinator, camera, cancelled, saves } = harness();
  app.beginCamera(pointer(1, 200, 180));
  app.handlePointerMove(pointer(1, 240, 150));
  app.handleUICommand({ kind: "set-camera-mode", cameraMode: "orbit" }, {});
  assert.equal(app.gesture, null);
  assert.equal(app.ui.state.cameraMode, "orbit");
  assert.deepEqual(cancelled, ["view-command"]);
  app.handlePointerUp(pointer(1, 240, 150));
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, camera);
  app.handleUICommand({ kind: "set-camera-mode", cameraMode: "move" }, {});
  app.beginCamera(pointer(2, 200, 180));
  app.handlePointerMove(pointer(2, 240, 150));
  app.handlePointerUp(pointer(2, 240, 150));
  assert.notDeepEqual(coordinator.getDocumentSnapshot().camera, camera);
  app.handleUICommand({ kind: "set-view", view: "above" }, {});
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, canonicalCameraPose("above"));
  assert.equal(app.cameraIsFree, false);
  assert.equal(saves.length, 0);
});

test("Stop and look retains a released pan and rolls back an unfinished camera drag", () => {
  const { app, coordinator, saves } = harness();
  app.beginCamera(pointer(1, 200, 180));
  app.handlePointerMove(pointer(1, 240, 150));
  app.handlePointerUp(pointer(1, 240, 150));
  const keptCamera = coordinator.getDocumentSnapshot().camera;
  app.handleUICommand({ kind: "stop-and-look" }, {});
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, keptCamera);
  assert.equal(app.cameraIsFree, true);
  app.beginCamera(pointer(2, 200, 180));
  app.handlePointerMove(pointer(2, 270, 120));
  app.handleUICommand({ kind: "stop-and-look" }, {});
  app.handlePointerUp(pointer(2, 270, 120));
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, keptCamera);
  assert.equal(app.cameraIsFree, true);
  assert.equal(saves.length, 0);
});
