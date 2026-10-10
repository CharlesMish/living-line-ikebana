import assert from "node:assert/strict";
import test from "node:test";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { SceneCommittedStore } from "../../src/app/scenePersistence.ts";
import { DEFAULT_SCENE, type SceneSettings } from "../../src/app/scene.ts";
import { toCanonicalPlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

// Node's test runner has no DOM. These stubs exist only so the app's browser
// guards (`instanceof PointerEvent`, `instanceof Element`) can run.
if (typeof globalThis.Element === "undefined") {
  globalThis.Element = class Element {} as typeof Element;
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = { innerHeight: 800 } as unknown as Window & typeof globalThis;
}
if (typeof globalThis.PointerEvent === "undefined") {
  globalThis.PointerEvent = class PointerEvent {
    type: string;
    button = 0;
    buttons = 1;
    pointerId = 1;
    pointerType = "mouse";
    clientX = 0;
    clientY = 0;
    defaultPrevented = false;
    target: unknown = null;
    constructor(type: string, init: Record<string, unknown> = {}) {
      this.type = type;
      Object.assign(this, init);
    }
    preventDefault() { this.defaultPrevented = true; }
  } as unknown as typeof PointerEvent;
}

type Hit = "valid" | "invalid" | "none";

function memory() {
  const items = new Map<string, string>();
  const writes: string[] = [];
  return {
    items,
    writes,
    getItem(key: string) { return items.get(key) ?? null; },
    setItem(key: string, value: string) { writes.push(value); items.set(key, value); },
  };
}

function pointer(partial: Record<string, unknown> = {}) {
  return new PointerEvent("pointer", {
    button: 0,
    buttons: 1,
    pointerId: 4,
    pointerType: "mouse",
    clientX: 100,
    clientY: 200,
    target: partial.target ?? null,
    ...partial,
  });
}

function harness(options: { placeTap?: boolean; placeCue?: boolean } = {}) {
  const placeTap = options.placeTap !== false;
  const placeCue = options.placeCue ?? placeTap;
  const storage = memory();
  const store = new SceneCommittedStore("studio", "studio-legacy", () => ({
    scene: DEFAULT_SCENE,
    camera: canonicalCameraPose("front"),
  }), storage);
  assert.equal(store.load(), null);
  const statuses: string[] = [];
  const cues: string[] = [];
  const hits: { current: Hit } = { current: "valid" };
  let focused = "";
  const state: Record<string, unknown> = {
    placeReady: false,
    preventStemOverlaps: false,
    showStemOverlaps: false,
    status: "",
    cameraMode: "orbit",
    stemOverlapCount: 0,
  };
  const capture = new (class extends Element {
    closest() { return this; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
    releasePointerCapture() {}
  })();
  const saves: string[] = [];
  const coordinatorHolder: { current?: TransactionCoordinator } = {};
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    config: { placeTap, placeCue },
    bendVariant: "bead",
    bendStationsMode: "on",
    bendStationPreference: "middle",
    selectedBranchId: null,
    gesture: null,
    hovering: false,
    workingSession: null,
    placeArm: null,
    placeReadyMaterialId: null,
    suppressPlantingCue: false,
    chromeDismissPress: false,
    lastSaveSucceeded: true,
    scene: { ...DEFAULT_SCENE },
    store,
    sound: { unlock() {}, seat() {}, cut() {} },
    metrics: { resetAttempt() {} },
    canvas: capture,
    studio: {
      intersectKenzanPlane() {
        if (hits.current === "none") return null;
        if (hits.current === "invalid") return { point: { x: 4, y: 0.55, z: 4 }, valid: false };
        return { point: { x: 0.2, y: 0.55, z: -0.1 }, valid: true };
      },
      setPlantingCue(mode: string) { cues.push(mode); },
      collectHitCandidates() { throw new Error("a ready scene tap must not select"); },
      setCutPreview() {},
    },
    ui: {
      get state() { return state; },
      setState(patch: object) { Object.assign(state, patch); },
      setStatus(message: string) { statuses.push(message); state.status = message; },
      setCraftCue() {},
      focusSourceCard() { focused = "card"; },
      focusStatus() { focused = "status"; },
      root: { querySelector: () => capture },
    },
    syncPresentation() { this.syncPlantingCue(); },
    scheduleStageMeasure() {},
    applyScene(scene: SceneSettings) { this.scene = scene; },
    setupVesselUI() {},
    measureStage() {},
  });
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(),
    camera: canonicalCameraPose("front"),
    selectedPlantId: null,
    successfulPlantOrdinal: 0,
  }, {
    posture: "arrange",
    tool: "shape",
    view: "front",
    bendVariant: "bead",
    onChange: () => app.syncPresentation(),
    beforeRecoveryCommit: (event) => app.saveWorkingPlants(event.document.plants, event.document.successfulPlantOrdinal),
    onAutosave: (event) => {
      if (event.operation === "undo" || event.operation === "remove") return;
      saves.push(event.operation);
      app.saveWorkingPlants(event.document.plants, event.document.successfulPlantOrdinal);
    },
  });
  coordinatorHolder.current = coordinator;
  app.coordinator = coordinator;
  const saved = () => storage.writes.map((raw) => JSON.parse(raw) as {
    nextSuccessfulOrdinal: number;
    plants: { id: string; seed: number }[];
  });
  return {
    app, coordinator, storage, statuses, cues, hits, state, saves, saved,
    focus: () => focused,
    arm(partial: Record<string, unknown> = {}) {
      const event = pointer(partial);
      app.handleUICommand({
        kind: "arm-material-pointer",
        materialId: "flowering-branch",
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      }, event);
      return event;
    },
    release(event: PointerEvent, partial: Record<string, unknown> = {}) {
      app.handlePointerUp(pointer({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        buttons: 0,
        ...partial,
      }));
    },
  };
}

function plantsOf(coordinator: TransactionCoordinator) {
  return [...coordinator.getDocumentSnapshot().plants.values()];
}

function snapshot(coordinator: TransactionCoordinator) {
  const document = coordinator.getDocumentSnapshot();
  return {
    plants: plantsOf(coordinator).map(toCanonicalPlantGraph),
    ordinal: document.successfulPlantOrdinal,
    undo: coordinator.canUndo(),
  };
}

test("a card release inside the threshold readies and does not place, even on a valid seat", () => {
  const h = harness();
  const before = h.storage.writes.length;
  for (const travel of [0, 6, 8]) {
    const event = h.arm({ clientX: 40, clientY: 80 });
    if (travel) h.app.handlePointerMove(pointer({ clientX: 40 + travel, clientY: 80, pointerId: event.pointerId }));
    h.release(event, { clientX: 40 + travel, clientY: 80 });
    assert.equal(h.state.placeReady, true, `travel ${travel}`);
    assert.equal(h.app.placeReadyMaterialId, "flowering-branch");
    assert.equal(snapshot(h.coordinator).ordinal, 0);
    assert.equal(plantsOf(h.coordinator).length, 0);
    assert.equal(h.coordinator.canUndo(), false);
    assert.equal(h.storage.writes.length, before);
    assert.equal(h.statuses.at(-1), "Tap inside the pins to place.");
    assert.equal(h.focus(), "card");
    h.app.cancelPlaceReadiness("cancel");
  }
});

test("movement past 8 CSS pixels drags instead of readying, and release seats once", () => {
  const h = harness();
  const event = h.arm({ clientX: 10, clientY: 10 });
  h.app.handlePointerMove(pointer({ clientX: 19, clientY: 10, pointerId: event.pointerId }));
  assert.equal(h.app.gesture?.kind, "insert");
  assert.equal(plantsOf(h.coordinator).length, 0);
  assert.equal(h.coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(h.state.placeReady, false);
  h.release(event, { clientX: 19, clientY: 10 });
  const seated = snapshot(h.coordinator);
  assert.equal(seated.plants.length, 1);
  assert.equal(seated.plants[0].id, "plant-1");
  assert.equal(seated.plants[0].seed, 8278);
  assert.equal(seated.ordinal, 1);
  assert.equal(seated.undo, true);
  assert.equal(h.saves.length, 1);
  assert.equal(h.saved().length, 1);
});

test("an invalid or missed scene tap stays ready and writes nothing", () => {
  for (const hit of ["invalid", "none"] as const) {
    const h = harness();
    const event = h.arm();
    h.release(event);
    const before = {
      writes: h.storage.writes.length,
      ordinal: h.coordinator.getDebugState().successfulPlantOrdinal,
      undo: h.coordinator.canUndo(),
    };
    h.hits.current = hit;
    h.app.handleCanvasPointerDown(pointer({ pointerId: 9, clientX: 300, clientY: 300 }));
    assert.equal(h.app.placeArm?.origin, "scene");
    h.app.handlePointerUp(pointer({ pointerId: 9, clientX: 300, clientY: 300, buttons: 0 }));
    assert.equal(h.state.placeReady, true);
    assert.equal(plantsOf(h.coordinator).length, 0);
    assert.equal(h.coordinator.getDebugState().successfulPlantOrdinal, before.ordinal);
    assert.equal(h.coordinator.canUndo(), before.undo);
    assert.equal(h.storage.writes.length, before.writes);
    assert.equal(h.coordinator.getDebugState().active, null);
    assert.equal(h.statuses.at(-1), hit === "invalid"
      ? "Outside the pins. Tap inside the outline to place."
      : "Tap inside the outline to place.");
  }
});

test("card, Escape, and Cancel end readiness without a plant, counter, undo, or save", () => {
  const card = harness();
  card.release(card.arm());
  card.release(card.arm());
  assert.equal(card.state.placeReady, false);
  assert.equal(card.statuses.at(-1), "Placement cancelled.");
  assert.equal(plantsOf(card.coordinator).length, 0);

  const escape = harness();
  escape.release(escape.arm());
  escape.app.handleKeyDown({ key: "Escape", defaultPrevented: false, preventDefault() {} });
  assert.equal(escape.state.placeReady, false);
  assert.equal(escape.statuses.at(-1), "Placement cancelled.");
  assert.equal(escape.storage.writes.length, 0);
  assert.equal(escape.coordinator.canUndo(), false);

  const button = harness();
  button.release(button.arm());
  button.app.handleUICommand({ kind: "cancel-place" }, pointer());
  assert.equal(button.state.placeReady, false);
  assert.equal(button.focus(), "card");
  assert.equal(button.coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(button.storage.writes.length, 0);
});

test("Garden, material, vessel, and Step Back cancel readiness without seating", () => {
  const garden = harness();
  garden.release(garden.arm());
  garden.app.pauseForGarden();
  assert.equal(garden.state.placeReady, false);
  assert.equal(garden.app.suppressPlantingCue, true);
  assert.equal(plantsOf(garden.coordinator).length, 0);
  assert.equal(garden.storage.writes.length, 0);
  assert.equal(garden.cues.at(-1), "off");

  const material = harness();
  material.release(material.arm());
  material.app.handleUICommand({ kind: "select-material", materialId: "bare-branch" }, pointer());
  assert.equal(material.state.placeReady, false);
  assert.equal(material.state.selectedMaterialId, "bare-branch");
  assert.equal(plantsOf(material.coordinator).length, 0);
  assert.equal(material.storage.writes.length, 0);
  assert.equal(material.coordinator.canUndo(), false);

  const vessel = harness();
  vessel.release(vessel.arm());
  vessel.app.changeScene({ ...DEFAULT_SCENE, layoutId: "compact" });
  assert.equal(vessel.state.placeReady, false);
  assert.equal(vessel.coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(vessel.coordinator.canUndo(), false);
  assert.equal(vessel.saved().at(-1)?.plants.length, 0);
  assert.equal(vessel.saved().at(-1)?.nextSuccessfulOrdinal, 1);

  const stepBack = harness();
  stepBack.release(stepBack.arm());
  stepBack.app.handleUICommand({ kind: "set-posture", posture: "step-back" }, pointer());
  assert.equal(stepBack.state.placeReady, false);
  assert.equal(stepBack.coordinator.getDebugState().posture, "step-back");
  assert.equal(plantsOf(stepBack.coordinator).length, 0);
  assert.equal(stepBack.storage.writes.length, 0);
  assert.equal(stepBack.cues.at(-1), "off");
});

test("blur, hiding, resize, and pointercancel do not seat a pending cutting", () => {
  const blur = harness();
  const armed = blur.arm();
  blur.app.handleWindowBlur();
  assert.equal(blur.app.placeArm, null);
  assert.equal(blur.state.placeReady, false);
  blur.release(armed);
  assert.equal(plantsOf(blur.coordinator).length, 0);
  blur.release(blur.arm());
  blur.app.handleWindowBlur();
  assert.equal(blur.state.placeReady, false);
  assert.equal(blur.statuses.at(-1), "Placement cancelled.");
  assert.equal(blur.storage.writes.length, 0);

  const hidden = harness();
  hidden.release(hidden.arm());
  hidden.app.notePageHidden();
  assert.equal(hidden.state.placeReady, false);
  assert.equal(hidden.coordinator.canUndo(), false);

  const resized = harness();
  resized.release(resized.arm());
  resized.app.noteViewportChange();
  assert.equal(resized.state.placeReady, false);
  assert.equal(resized.storage.writes.length, 0);

  const cardCancel = harness();
  const press = cardCancel.arm({ pointerId: 6 });
  cardCancel.app.handlePointerCancel(pointer({ pointerId: press.pointerId }));
  assert.equal(cardCancel.state.placeReady, false);
  cardCancel.release(press);
  assert.equal(plantsOf(cardCancel.coordinator).length, 0);

  const sceneCancel = harness();
  sceneCancel.release(sceneCancel.arm());
  sceneCancel.app.handleCanvasPointerDown(pointer({ pointerId: 11, clientX: 12, clientY: 12 }));
  sceneCancel.app.handlePointerCancel(pointer({ pointerId: 11 }));
  assert.equal(sceneCancel.state.placeReady, true);
  assert.equal(sceneCancel.app.placeArm, null);
  assert.equal(plantsOf(sceneCancel.coordinator).length, 0);
  assert.equal(sceneCancel.statuses.at(-1), "Tap inside the pins to place.");
});

test("a scene tap seats one plant through the same save and undo as a drag", () => {
  const tap = harness();
  tap.release(tap.arm());
  assert.equal(tap.cues.at(-1), "strong");
  tap.app.handleCanvasPointerDown(pointer({ pointerId: 2, clientX: 480, clientY: 360 }));
  tap.app.handlePointerUp(pointer({ pointerId: 2, clientX: 480, clientY: 360, buttons: 0 }));
  const tapShot = snapshot(tap.coordinator);
  assert.equal(tapShot.plants.length, 1);
  assert.equal(tapShot.plants[0].id, "plant-1");
  assert.equal(tapShot.plants[0].seed, 8278);
  assert.equal(tapShot.ordinal, 1);
  assert.equal(tapShot.undo, true);
  assert.deepEqual(tap.saves, ["insert"]);
  assert.equal(tap.saved().length, 1);
  assert.equal(tap.saved()[0].nextSuccessfulOrdinal, 2);
  assert.equal(tap.state.placeReady, false);
  assert.equal(tap.focus(), "status");
  assert.equal(tap.cues.at(-1), "quiet");
  tap.app.handlePointerUp(pointer({ pointerId: 2, clientX: 480, clientY: 360, buttons: 0 }));
  assert.equal(plantsOf(tap.coordinator).length, 1);
  assert.equal(tap.saves.length, 1);

  const drag = harness();
  const event = drag.arm({ clientX: 0, clientY: 0 });
  drag.app.handlePointerMove(pointer({ clientX: 20, clientY: 0, pointerId: event.pointerId }));
  drag.release(event, { clientX: 20, clientY: 0 });
  assert.deepEqual(snapshot(drag.coordinator).plants, tapShot.plants);
  assert.equal(drag.saves.length, 1);
  assert.equal(drag.saved()[0].nextSuccessfulOrdinal, 2);
});

test("undo removes the tap placement and persists that; reloading the placement save restores it", () => {
  const h = harness();
  h.release(h.arm());
  h.app.handleCanvasPointerDown(pointer({ pointerId: 3, clientX: 220, clientY: 260 }));
  h.app.handlePointerUp(pointer({ pointerId: 3, clientX: 220, clientY: 260, buttons: 0 }));
  const placed = h.storage.items.get("studio");
  assert.ok(placed);
  h.app.handleUICommand({ kind: "undo-edit" }, pointer());
  assert.equal(plantsOf(h.coordinator).length, 0);
  assert.equal(h.coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(h.coordinator.canUndo(), false);
  const undone = h.saved().at(-1)!;
  assert.equal(undone.plants.length, 0);
  assert.equal(undone.nextSuccessfulOrdinal, 2);
  const afterUndo = new SceneCommittedStore("studio", "studio-legacy", () => ({
    scene: DEFAULT_SCENE,
    camera: canonicalCameraPose("front"),
  }), h.storage).load();
  assert.equal(afterUndo?.plants.length, 0);
  assert.equal(afterUndo?.nextSuccessfulOrdinal, 2);

  h.storage.items.set("studio", placed!);
  const restored = new SceneCommittedStore("studio", "studio-legacy", () => ({
    scene: DEFAULT_SCENE,
    camera: canonicalCameraPose("front"),
  }), h.storage).load();
  assert.equal(restored?.plants.length, 1);
  assert.equal(restored?.plants[0].id, "plant-1");
  assert.equal(restored?.plants[0].seed, 8278);
  assert.equal(restored?.nextSuccessfulOrdinal, 2);
});

test("keyboard activation still seats once, and a scene drag past the threshold does not place", () => {
  const keyboard = harness();
  keyboard.release(keyboard.arm());
  keyboard.app.handleUICommand({ kind: "activate-material", materialId: "flowering-branch" }, pointer());
  assert.equal(plantsOf(keyboard.coordinator).length, 1);
  assert.equal(keyboard.coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(keyboard.state.placeReady, false);
  assert.equal(keyboard.saves.length, 1);

  const slipped = harness();
  slipped.release(slipped.arm());
  slipped.app.handleCanvasPointerDown(pointer({ pointerId: 15, clientX: 50, clientY: 50 }));
  slipped.app.handlePointerMove(pointer({ pointerId: 15, clientX: 70, clientY: 50 }));
  slipped.app.handlePointerUp(pointer({ pointerId: 15, clientX: 70, clientY: 50, buttons: 0 }));
  assert.equal(slipped.state.placeReady, true);
  assert.equal(plantsOf(slipped.coordinator).length, 0);
  assert.equal(slipped.storage.writes.length, 0);
  assert.equal(slipped.statuses.at(-1), "Tap inside the pins to place.");
});

test("Angles keeps a ready cutting; ordinary play ignores the arm and still drags immediately", () => {
  const angles = harness();
  angles.release(angles.arm());
  angles.app.handleUICommand({ kind: "set-view", view: "three-quarter" }, pointer());
  assert.equal(angles.state.placeReady, true);
  assert.equal(plantsOf(angles.coordinator).length, 0);
  assert.equal(angles.storage.writes.filter((raw) => JSON.parse(raw).plants.length > 0).length, 0);

  const ordinary = harness({ placeTap: false, placeCue: false });
  ordinary.arm();
  assert.equal(ordinary.app.placeArm, null);
  assert.equal(ordinary.state.placeReady, false);
  const event = pointer({ pointerId: 21, clientX: 8, clientY: 8, target: ordinary.app.canvas });
  ordinary.app.handleUICommand({
    kind: "begin-material-drag",
    materialId: "flowering-branch",
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  }, event);
  assert.equal(ordinary.app.gesture?.kind, "insert");
  assert.equal(plantsOf(ordinary.coordinator).length, 0);
  ordinary.release(event);
  assert.equal(plantsOf(ordinary.coordinator).length, 1);
  assert.equal(ordinary.saves.length, 1);
  assert.equal(ordinary.cues.length, 0);
});

test("a press that only closes chrome does not seat, and a mouse release without buttons does not ready", () => {
  const menu = harness();
  menu.release(menu.arm());
  menu.app.chromeDismissPress = true;
  menu.app.handleCanvasPointerDown(pointer({ pointerId: 31, clientX: 10, clientY: 10 }));
  assert.equal(menu.app.placeArm, null);
  menu.app.handlePointerUp(pointer({ pointerId: 31, clientX: 10, clientY: 10, buttons: 0 }));
  assert.equal(menu.state.placeReady, true);
  assert.equal(plantsOf(menu.coordinator).length, 0);

  const slip = harness();
  const event = slip.arm({ pointerId: 32 });
  slip.app.handlePointerMove(pointer({ pointerId: event.pointerId, buttons: 0, pointerType: "mouse" }));
  assert.equal(slip.app.placeArm, null);
  slip.release(event);
  assert.equal(slip.state.placeReady, false);
  assert.equal(plantsOf(slip.coordinator).length, 0);
});
