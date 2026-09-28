import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { createFloweringBranch, sampleBranch, serializePlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";
import { studioFixture } from "../presentation/studioFixture.ts";

/**
 * Production ThreeStudio (picking, projection, stage lens) and production
 * IkebanaApp gesture/measurement methods with a real TransactionCoordinator;
 * only GPU drawing, DOM chrome and animation frames are stubbed.
 */
function lensedAimHarness() {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const before = serializePlantGraph(graph);
  const fixture = studioFixture(graph, 390, 844);
  const studio = fixture.studio;
  Object.assign(studio, { options: { ...studio.options, stageLens: true }, baseVerticalFov: STUDIO_VERTICAL_FOV, stageTopInset: 0, lens: null });
  studio.setStageTopInset(186);

  const saves: unknown[] = [];
  const cancelled: string[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map([[graph.id, graph]]), camera: canonicalCameraPose("front"),
    selectedPlantId: graph.id, successfulPlantOrdinal: 1,
  }, { onAutosave: (event) => saves.push(event), onCancel: (event) => cancelled.push(event.reason) });

  const rail = { bottom: 186 };
  const frames: Array<() => void> = [];
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    coordinator, studio, hovering: false, gesture: null, disposed: false, stageMeasureFrame: null,
    canvas: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
      hasPointerCapture: () => false, releasePointerCapture() {},
    },
    root: { querySelector: () => ({ getBoundingClientRect: () => ({ bottom: rail.bottom }) }) },
    canonicalHash: () => before, assignSelectedBranch() {}, capturePointer() {}, recordHit() {},
    syncPresentation() {}, resolvePendingAcquisition() {},
    ui: { setStatus() {}, setCraftCue() {} },
  });
  // Queue animation frames so a scheduled measurement can run later, on demand.
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => { frames.push(() => callback(0)); return frames.length; }) as typeof requestAnimationFrame;
  const flushFrames = () => { while (frames.length) frames.shift()!(); };

  const trunk = graph.branches.get(graph.rootBranchId)!;
  const projected = studio.projectPoint(sampleBranch(trunk, trunk.activeLength * 0.7).position);
  const candidate = studio.collectHitCandidates(projected.clientX, projected.clientY)[0];
  assert.ok(candidate, "a trunk press is pickable under the lens");
  const x = projected.clientX;
  const y = projected.clientY;
  const beginAim = (pointerId: number) => {
    app.beginAim({ pointerId, clientX: x, clientY: y }, candidate);
    assert.equal(coordinator.getDebugState().active?.kind, "aim");
  };
  const move = (pointerId: number, dx: number) => app.handlePointerMove({
    pointerId, pointerType: "touch", buttons: 1, clientX: x + dx, clientY: y - dx / 2, preventDefault() {},
  });
  const release = (pointerId: number, dx: number) => app.handlePointerUp({
    pointerId, pointerType: "touch", buttons: 0, clientX: x + dx, clientY: y - dx / 2, preventDefault() {},
  });
  const document = () => serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!);
  const restore = () => { globalThis.requestAnimationFrame = raf; fixture.dispose(); };
  return { app, studio, coordinator, rail, saves, cancelled, before, beginAim, move, release, document, flushFrames, restore };
}

test("an inset-only remeasure during an Aim cancels before the projection changes; release cannot save", () => {
  const h = lensedAimHarness();
  try {
    const fovBefore = h.studio.getPanProjection().verticalFov;
    h.beginAim(7);
    h.move(7, 24);
    assert.notEqual(serializePlantGraph(h.coordinator.getPresentationState().active.graph), h.before, "the preview moved");

    h.rail.bottom = 240; // rail grows (e.g. a font settles); the canvas stays 390x844
    h.app.measureStage();
    assert.ok(h.studio.getPanProjection().verticalFov > fovBefore + 1, "the projection did change");
    assert.equal(h.coordinator.getDebugState().active, null, "the Aim was cancelled first");
    assert.equal(h.app.gesture, null);
    assert.deepEqual(h.cancelled, ["system-interruption"]);

    h.release(7, 24);
    assert.equal(h.saves.length, 0, "the ordinary release after cancellation saves nothing");
    assert.equal(h.document(), h.before);
  } finally { h.restore(); }
});

test("a queued measurement that runs after a new acquisition cancels that acquisition", () => {
  const h = lensedAimHarness();
  try {
    h.rail.bottom = 240;
    h.app.scheduleStageMeasure(); // e.g. queued by a resize or font settle
    h.beginAim(8); // the player starts a new gesture before the frame runs
    h.move(8, 20);
    h.flushFrames();
    assert.equal(h.coordinator.getDebugState().active, null);
    h.release(8, 20);
    assert.equal(h.saves.length, 0);
    assert.equal(h.document(), h.before);
  } finally { h.restore(); }
});

test("an unchanged or no-effect measurement leaves a live Aim alone and its release commits once", () => {
  const h = lensedAimHarness();
  try {
    h.beginAim(9);
    h.move(9, 24);
    h.app.measureStage(); // same inset: harmless
    h.rail.bottom = 186.3; // sub-pixel jitter: no projection change
    h.app.measureStage();
    assert.equal(h.coordinator.getDebugState().active?.kind, "aim");
    h.release(9, 24);
    assert.equal(h.saves.length, 1);
    assert.notEqual(h.document(), h.before);
  } finally { h.restore(); }
});

test("an inset change within the reference share does not change the projection or cancel", () => {
  const h = lensedAimHarness();
  try {
    // Reset to a roomy inset, then move within the reference share (<= 16% of 844 = 135 px).
    h.rail.bottom = 100;
    h.app.measureStage();
    const projection = h.studio.getPanProjection();
    h.beginAim(10);
    h.move(10, 12);
    assert.equal(h.studio.stageTopInsetChangesProjection(120), false);
    h.rail.bottom = 120;
    h.app.measureStage();
    assert.deepEqual(h.studio.getPanProjection(), projection);
    assert.equal(h.coordinator.getDebugState().active?.kind, "aim");
    h.release(10, 12);
    assert.equal(h.saves.length, 1);
  } finally { h.restore(); }
});
