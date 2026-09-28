import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { fromCanonicalPlantGraph, sampleBranch } from "../../src/core/index.ts";
import { CommittedStore } from "../../src/app/persistence.ts";

function harness(workbench = false) {
  const writes: unknown[] = [];
  const state = { posture: "arrange", tool: "shape", view: "front", cameraMode: "orbit" };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    workingSession: null, config: { workbench }, bendVariant: "bead", selectedBranchId: "plant-1:trunk", cameraIsFree: false,
    hovering: false, gesture: null, autosaveWrites: [],
    root: { querySelector: () => null },
    sound: { unlock() {} }, telemetryStore: { clear() {} },
    metrics: { resetAttempt() {} }, resolvePendingAcquisition() {}, syncPresentation() {},
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus() {} },
    store: { save(ordinal: number, plants: unknown) { writes.push({ ordinal, plants }); return true; } },
  });
  const snapshot = createWorkbenchFixture("flowering-branch", 8278, 1);
  app.replaceCoordinator(new Map(snapshot.plants.map((graph) => [graph.id, fromCanonicalPlantGraph(graph)])), 1);
  return { app, writes, snapshot };
}
test("Garden pauses a live bend before reading committed state; later release is inert", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  const graph = app.coordinator.getDocumentSnapshot().plants.get("plant-1");
  const branch = graph.branches.get(graph.rootBranchId);
  const point = sampleBranch(branch, 2).position;
  app.coordinator.commandSelection(graph.id);
  const began = app.coordinator.beginBend(7, { plantId: graph.id, branchId: graph.rootBranchId, beadStationDistance: 2, touchMaterialDistance: 2, context: {} }, { target: { ...point, x: point.x + .8 } });
  assert.ok(began.ok);
  app.gesture = { kind: "bend", owner: 7, capture: { hasPointerCapture: () => false } };
  app.pauseForGarden();
  assert.equal(app.gesture, null);
  assert.equal(app.coordinator.getDebugState().posture, "arrange");
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  app.handlePointerUp({ pointerId: 7 });
  assert.equal(writes.length, 0);
});

function moveBase(app: any, x: number, release = true) {
  app.coordinator.commandSelection("plant-1");
  assert.equal(app.coordinator.beginBase(7, { plantId: "plant-1", context: {} }, { base: { x, y: .55, z: 0 } }).ok, true);
  if (release) assert.equal(app.coordinator.release(7).ok, true);
}

test("app recovery writes once before swapping memory; failed recovery preserves bowl and checkpoint", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  moveBase(app, .7);
  assert.equal(writes.length, 1);
  const moved = JSON.stringify(app.arrangementSnapshot());
  assert.notEqual(moved, before);
  const save = app.store.save;
  app.store.save = (ordinal: number, plants: unknown) => {
    assert.equal(JSON.stringify(app.arrangementSnapshot()), moved, "disk write must precede restore");
    return save(ordinal, plants);
  };
  app.handleUICommand({ kind: "undo-edit" }, {});
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(writes.length, 2, "recovery autosave must not duplicate prewrite");
  assert.equal(app.autosaveWrites.at(-1).reason, "undo");
  assert.equal(app.coordinator.canUndo(), false);
  app.store.save = save;
  app.handleUICommand({ kind: "remove-cutting" }, {});
  assert.equal(app.coordinator.getDocumentSnapshot().plants.size, 0);
  const removed = JSON.stringify(app.arrangementSnapshot());
  const audits = app.autosaveWrites.length;
  app.store.save = () => false;
  app.handleUICommand({ kind: "undo-edit" }, {});
  assert.equal(JSON.stringify(app.arrangementSnapshot()), removed);
  assert.equal(app.coordinator.canUndo(), true);
  assert.equal(app.autosaveWrites.length, audits, "failed persistence is not a committed recovery");
  app.store.save = save;
  app.handleUICommand({ kind: "undo-edit" }, {});
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(app.selectedBranchId, "plant-1:trunk");
});

test("Undo keyboard shortcut leaves text/modals alone and cancels a held edit before undoing a commit", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  moveBase(app, .4);
  const moved = JSON.stringify(app.arrangementSnapshot());
  let prevented = 0;
  const key = { key: "z", ctrlKey: true, target: { closest: () => null }, preventDefault: () => prevented++ };
  app.handleKeyDown({ ...key, target: { closest: () => ({}) } });
  app.root.querySelector = () => ({});
  app.handleKeyDown(key);
  app.root.querySelector = () => null;
  app.handleKeyDown({ ...key, shiftKey: true });
  assert.equal(prevented, 0);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), moved);
  moveBase(app, -.7, false);
  app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
  app.handleKeyDown(key);
  assert.equal(prevented, 1);
  assert.equal(app.gesture, null);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), moved);
  app.handlePointerUp({ pointerId: 7 });
  assert.equal(writes.length, 1, "cancel and stale release write nothing");
  app.handleKeyDown({ ...key, ctrlKey: false, metaKey: true });
  assert.equal(prevented, 2);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(writes.length, 2);
});

test("working recovery survives Garden View/Return but cannot mutate kept entries or a replaced bowl", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  moveBase(app, .7);
  const kept = { arrangement: createWorkbenchFixture("leafy-shoot", 9255, 2) };
  app.viewGardenEntry(kept);
  assert.equal(app.coordinator.canUndo(), false);
  app.handleUICommand({ kind: "undo-edit" }, {});
  app.handleUICommand({ kind: "remove-cutting" }, {});
  assert.equal(writes.length, 1);
  app.returnToWorkingBowl();
  assert.equal(app.coordinator.canUndo(), true);
  assert.equal(app.coordinator.getDebugState().posture, "arrange");
  app.handleUICommand({ kind: "undo-edit" }, {});
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  moveBase(app, .7);
  app.replaceWorkingBowl(kept.arrangement);
  assert.equal(app.coordinator.canUndo(), false);
});
test("viewing a kept arrangement preserves the exact working coordinator and refuses editing", () => {
  const { app, writes } = harness();
  const original = app.coordinator;
  const before = JSON.stringify(app.arrangementSnapshot());
  const kept = { arrangement: createWorkbenchFixture("leafy-shoot", 9255, 2) };
  app.viewGardenEntry(kept);
  assert.notEqual(app.coordinator, original);
  assert.equal(app.coordinator.getDebugState().posture, "step-back");
  for (const command of [{ kind: "set-posture", posture: "arrange" }, { kind: "activate-material", materialId: "flowering-branch" }, { kind: "select-material", materialId: "bare-branch" }, { kind: "set-tool", tool: "prune" }, { kind: "undo-edit" }, { kind: "remove-cutting" }]) app.handleUICommand(command, {});
  assert.equal(app.coordinator.getDebugState().posture, "step-back");
  assert.equal(app.coordinator.getDocumentSnapshot().plants.size, 2);
  assert.throws(() => app.replaceWorkingBowl(kept.arrangement), /Return/);
  app.returnToWorkingBowl();
  assert.equal(app.coordinator, original);
  assert.equal(app.workingSession, null);
  assert.equal(app.coordinator.getDebugState().posture, "arrange");
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(writes.length, 0);
});
test("fresh/copy replacement persists before replacing memory; failure preserves current bowl", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  const original = app.coordinator;
  app.store.save = () => false;
  assert.throws(() => app.replaceWorkingBowl(null), /unchanged/);
  assert.equal(app.coordinator, original);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  app.store.save = (ordinal: number, plants: unknown) => {
    assert.equal(app.coordinator, original); writes.push({ ordinal, plants }); return true;
  };
  app.replaceWorkingBowl(null);
  assert.equal(app.coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(app.coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(writes.length, 1);
  const kept = createWorkbenchFixture("leafy-shoot", 9255, 2);
  const preserved = JSON.stringify(kept);
  app.store.save = () => true;
  app.replaceWorkingBowl(kept);
  const copiedGraph = app.coordinator.getDocumentSnapshot().plants.get("plant-1");
  copiedGraph.branches.get(copiedGraph.rootBranchId).points[0].x += 20;
  assert.equal(JSON.stringify(kept), preserved);
});
test("workbench resets fixture identity; player replacements retain a safe ordinal", () => {
  for (const workbench of [true, false]) {
    const { app } = harness(workbench);
    app.replaceWorkingBowl(createWorkbenchFixture("mixed", 8278, 12));
    app.replaceWorkingBowl(createWorkbenchFixture("leafy-shoot", 8278, 1));
    assert.equal(app.coordinator.getDebugState().successfulPlantOrdinal, workbench ? 1 : 12);
  }
});
test("a copied Garden arrangement reloads through the existing studio format", () => {
  const values = new Map<string, string>();
  const prior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    const { app } = harness();
    app.store = new CommittedStore();
    app.replaceWorkingBowl(createWorkbenchFixture("mixed", 9255, 2));
    const restored = app.loadInitialDocument();
    assert.equal(restored.plants.size, 2);
    assert.equal(restored.successfulPlantOrdinal, 2);
    assert.equal(restored.plants.get("plant-1").seed, 9255);
    app.replaceWorkingBowl(null);
    assert.equal(app.loadInitialDocument().plants.size, 0);
  } finally {
    if (prior) Object.defineProperty(globalThis, "localStorage", prior);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
