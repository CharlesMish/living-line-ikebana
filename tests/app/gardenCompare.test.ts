import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose, type CameraPose } from "../../src/app/camera.ts";
import { GARDEN_KEY, GardenStore, type GardenEntry } from "../../src/app/garden.ts";
import {
  beginGardenComparison,
  comparisonCanvasSlots,
  COMPARISON_VERTICAL_FOV,
  COMPARISON_WORLD_SCALE,
  dollyComparison,
  equalCanvasBox,
  matchedFrames,
  orbitComparison,
  panComparison,
  presentComparison,
  presetComparison,
  reduceComparisonGesture,
  TABLE_TALK_STUDY_NOTE,
  TABLE_TALK_STUDY_PROMPT,
  toggleComparisonChoice,
  type ComparisonGesture,
  type ComparisonViewport,
  type GardenComparison,
} from "../../src/app/gardenCompare.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import type { CanonicalPlantGraph } from "../../src/core/index.ts";
import { fromCanonicalPlantGraph } from "../../src/core/index.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";

const PROMPT = "Make a lower arrangement for a table where people will talk across it.";

function radius(pose: CameraPose) {
  return Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );
}

function kept(id: string, view: "front" | "three-quarter" | "above"): GardenEntry {
  const arrangement = createWorkbenchFixture("flowering-branch", view === "above" ? 9255 : 8278, 1);
  arrangement.camera = canonicalCameraPose(view);
  return { id, title: id, keptAt: "2026-09-22T12:00:00.000Z", thumbnail: null, arrangement };
}

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function fakeViewport() {
  const calls: Array<{ pose: CameraPose; verticalFov: number; worldScale: number }> = [];
  let graphs: CanonicalPlantGraph[] = [];
  let destroyed = false;
  const viewport: ComparisonViewport & {
    calls: typeof calls;
    graphs: CanonicalPlantGraph[];
    destroyed: boolean;
  } = {
    calls,
    get graphs() { return graphs; },
    set graphs(value) { graphs = value; },
    get destroyed() { return destroyed; },
    setGraphs(plants) { graphs = plants; },
    applyMatchedView(pose, verticalFov, worldScale) {
      calls.push({ pose, verticalFov, worldScale });
    },
    destroy() { destroyed = true; },
  };
  return viewport;
}

test("the across-the-table prompt is a human brief, not a measured result", () => {
  assert.equal(TABLE_TALK_STUDY_PROMPT, PROMPT);
  assert.match(TABLE_TALK_STUDY_NOTE, /brief for you/i);
  assert.match(TABLE_TALK_STUDY_NOTE, /nothing here decides whether an arrangement passes/i);
  assert.doesNotMatch(TABLE_TALK_STUDY_NOTE, /score|pass\/fail|automatic/i);
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const guide = html.slice(html.indexOf('data-testid="table-talk-study"'), html.indexOf("Choose any study"));
  assert.match(guide, new RegExp(PROMPT.replace(/[.]/g, "\\.")));
  assert.match(guide, /Nothing here decides whether an arrangement passes/);
  const ui = readFileSync(join(process.cwd(), "src/app/gardenUI.ts"), "utf8");
  assert.match(ui, /TABLE_TALK_STUDY_PROMPT/);
  assert.match(ui, /TABLE_TALK_STUDY_NOTE/);
  assert.match(ui, /Same view for both\. Nothing is saved\./);
  assert.match(ui, /Drag either one\. Both move together\./);
  assert.match(ui, /Choose two, then look at them together\./);
  assert.match(ui, /reduceComparisonGesture/);
  assert.match(ui, /comparisonCanvasSlots/);
  assert.doesNotMatch(ui, /starting from Front rather than either saved framing/);
  assert.equal(COMPARISON_VERTICAL_FOV, STUDIO_VERTICAL_FOV);
  assert.equal(COMPARISON_WORLD_SCALE, 1);
});

test("comparison clones both entries and frames them with one camera and one scale", () => {
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  right.arrangement.plants[0].branches[0].points[0].x += 0.35;
  const beforeLeft = JSON.stringify(left);
  const beforeRight = JSON.stringify(right);
  assert.throws(() => beginGardenComparison([left, right], "original", "original"), /different/);
  assert.throws(() => beginGardenComparison([left, right], "original", "missing"), /two kept/);
  const selected = ["original"];
  assert.deepEqual(toggleComparisonChoice(selected, "revision"), ["original", "revision"]);
  assert.deepEqual(selected, ["original"]);
  assert.deepEqual(toggleComparisonChoice(["original", "revision"], "other"), ["original", "revision"]);

  const session = beginGardenComparison([left, right], left.id, right.id);
  assert.deepEqual(session.camera, canonicalCameraPose("front"));
  assert.equal("score" in session, false);
  assert.equal("passed" in session, false);
  assert.notEqual(session.left, left);
  assert.notEqual(session.left.arrangement.camera, left.arrangement.camera);
  session.left.arrangement.plants[0].branches[0].points[0].x = 80;
  session.left.title = "changed clone";
  const storedLeftCamera = JSON.stringify(session.left.arrangement.camera);
  const moved = panComparison(dollyComparison(orbitComparison(session, 36, -12), 0.82), 20, -8, 390);
  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
  assert.equal(JSON.stringify(moved.left.arrangement.camera), storedLeftCamera);
  assert.equal(JSON.stringify(moved.right.arrangement.camera), JSON.stringify(right.arrangement.camera));
  assert.deepEqual(moved.left.arrangement.camera, canonicalCameraPose("above"));
  assert.deepEqual(moved.right.arrangement.camera, canonicalCameraPose("three-quarter"));

  const frames = matchedFrames(moved);
  assert.notEqual(frames.left.camera, frames.right.camera);
  assert.deepEqual(frames.left.camera, frames.right.camera);
  assert.deepEqual(frames.left, {
    camera: frames.right.camera,
    verticalFov: STUDIO_VERTICAL_FOV,
    worldScale: 1,
  });
  assert.equal(radius(frames.left.camera), radius(frames.right.camera));
  assert.notDeepEqual(frames.left.camera, left.arrangement.camera);
  assert.notDeepEqual(frames.left.camera, right.arrangement.camera);
  assert.notEqual(radius(frames.left.camera), radius(canonicalCameraPose("above")));

  const above = presetComparison(moved, "above");
  const aboveFrames = matchedFrames(above);
  assert.deepEqual(aboveFrames.left.camera, aboveFrames.right.camera);
  assert.deepEqual(aboveFrames.left.camera, canonicalCameraPose("above"));
  assert.deepEqual(above.right.arrangement.camera, canonicalCameraPose("three-quarter"));
  assert.equal(above.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(above.worldScale, 1);

  const tampered = { ...above, verticalFov: 12, worldScale: 4 } as GardenComparison;
  const presentedLeft = fakeViewport();
  const presentedRight = fakeViewport();
  presentComparison(tampered, presentedLeft, presentedRight);
  const leftCall = presentedLeft.calls.at(-1)!;
  const rightCall = presentedRight.calls.at(-1)!;
  assert.notEqual(leftCall.pose, rightCall.pose);
  assert.deepEqual(leftCall.pose, rightCall.pose);
  assert.equal(leftCall.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(rightCall.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(leftCall.worldScale, 1);
  assert.equal(rightCall.worldScale, 1);
  assert.equal(
    presentedRight.graphs[0].branches[0].points[0].x,
    right.arrangement.plants[0].branches[0].points[0].x,
  );
  assert.notEqual(
    presentedLeft.graphs[0].branches[0].points[0].x,
    presentedRight.graphs[0].branches[0].points[0].x,
  );
  presentedRight.graphs[0].branches[0].points[0].x = 400;
  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
  assert.notEqual(presentedRight.graphs[0], above.right.arrangement.plants[0]);
});

test("comparison does not write Garden storage", () => {
  const storage = memory();
  const garden = new GardenStore(GARDEN_KEY, storage);
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  garden.load();
  garden.keep(left);
  garden.keep(right);
  const before = garden.exportRaw();
  const loaded = garden.load();
  const session = beginGardenComparison(loaded.entries, "original", "revision");
  presentComparison(orbitComparison(session, 10, 4), fakeViewport(), fakeViewport());
  assert.equal(garden.exportRaw(), before);
  assert.equal(storage.values.size, 1);
});

function harness() {
  const writes: unknown[] = [];
  const state = { posture: "arrange", tool: "shape", view: "front", cameraMode: "orbit" };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    workingSession: null,
    gardenComparison: null,
    config: { workbench: false },
    bendVariant: "bead",
    selectedBranchId: "plant-1:trunk",
    cameraIsFree: false,
    hovering: false,
    gesture: null,
    autosaveWrites: [],
    sound: { unlock() {} },
    telemetryStore: { clear() {} },
    metrics: { resetAttempt() {} },
    resolvePendingAcquisition() {},
    syncPresentation() {},
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus() {} },
    store: { save(ordinal: number, plants: unknown) { writes.push({ ordinal, plants }); return true; } },
  });
  const snapshot = createWorkbenchFixture("flowering-branch", 8278, 1);
  app.replaceCoordinator(new Map(snapshot.plants.map((graph: CanonicalPlantGraph) => [graph.id, fromCanonicalPlantGraph(graph)])), 1);
  return { app, writes };
}

test("showing and leaving a comparison leaves the working bowl, its camera, and writes untouched", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  const coordinator = app.coordinator;
  const created: ReturnType<typeof fakeViewport>[] = [];
  app.createComparisonViewports = () => {
    const viewports = [fakeViewport(), fakeViewport()] as const;
    created.push(...viewports);
    return viewports;
  };
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  right.arrangement.plants[0].branches[0].points[0].z -= 0.2;
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  const session = app.beginGardenComparisonView(left, right, { left: {}, right: {} });
  assert.equal(app.coordinator, coordinator);
  assert.equal(app.workingSession, null);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(writes.length, 0);
  assert.equal(JSON.stringify(left), leftJson);
  assert.equal(JSON.stringify(right), rightJson);
  assert.equal(created.length, 2);
  const leftView = created[0].calls.at(-1)!;
  const rightView = created[1].calls.at(-1)!;
  assert.deepEqual(leftView.pose, rightView.pose);
  assert.deepEqual(leftView.pose, canonicalCameraPose("front"));
  assert.notDeepEqual(leftView.pose, left.arrangement.camera);
  assert.notDeepEqual(rightView.pose, right.arrangement.camera);
  assert.equal(leftView.verticalFov, rightView.verticalFov);
  assert.equal(leftView.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(leftView.worldScale, 1);
  assert.equal(rightView.worldScale, 1);
  assert.equal(radius(leftView.pose), radius(rightView.pose));

  const synced = app.syncGardenComparisonView(orbitComparison(session, 48, 10));
  const shared = created[0].calls.at(-1)!;
  assert.deepEqual(shared.pose, created[1].calls.at(-1)!.pose);
  assert.deepEqual(shared.pose, synced.camera);
  assert.equal(shared.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(shared.worldScale, 1);
  assert.notDeepEqual(shared.pose, left.arrangement.camera);
  assert.deepEqual(synced.left.arrangement.camera, canonicalCameraPose("above"));
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(app.coordinator, coordinator);
  assert.equal(writes.length, 0);

  app.endGardenComparisonView();
  assert.equal(app.gardenComparison, null);
  assert.equal(created.every((viewport) => viewport.destroyed), true);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(JSON.stringify(left), leftJson);
  assert.equal(JSON.stringify(right), rightJson);
  assert.equal(writes.length, 0);
});

test("a second pointer cannot steal a comparison drag, and interruption restores the start", () => {
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  const beforeLeft = JSON.stringify(left);
  const beforeRight = JSON.stringify(right);
  const session = beginGardenComparison([left, right], left.id, right.id);
  const start = session.camera;
  let gesture: ComparisonGesture = { session, drag: null, mode: "orbit" };
  const step = (action: Parameters<typeof reduceComparisonGesture>[1]) => {
    const effect = reduceComparisonGesture(gesture, action);
    gesture = effect.gesture;
    return effect;
  };

  const ignoredButton = step({ type: "pointerdown", pointerId: 4, button: 2, x: 0, y: 0, height: 10 });
  assert.equal(ignoredButton.ignored, true);
  assert.equal(gesture.drag, null);

  const started = step({ type: "pointerdown", pointerId: 1, button: 0, x: 12, y: 20, height: 400 });
  assert.equal(started.ignored, false);
  assert.equal(gesture.drag?.pointerId, 1);
  const frozen = JSON.stringify(gesture.drag?.startCamera);
  assert.equal(frozen, JSON.stringify(start));

  const stolen = step({ type: "pointerdown", pointerId: 2, button: 0, x: 80, y: 90, height: 120 });
  assert.equal(stolen.ignored, true);
  assert.equal(gesture.drag?.pointerId, 1);
  assert.equal(JSON.stringify(gesture.drag?.startCamera), frozen);
  assert.equal(gesture.drag?.height, 400);

  const foreignMove = step({ type: "pointermove", pointerId: 2, pointerType: "touch", buttons: 1, x: 200, y: 40 });
  assert.equal(foreignMove.ignored, true);
  assert.deepEqual(gesture.session.camera, start);

  const moved = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 70, y: -10 });
  assert.equal(moved.preview, true);
  assert.equal(moved.rolledBack, false);
  assert.notDeepEqual(gesture.session.camera, start);
  assert.equal(gesture.drag?.pointerId, 1);
  assert.equal(JSON.stringify(gesture.drag?.startCamera), frozen);
  const preview = gesture.session.camera;

  const foreignUp = step({ type: "pointerup", pointerId: 2 });
  assert.equal(foreignUp.ignored, true);
  assert.equal(gesture.drag?.pointerId, 1);
  const foreignCancel = step({ type: "pointercancel", pointerId: 9 });
  assert.equal(foreignCancel.ignored, true);
  assert.deepEqual(gesture.session.camera, preview);
  const wheeled = step({ type: "wheel", deltaY: 80 });
  assert.equal(wheeled.ignored, true);
  assert.deepEqual(gesture.session.camera, preview);

  const touchStillOwns = reduceComparisonGesture(gesture, {
    type: "pointermove",
    pointerId: 1,
    pointerType: "touch",
    buttons: 0,
    x: 90,
    y: 30,
  });
  assert.equal(touchStillOwns.rolledBack, false);
  assert.equal(touchStillOwns.gesture.drag?.pointerId, 1);
  gesture = touchStillOwns.gesture;

  const released = step({ type: "pointerup", pointerId: 1 });
  assert.equal(released.gesture.drag, null);
  assert.equal(released.rolledBack, false);
  assert.deepEqual(released.gesture.session.camera, touchStillOwns.gesture.session.camera);
  const afterRelease = reduceComparisonGesture(released.gesture, { type: "lostcapture", pointerId: 1 });
  assert.equal(afterRelease.ignored, true);
  assert.deepEqual(afterRelease.gesture.session.camera, released.gesture.session.camera);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 12, y: 20, height: 400 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 70, y: -10 }).gesture;
  const cancelled = step({ type: "pointercancel", pointerId: 1 });
  assert.equal(cancelled.rolledBack, true);
  assert.equal(cancelled.leave, false);
  assert.equal(gesture.drag, null);
  assert.deepEqual(gesture.session.camera, start);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "pen", buttons: 1, x: 30, y: 10 }).gesture;
  const lost = step({ type: "lostcapture", pointerId: 1 });
  assert.equal(lost.rolledBack, true);
  assert.deepEqual(gesture.session.camera, start);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 48, y: 12 }).gesture;
  const buttonsUp = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 0, x: 60, y: 20 });
  assert.equal(buttonsUp.rolledBack, true);
  assert.deepEqual(gesture.session.camera, start);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 55, y: 8 }).gesture;
  const blurred = step({ type: "interrupt" });
  assert.equal(blurred.leave, false);
  assert.equal(blurred.rolledBack, true);
  assert.deepEqual(gesture.session.camera, start);
  const idleInterrupt = step({ type: "interrupt" });
  assert.equal(idleInterrupt.ignored, true);
  assert.equal(idleInterrupt.leave, false);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 40, y: -20 }).gesture;
  const escaped = step({ type: "escape" });
  assert.equal(escaped.leave, false);
  assert.equal(escaped.rolledBack, true);
  assert.deepEqual(gesture.session.camera, start);
  const leave = step({ type: "escape" });
  assert.equal(leave.leave, true);
  assert.equal(leave.rolledBack, false);
  assert.deepEqual(gesture.session.camera, start);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 10, y: 10, height: 280 }).gesture;
  const orbiting = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 80, y: -30 });
  const fromStart = dollyComparison(session, 0.9);
  const fromPreview = dollyComparison(orbiting.gesture.session, 0.9);
  assert.notDeepEqual(fromStart.camera, fromPreview.camera);
  const zoomed = step({ type: "dolly", zoomScale: 0.9 });
  assert.equal(zoomed.rolledBack, true);
  assert.equal(zoomed.gesture.drag, null);
  assert.deepEqual(zoomed.gesture.session.camera, fromStart.camera);
  assert.equal(zoomed.gesture.session.verticalFov, COMPARISON_VERTICAL_FOV);
  assert.equal(zoomed.gesture.session.worldScale, COMPARISON_WORLD_SCALE);

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 36, y: 14 }).gesture;
  const preset = step({ type: "preset", view: "above" });
  assert.equal(preset.rolledBack, true);
  assert.equal(preset.gesture.drag, null);
  assert.deepEqual(preset.gesture.session.camera, canonicalCameraPose("above"));
  assert.deepEqual(preset.gesture.session.left.arrangement.camera, canonicalCameraPose("above"));
  assert.deepEqual(preset.gesture.session.right.arrangement.camera, canonicalCameraPose("three-quarter"));

  gesture = { session, drag: null, mode: "orbit" };
  gesture = step({ type: "pointerdown", pointerId: 1, button: 0, x: 0, y: 0, height: 300 }).gesture;
  gesture = step({ type: "pointermove", pointerId: 1, pointerType: "mouse", buttons: 1, x: 24, y: 18 }).gesture;
  const panned = step({ type: "mode", mode: "move" });
  assert.equal(panned.rolledBack, true);
  assert.equal(panned.gesture.mode, "move");
  assert.equal(panned.gesture.drag, null);
  assert.deepEqual(panned.gesture.session.camera, start);

  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
  assert.equal(JSON.stringify(session.left.arrangement.camera), JSON.stringify(canonicalCameraPose("above")));
  assert.equal(JSON.stringify(session.right.arrangement.camera), JSON.stringify(canonicalCameraPose("three-quarter")));
});

test("interrupting a comparison drag restores the shared start and writes nothing", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  const coordinator = app.coordinator;
  app.createComparisonViewports = () => [fakeViewport(), fakeViewport()] as const;
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  const session = app.beginGardenComparisonView(left, right, { left: {}, right: {} });
  let gesture: ComparisonGesture = { session, drag: null, mode: "orbit" };
  gesture = reduceComparisonGesture(gesture, {
    type: "pointerdown", pointerId: 3, button: 0, x: 0, y: 0, height: 390,
  }).gesture;
  const moved = reduceComparisonGesture(gesture, {
    type: "pointermove", pointerId: 3, pointerType: "mouse", buttons: 1, x: 64, y: -12,
  });
  app.syncGardenComparisonView(moved.gesture.session);
  const stolen = reduceComparisonGesture(moved.gesture, {
    type: "pointerdown", pointerId: 8, button: 0, x: 10, y: 10, height: 100,
  });
  assert.equal(stolen.ignored, true);
  assert.equal(stolen.gesture.drag?.pointerId, 3);
  const cancelled = reduceComparisonGesture(stolen.gesture, { type: "pointercancel", pointerId: 3 });
  const restored = app.syncGardenComparisonView(cancelled.gesture.session);
  assert.equal(cancelled.rolledBack, true);
  assert.deepEqual(restored.camera, session.camera);
  assert.deepEqual(restored.camera, canonicalCameraPose("front"));
  assert.equal(restored.verticalFov, COMPARISON_VERTICAL_FOV);
  assert.equal(restored.worldScale, 1);
  app.endGardenComparisonView();
  assert.equal(app.coordinator, coordinator);
  assert.equal(app.workingSession, null);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(JSON.stringify(left), leftJson);
  assert.equal(JSON.stringify(right), rightJson);
  assert.equal(writes.length, 0);
});

test("unequal and wrapping titles keep both comparison canvases the same size", () => {
  const gaps = { stacked: false, columnGap: 10, rowGap: 6 };
  const wrapped = comparisonCanvasSlots(
    { width: 800, height: 420 },
    { leftHeight: 48, rightHeight: 16 },
    gaps,
  );
  const short = comparisonCanvasSlots(
    { width: 800, height: 420 },
    { leftHeight: 16, rightHeight: 16 },
    gaps,
  );
  assert.deepEqual(wrapped.left, wrapped.right);
  assert.deepEqual(wrapped.left, { width: 395, height: 366 });
  assert.deepEqual(short.left, short.right);
  assert.equal(wrapped.left.width, short.left.width);
  assert.equal(wrapped.left.height, short.left.height - 32);
  const swapped = comparisonCanvasSlots(
    { width: 800, height: 420 },
    { leftHeight: 16, rightHeight: 48 },
    gaps,
  );
  assert.deepEqual(swapped.left, swapped.right);
  assert.deepEqual(swapped, wrapped);

  const stacked = comparisonCanvasSlots(
    { width: 320, height: 640 },
    { leftHeight: 72, rightHeight: 18 },
    { stacked: true, columnGap: 0, rowGap: 8 },
  );
  const stackedEven = comparisonCanvasSlots(
    { width: 320, height: 640 },
    { leftHeight: 18, rightHeight: 18 },
    { stacked: true, columnGap: 0, rowGap: 8 },
  );
  assert.deepEqual(stacked.left, stacked.right);
  assert.deepEqual(stacked.left, { width: 320, height: 263 });
  assert.equal(stacked.left.height, stackedEven.left.height - 27);
  assert.equal(stacked.right.height, stacked.left.height);

  assert.deepEqual(
    equalCanvasBox({ width: 300.5, height: 210 }, { width: 280, height: 240 }),
    { width: 280, height: 210 },
  );
  const clamped = equalCanvasBox(wrapped.left, { width: wrapped.left.width - 4, height: wrapped.left.height + 6 });
  assert.equal(clamped.width, wrapped.right.width - 4);
  assert.equal(clamped.height, wrapped.left.height);
});
