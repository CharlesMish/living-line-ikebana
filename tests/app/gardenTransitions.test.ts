import { DEFAULT_SCENE, sceneProfile } from "../../src/app/scene.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { fromCanonicalPlantGraph, sampleBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { CommittedStore } from "../../src/app/persistence.ts";
import { turnCutting } from "../../src/core/turnCutting.ts";
import { SceneCommittedStore } from "../../src/app/scenePersistence.ts";

function harness(workbench = false) {
  const writes: unknown[] = [];
  const state = { posture: "arrange", tool: "shape", view: "front", cameraMode: "orbit", workingSavePending: false, canRetryWorkingSave: false };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    scene: { ...DEFAULT_SCENE }, applyScene(value: any) { this.scene = structuredClone(value); this.config.vesselProfile = sceneProfile(value); },
    photoDraftContext: 0, workingSession: null, config: { workbench }, bendVariant: "bead", selectedBranchId: "plant-1:trunk", cameraIsFree: false,
    hovering: false, gesture: null, autosaveWrites: [], workingSavePending: false, lastSaveSucceeded: true,
    root: { querySelector: () => null },
    sound: { unlock() {} }, telemetryStore: { clear() {} },
    metrics: { resetAttempt() {} }, resolvePendingAcquisition() {}, syncPresentation() {},
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus: (status: string, statusTone = "quiet") => Object.assign(state, { status, statusTone }) },
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

test("working backdrop is saved before apply, cancels a live edit, and preserves plants, camera, Undo and photo ownership", () => {
  for (const posture of ["arrange", "step-back"]) {
    const { app } = harness();
    app.setupVesselUI = () => {};
    moveBase(app, .4);
    app.coordinator.commandPosture(posture);
    const coordinator = app.coordinator, before = app.arrangementSnapshot();
    const storage = new Map<string, string>(); let writes = 0;
    const store = new SceneCommittedStore("backdrop-working", undefined, () => ({ scene: app.scene, camera: before.camera }), {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) {
        assert.equal(app.scene.backdropId, "paper", "save must precede visual apply");
        assert.equal(coordinator.getDebugState().active, null, "save contains committed plants only");
        writes++; storage.set(key, value);
      },
    });
    store.load(); app.store = store;
    if (posture === "arrange") {
      moveBase(app, -.7, false);
      app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
    }
    assert.equal(app.changeScene({ ...app.scene, backdropId: "hills" }), true);
    assert.equal(app.coordinator, coordinator); assert.equal(coordinator.canUndo(), true);
    assert.equal(coordinator.getDebugState().posture, posture);
    assert.equal(app.photoDraftContext, 0); assert.equal(writes, 1);
    assert.equal(app.coordinator.release(7).ok, false);
    assert.deepEqual(app.arrangementSnapshot(), { ...before, scene: { ...before.scene, backdropId: "hills" } });
    assert.equal(JSON.stringify(store.load()?.plants), JSON.stringify(before.plants)); assert.deepEqual(store.loaded?.camera, before.camera);
    assert.equal(store.loaded?.scene.backdropId, "hills"); assert.equal(store.loaded?.nextSuccessfulOrdinal, before.successfulPlantOrdinal + 1);
  }
});

test("failed backdrop save and read-only Garden viewing cannot change the working scene", () => {
  const { app, snapshot } = harness(); let refreshed = 0;
  app.setupVesselUI = () => { refreshed++; };
  const before = app.arrangementSnapshot(); app.store.save = () => false;
  moveBase(app, -.7, false);
  app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
  assert.equal(app.changeScene({ ...app.scene, backdropId: "ink" }), false);
  assert.deepEqual(app.arrangementSnapshot(), before); assert.equal(refreshed, 1);
  assert.equal(app.coordinator.release(7).ok, false); assert.equal(app.photoDraftContext, 0);
  app.viewGardenEntry({ id: "kept", title: "Kept", arrangement: snapshot });
  const viewed = app.arrangementSnapshot();
  app.store.save = () => { throw new Error("read-only viewing must not save"); };
  assert.equal(app.changeScene({ ...app.scene, backdropId: "sage" }), false);
  assert.deepEqual(app.arrangementSnapshot(), viewed);
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

test("app Turn cancels any preview, saves once before replacing geometry, and preserves Undo on save failure", () => {
  const { app, writes } = harness();
  app.coordinator.commandSelection("plant-1");
  const before = app.coordinator.getDocumentSnapshot();
  const beforeGraph = before.plants.get("plant-1");
  moveBase(app, -.8, false);
  app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
  const save = app.store.save;
  app.store.save = (ordinal: number, plants: unknown) => {
    assert.deepEqual(app.coordinator.getDocumentSnapshot(), before, "disk write precedes the turn");
    return save(ordinal, plants);
  };
  app.handleUICommand({ kind: "turn-cutting", direction: "right" }, {});
  assert.equal(app.gesture, null); assert.equal(app.coordinator.release(7).ok, false);
  assert.equal(writes.length, 1, "one successful prewrite, no duplicate autosave");
  const turned = app.coordinator.getDocumentSnapshot();
  assert.deepEqual(turned.plants.get("plant-1"), turnCutting(beforeGraph, Math.PI / 12), "turn starts at committed geometry, not the cancelled base preview");
  assert.deepEqual(turned.camera, before.camera); assert.equal(turned.successfulPlantOrdinal, before.successfulPlantOrdinal);
  app.store.save = () => false;
  app.handleUICommand({ kind: "turn-cutting", direction: "left" }, {});
  assert.deepEqual(app.coordinator.getDocumentSnapshot(), turned);
  assert.equal(app.coordinator.canUndo(), true); assert.equal(app.autosaveWrites.length, 1);
  app.store.save = save;
  app.handleUICommand({ kind: "undo-edit" }, {});
  assert.deepEqual(app.coordinator.getDocumentSnapshot(), before);
  assert.equal(writes.length, 2);
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
  for (const command of [{ kind: "set-posture", posture: "arrange" }, { kind: "activate-material", materialId: "flowering-branch" }, { kind: "select-material", materialId: "bare-branch" }, { kind: "set-tool", tool: "prune" }, { kind: "undo-edit" }, { kind: "remove-cutting" }, { kind: "turn-cutting", direction: "right" }]) app.handleUICommand(command, {});
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

test("protection toggles cancel before changing policy; Garden returns the same working protection instance",()=>{
 const {app,writes,snapshot}=harness();
 const initial=JSON.stringify(app.arrangementSnapshot());
 app.handleUICommand({kind:'set-stem-prevention',enabled:true},{});
 const working=app.coordinator, protection=app.preventionByCoordinator.get(working);
 moveBase(app,.7,false);
 app.gesture={kind:'base',owner:7,capture:{hasPointerCapture:()=>false}};
 app.handleUICommand({kind:'set-stem-prevention',enabled:false},{});
 assert.equal(app.gesture,null);assert.equal(working.getDebugState().active,null);
 assert.equal(working.release(7).ok,false);assert.equal(writes.length,0);
 assert.equal(JSON.stringify(app.arrangementSnapshot()),initial);
 app.handleUICommand({kind:'set-stem-prevention',enabled:true},{});
 app.viewGardenEntry({id:'test-entry',title:'Test',arrangement:snapshot});
 assert.equal(protection.enabled(),false,'kept viewing cannot edit');
 app.returnToWorkingBowl();
 assert.equal(app.coordinator,working);assert.equal(app.preventionByCoordinator.get(working),protection);
 assert.equal(protection.enabled(),true);assert.equal(writes.length,0);
});

test("camera autosave preserves the released telemetry outcome and never resolves it as a graph commit", () => {
  const {app,writes}=harness(); const outcomes: string[]=[];
  app.resolvePendingAcquisition=(outcome: string)=>outcomes.push(outcome);
  app.coordinator.commandPosture("step-back");
  const pose=app.coordinator.getDocumentSnapshot().camera;
  const moved={...pose,position:{...pose.position,x:pose.position.x+.5},target:{...pose.target,x:pose.target.x+.5}};
  assert.equal(app.coordinator.beginCamera(7,{}, {pose:moved}).ok,true);
  app.gesture={kind:"camera",owner:7,pointers:new Map([[7,{x:0,y:0}]]),capture:{hasPointerCapture:()=>false},startCameraIsFree:false};
  app.handlePointerUp({pointerId:7,preventDefault(){}});
  assert.equal(writes.length,1);assert.deepEqual(outcomes,["released"]);
  assert.deepEqual(app.coordinator.getDocumentSnapshot().camera,moved);
});

test("a65-cutting legacy working bowl can change scene without becoming a Garden-sized document", () => {
 const {app}=harness();
 const graph=app.coordinator.getDocumentSnapshot().plants.get("plant-1");
 const many=new Map();for(let i=1;i<=65;i++) {
  const source=JSON.stringify(toCanonicalPlantGraph(graph));
  const canonical=JSON.parse(source.replaceAll("plant-1",`plant-${i}`));many.set(canonical.id,fromCanonicalPlantGraph(canonical));
 }
 app.replaceCoordinator(many,65);let savedCount=0;
 app.store.save=(_ordinal: number, plants: unknown[])=>{savedCount=plants.length;return true;};
 app.setupVesselUI=()=>{};
 app.changeScene({...DEFAULT_SCENE,colorId:"celadon"});
 assert.equal(savedCount,65);assert.equal(app.arrangementSnapshot().plants.length,65);
});

test("photo draft context survives ordinary edits, cancellation and Garden inspection; replacement advances only after save", () => {
  const { app, snapshot } = harness();
  assert.equal(app.photoDraftContext, 0);
  moveBase(app, .4); assert.equal(app.photoDraftContext, 0);
  moveBase(app, -.4, false);
  app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
  app.pauseForGarden(); assert.equal(app.photoDraftContext, 0); assert.equal(app.coordinator.getDebugState().active, null);
  app.viewGardenEntry({ id: "photo-view", title: "A kept moment", arrangement: snapshot });
  assert.equal(app.photoDraftContext, 0); app.returnToWorkingBowl(); assert.equal(app.photoDraftContext, 0);
  app.store.save = () => false;
  assert.throws(() => app.replaceWorkingBowl(null), /could not be saved/); assert.equal(app.photoDraftContext, 0);
  app.store.save = () => true;
  app.replaceWorkingBowl(null); assert.equal(app.photoDraftContext, 1);
  app.replaceWorkingBowl(snapshot); assert.equal(app.photoDraftContext, 2);
});

test("failed committed autosave stays visible across ordinary hints; Retry saves the committed bowl without changing Undo or ordinal", () => {
  const { app, writes } = harness();
  const save = app.store.save;
  app.store.save = () => false;
  moveBase(app, .7);
  const beforeRetry = app.coordinator.getDocumentSnapshot();
  assert.equal(app.workingSavePending, true); assert.equal(app.ui.state.workingSavePending, true);
  assert.equal(app.coordinator.canUndo(), true);
  app.handleUICommand({ kind: "set-tool", tool: "prune" }, {});
  assert.equal(app.ui.state.status, "Choose where to cut.");
  assert.equal(app.ui.state.workingSavePending, true);
  app.handleUICommand({ kind: "retry-working-save" }, {});
  assert.equal(app.ui.state.workingSavePending, true); assert.deepEqual(app.coordinator.getDocumentSnapshot(), beforeRetry);
  assert.equal(app.coordinator.canUndo(), true); assert.equal(writes.length, 0);
  app.store.save = save;
  app.handleUICommand({ kind: "retry-working-save" }, {});
  assert.equal(app.workingSavePending, false); assert.equal(app.ui.state.workingSavePending, false);
  assert.equal(app.ui.state.canRetryWorkingSave, false); assert.match(app.ui.state.status, /saved on this device/);
  assert.deepEqual(app.coordinator.getDocumentSnapshot(), beforeRetry); assert.equal(app.coordinator.canUndo(), true);
  assert.deepEqual(writes, [{ ordinal: beforeRetry.successfulPlantOrdinal + 1, plants: [...beforeRetry.plants.values()].map(toCanonicalPlantGraph) }]);
  app.handleUICommand({ kind: "retry-working-save" }, {}); assert.equal(writes.length, 1, "idle retry has no work");
});

test("Retry cancels a held edit and a readied insertion before reading the committed snapshot", () => {
  const { app, writes } = harness();
  const save = app.store.save;
  app.store.save = () => false; moveBase(app, .7);
  const committed = app.coordinator.getDocumentSnapshot();
  moveBase(app, -.8, false);
  app.gesture = { kind: "base", owner: 7, capture: { hasPointerCapture: () => false } };
  app.placeReadyMaterialId = "reed"; app.ui.setState({ placeReady: true });
  app.store.save = (ordinal: number, plants: unknown) => {
    assert.equal(app.coordinator.getDebugState().active, null);
    assert.equal(app.placeReadyMaterialId, null);
    assert.deepEqual(app.coordinator.getDocumentSnapshot(), committed);
    return save(ordinal, plants);
  };
  app.handleUICommand({ kind: "retry-working-save" }, {});
  assert.equal(app.gesture, null); assert.equal(app.ui.state.placeReady, false);
  assert.equal(app.coordinator.release(7).ok, false); assert.equal(writes.length, 1);
  assert.deepEqual(app.coordinator.getDocumentSnapshot(), committed); assert.equal(app.coordinator.canUndo(), true);
});

test("failed save-first commands do not invent pending changes and never clear earlier unsaved work", () => {
  for (const pending of [false, true]) {
    const { app, snapshot } = harness();
    app.setupVesselUI = () => {};
    if (pending) app.store.save = () => false;
    moveBase(app, .7);
    app.store.save = () => false;
    const current = app.coordinator.getDocumentSnapshot();
    for (const kind of ["undo-edit", "remove-cutting", "turn-cutting"]) {
      app.handleUICommand({ kind, direction: "right" }, {});
      assert.equal(app.workingSavePending, pending, `${kind}, prior pending=${pending}`);
      assert.deepEqual(app.coordinator.getDocumentSnapshot(), current); assert.equal(app.coordinator.canUndo(), true);
    }
    app.changeScene({ ...DEFAULT_SCENE, colorId: "celadon" });
    assert.equal(app.workingSavePending, pending); assert.deepEqual(app.scene, DEFAULT_SCENE);
    for (const replacement of [null, snapshot]) {
      assert.throws(() => app.replaceWorkingBowl(replacement), /could not be saved/);
      assert.equal(app.workingSavePending, pending); assert.deepEqual(app.coordinator.getDocumentSnapshot(), current);
    }
  }
});

test("a successful complete scene or replacement save clears pending working changes", () => {
  for (const operation of ["scene", "fresh", "copy", "undo", "commit"]) {
    const { app, snapshot } = harness();
    app.setupVesselUI = () => {};
    app.store.save = () => false; moveBase(app, .7);
    assert.equal(app.workingSavePending, true);
    app.store.save = () => true;
    if (operation === "scene") app.changeScene({ ...DEFAULT_SCENE, colorId: "celadon" });
    else if (operation === "undo") app.handleUICommand({ kind: "undo-edit" }, {});
    else if (operation === "commit") moveBase(app, -.6);
    else app.replaceWorkingBowl(operation === "fresh" ? null : snapshot);
    assert.equal(app.workingSavePending, false, operation); assert.equal(app.ui.state.workingSavePending, false);
  }
});

test("Garden viewing cannot retry-save a kept document over the unsaved working bowl", () => {
  const { app, writes } = harness();
  const save = app.store.save;
  app.store.save = () => false; moveBase(app, .7);
  const working = app.coordinator, committed = working.getDocumentSnapshot();
  app.store.save = save;
  app.pauseForGarden(); assert.equal(app.workingSavePending, true);
  app.viewGardenEntry({ arrangement: createWorkbenchFixture("leafy-shoot", 9255, 2) });
  assert.equal(app.ui.state.workingSavePending, true); assert.equal(app.ui.state.canRetryWorkingSave, false);
  app.handleUICommand({ kind: "retry-working-save" }, {});
  assert.equal(writes.length, 0); assert.equal(app.workingSavePending, true); assert.equal(app.coordinator.getDocumentSnapshot().plants.size, 2);
  assert.deepEqual(working.getDocumentSnapshot(), committed);
  app.returnToWorkingBowl(); assert.equal(app.ui.state.canRetryWorkingSave, true);
  app.handleUICommand({ kind: "retry-working-save" }, {});
  assert.equal(writes.length, 1); assert.equal(app.workingSavePending, false);
  assert.deepEqual(app.coordinator.getDocumentSnapshot(), committed);
});
