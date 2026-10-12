import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { bakedBegin, beginFlagsFrom, readExperimentConfig } from "../../src/app/config.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import {
  BEGIN_INVITATIONS,
  BEGIN_LINES,
  beginLineSnapshot,
  insertBeginLine,
  planBeginSeat,
  realizeBeginLine,
} from "../../src/app/beginLines.ts";
import {
  BEGIN_STUDY_KEY,
  BeginSession,
  beginEventToken,
  nextStartPlantSignal,
  type BeginStorage,
} from "../../src/app/beginStudy.ts";
import { parseSceneStudio, sceneStorageKeys } from "../../src/app/scenePersistence.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { getMaterialDefinition, successfulSeatIdentity, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

function memory(): BeginStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

function session(kind: "line" | "for", seed: number, storage = memory()) {
  let tick = 0;
  const begun = new BeginSession({ kind, seed, storage, now: () => `t${tick += 1}` });
  return { begun, storage };
}

function coordinator() {
  return new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(),
    camera: canonicalCameraPose("front"),
    selectedPlantId: null,
    successfulPlantOrdinal: 0,
  }, { beforeRecoveryCommit: () => true });
}

const canonical = (id: string) => JSON.stringify(beginLineSnapshot(id).plants[0]);

test("the same starting line is an identical ordinary plant", () => {
  assert.equal(BEGIN_LINES.length, 4);
  const identity = successfulSeatIdentity(1);
  assert.equal(identity.seed, 8278);
  const seen = new Set<string>();
  for (const line of BEGIN_LINES) {
    const material = getMaterialDefinition(line.materialId);
    assert.ok(material, line.materialId);
    const first = realizeBeginLine(line.id);
    const second = realizeBeginLine(line.id);
    assert.equal(first.id, "plant-1");
    assert.equal(first.seed, identity.seed);
    assert.equal(first.generatorVersion, material.generator.generatorVersion);
    assert.equal(canonical(line.id), JSON.stringify(toCanonicalPlantGraph(second)));
    const snapshot = beginLineSnapshot(line.id);
    assert.equal(snapshot.successfulPlantOrdinal, 1);
    assert.equal(snapshot.plants.length, 1);
    seen.add(canonical(line.id));
    const root = first.branches.get(first.rootBranchId)!;
    const base = root.points[0];
    assert.ok(Math.hypot(base.x, base.z) < 1.15, line.id);
  }
  assert.equal(seen.size, 4);
  const pose = (id: string) => {
    const graph = realizeBeginLine(id);
    const root = graph.branches.get(graph.rootBranchId)!;
    return { base: root.points[0], tip: root.points[root.points.length - 1] };
  };
  const poses = Object.fromEntries(BEGIN_LINES.map((line) => [line.id, pose(line.id)]));
  assert.ok(poses["lean-left"].tip.x < -1 && poses["lean-left"].tip.y > 3, JSON.stringify(poses));
  assert.ok(poses["reed-forward"].tip.y < 2.2 && poses["reed-forward"].tip.z > 2, JSON.stringify(poses));
  assert.ok(poses["flower-back"].base.z < -0.3 && poses["flower-back"].tip.y > 4, JSON.stringify(poses));
  assert.ok(poses["bare-arc"].tip.x > 1.4 && poses["bare-arc"].tip.x < 4, JSON.stringify(poses));
});

test("a seated line can be aimed, pruned, undone, and removed", () => {
  const aimed = coordinator();
  assert.equal(insertBeginLine(aimed, "lean-left").ok, true);
  const plantId = "plant-1";
  const original = JSON.stringify(toCanonicalPlantGraph(aimed.getDocumentSnapshot().plants.get(plantId)!));
  assert.equal(original, canonical("lean-left"));
  const graph = aimed.getDocumentSnapshot().plants.get(plantId)!;
  const branchId = graph.rootBranchId;
  assert.equal(aimed.beginAim(1, {
    plantId, branchId, grabbedMaterialDistance: graph.branches.get(branchId)!.activeLength * 0.7, context: {},
  }, { target: { x: 1.4, y: 3.2, z: -0.4 } }).ok, true);
  assert.equal(aimed.release(1).ok, true);
  assert.notEqual(JSON.stringify(toCanonicalPlantGraph(aimed.getDocumentSnapshot().plants.get(plantId)!)), original);
  assert.equal(aimed.commandUndo().ok, true);
  assert.equal(JSON.stringify(toCanonicalPlantGraph(aimed.getDocumentSnapshot().plants.get(plantId)!)), original);

  aimed.commandTool("prune");
  const length = aimed.getDocumentSnapshot().plants.get(plantId)!.branches.get(branchId)!.activeLength;
  assert.equal(aimed.beginPrune(2, {
    plantId, branchId, acquiredMaterialDistance: length * 0.45, context: {},
  }, { distance: length * 0.45 }).ok, true);
  assert.equal(aimed.release(2).ok, true);
  assert.notEqual(JSON.stringify(toCanonicalPlantGraph(aimed.getDocumentSnapshot().plants.get(plantId)!)), original);
  assert.equal(aimed.commandUndo().ok, true);
  assert.equal(JSON.stringify(toCanonicalPlantGraph(aimed.getDocumentSnapshot().plants.get(plantId)!)), original);

  const removed = coordinator();
  assert.equal(insertBeginLine(removed, "flower-back").ok, true);
  assert.equal(removed.getDocumentSnapshot().selectedPlantId, plantId);
  assert.equal(removed.commandRemoveSelected().ok, true);
  assert.equal(removed.getDocumentSnapshot().plants.size, 0);
  assert.equal(removed.getDebugState().successfulPlantOrdinal, 1);
});

test("a non-empty bowl is only a prompt, and an empty bowl is not overwritten by planning", () => {
  const prompt = planBeginSeat("reed-forward", 2, 4);
  assert.equal(prompt.mode, "prompt");
  assert.equal(prompt.snapshot.plants[0].id, "plant-1");
  assert.equal(planBeginSeat("reed-forward", 0, 1).mode, "insert");
  assert.equal(planBeginSeat("reed-forward", 0, 3).mode, "replace");
  const again = planBeginSeat("reed-forward", 2, 4);
  assert.equal(JSON.stringify(again.snapshot.plants), JSON.stringify(prompt.snapshot.plants));
});

test("opening and after-keep cursors advance independently and skip the item just used", () => {
  const first = session("line", 0);
  const second = session("line", 1);
  assert.equal(first.begun.item("opening").id, "lean-left");
  assert.equal(second.begun.item("opening").id, "reed-forward");
  assert.notEqual(first.begun.item("opening").id, second.begun.item("opening").id);
  assert.equal(first.begun.item("after-keep").id, first.begun.item("opening").id);

  first.begun.another("opening");
  assert.equal(first.begun.item("opening").id, "reed-forward");
  assert.equal(first.begun.item("after-keep").id, "lean-left");
  first.begun.recordPressed("reed-forward", "opening");
  first.begun.recordBegin("reed-forward", "opening");
  first.begun.commitUse("reed-forward");
  assert.notEqual(first.begun.item("opening").id, "reed-forward");
  assert.notEqual(first.begun.item("after-keep").id, "reed-forward");

  const kept = session("for", 0);
  kept.begun.another("after-keep");
  assert.equal(kept.begun.item("after-keep").id, "table");
  assert.equal(kept.begun.item("opening").id, "windowsill");
  kept.begun.another("after-keep");
  assert.equal(kept.begun.snapshot().events.filter((event) => event.type === "another").at(-1)?.type, "another");
  const last = kept.begun.snapshot().events.at(-1);
  assert.equal(last?.type, "another");
  if (last?.type === "another") assert.notEqual(last.from, last.to);
});

test("each press is stored on the begin key and as the last event token", () => {
  const { begun, storage } = session("line", 0);
  begun.noteShown("opening", begun.item("opening").id);
  begun.noteShown("opening", begun.item("opening").id);
  begun.recordPressed("lean-left", "opening");
  begun.recordBegin("lean-left", "opening");
  begun.another("opening");
  begun.notNow("opening");
  begun.afterKeepArmed = true;
  begun.noteShown("after-keep", begun.item("after-keep").id);
  begun.stop();
  begun.rememberSeat("lean-left", "plant-1");
  begun.recordEdited();
  begun.recordRemoved();
  const events = begun.snapshot().events.map((event) => event.type);
  assert.deepEqual(events, [
    "offer-shown", "begin-pressed", "begin", "another", "not-now", "offer-shown", "stop", "start-edited", "start-removed",
  ]);
  assert.equal(begun.token(), "start-removed:lean-left:plant-1");
  assert.equal(beginEventToken(begun.snapshot().events[2]), "begin:lean-left");
  assert.equal(beginEventToken(begun.snapshot().events[1]), "begin-pressed:lean-left");
  const cancelled = session("line", 1);
  cancelled.begun.recordPressed("reed-forward", "after-keep");
  cancelled.begun.recordCancelled("reed-forward", "after-keep");
  assert.deepEqual(cancelled.begun.snapshot().events.map((event) => event.type), ["begin-pressed", "begin-cancelled"]);
  assert.equal(cancelled.begun.token(), "begin-cancelled:reed-forward");
  assert.equal(cancelled.begun.item("after-keep").id, "reed-forward");
  assert.equal(storage.values.has(BEGIN_STUDY_KEY), true);
  assert.equal(JSON.parse(storage.values.get(BEGIN_STUDY_KEY)!).version, 1);

  const invited = session("for", 2);
  invited.begun.recordPressed("autumn", "opening");
  invited.begun.recordBegin("autumn", "opening");
  invited.begun.chooseInvitation("autumn");
  invited.begun.toggleNote();
  const reloaded = new BeginSession({ kind: "for", seed: 0, storage: invited.storage, now: () => "later" });
  assert.equal(reloaded.chosenInvitation()?.id, "autumn");
  assert.equal(reloaded.noteCollapsed(), true);
  assert.deepEqual(
    reloaded.snapshot().events.map((event) => event.type).filter((type) => type.startsWith("note-")),
    ["note-closed"],
  );
  reloaded.toggleNote();
  assert.equal(reloaded.snapshot().events.at(-1)?.type, "note-opened");
});

test("a start plant logs an edit or a removal once", () => {
  const adopted = nextStartPlantSignal({ canonical: null, removalLogged: false }, "pose-a");
  assert.equal(adopted.signal, null);
  const edited = nextStartPlantSignal({ canonical: "pose-a", removalLogged: false }, "pose-b");
  assert.equal(edited.signal, "edited");
  const same = nextStartPlantSignal(edited, "pose-b");
  assert.equal(same.signal, null);
  const removed = nextStartPlantSignal(same, null, "remove");
  assert.equal(removed.signal, "removed");
  assert.equal(nextStartPlantSignal(removed, null, "remove").signal, null);
  const restored = nextStartPlantSignal(removed, "pose-b", "undo");
  assert.equal(restored.signal, "restored");
  assert.equal(restored.canonical, "pose-b");
  const seated = nextStartPlantSignal({ canonical: "pose-a", removalLogged: false }, null, "undo");
  assert.equal(seated.signal, "undone");
  assert.equal(nextStartPlantSignal(seated, null, "undo").signal, null);
});

test("an offer still on screen is not logged again", () => {
  const { begun, storage } = session("line", 0);
  begun.noteShown("opening", "lean-left");
  begun.noteShown("opening", "lean-left");
  begun.another("opening");
  begun.noteShown("opening", "reed-forward");
  const shown = begun.snapshot().events.filter((event) => event.type === "offer-shown");
  assert.equal(shown.length, 2);
  assert.equal(shown[0].type, "offer-shown");
  assert.equal("reshow" in shown[0], false);
  assert.equal(shown[1].type, "offer-shown");
  if (shown[1].type === "offer-shown") {
    assert.equal(shown[1].itemId, "reed-forward");
    assert.equal(shown[1].reshow, undefined);
  }

  const again = new BeginSession({ kind: "line", seed: 0, storage, now: () => "reload" });
  again.noteShown("opening", "lean-left");
  again.noteShown("opening", "lean-left");
  const reloaded = again.snapshot().events.filter((event) => event.type === "offer-shown" && event.at === "reload");
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].type, "offer-shown");
  if (reloaded[0].type === "offer-shown") assert.equal(reloaded[0].reshow, true);
  assert.equal(again.openingDismissed, false);
});

test("reshow marks only an item already in the log, including a return in the same page view", () => {
  const { begun } = session("line", 0);
  begun.noteShown("opening", "lean-left");
  begun.another("opening");
  begun.noteShown("opening", "reed-forward");
  begun.clearShown();
  begun.noteShown("opening", "flower-back");
  const firsts = begun.snapshot().events.filter((event) => event.type === "offer-shown");
  assert.equal(firsts.length, 3);
  for (const event of firsts) {
    assert.equal(event.type, "offer-shown");
    if (event.type === "offer-shown") assert.equal(event.reshow, undefined);
  }
  begun.clearShown();
  begun.noteShown("opening", "lean-left");
  const returned = begun.snapshot().events.filter((event) => event.type === "offer-shown");
  assert.equal(returned.length, 4);
  const again = returned[3];
  assert.equal(again.type, "offer-shown");
  if (again.type === "offer-shown") {
    assert.equal(again.itemId, "lean-left");
    assert.equal(again.surface, "opening");
    assert.equal(again.reshow, true);
  }
  assert.equal(beginEventToken(again), "offer-shown:opening:lean-left:reshow");
});

test("begin flags stay off for the placement build and do not join the bowl schema", () => {
  const open = readExperimentConfig(new URL("http://localhost/?placeTap=1"));
  assert.equal(open.placeTap, true);
  assert.equal(open.placeCue, true);
  assert.equal(open.beginLine, false);
  assert.equal(open.beginFor, false);
  assert.equal(open.beginBake, null);
  const line = beginFlagsFrom(new URL("http://localhost/?beginLine=1&beginFor=1&beginSeed=3"));
  assert.equal(line.beginLine, true);
  assert.equal(line.beginFor, false);
  assert.equal(line.beginSeed, 3);
  const baked = bakedBegin({ __LL_BEGIN__: "for:1" } as typeof globalThis);
  assert.deepEqual(beginFlagsFrom(new URL("http://localhost/?beginSeed=0"), baked), {
    beginLine: false, beginFor: true, beginSeed: 0,
  });
  assert.equal(bakedBegin({} as typeof globalThis), null);
  const openBake = bakedBegin({ __LL_BEGIN__: "open" } as typeof globalThis);
  assert.equal(openBake?.kind, "open");
  assert.equal(openBake?.beginLine, false);
  assert.equal(openBake?.beginFor, false);
  assert.equal(readExperimentConfig(new URL("http://localhost/?beginLine=1")).beginBake, null);
  const previousBegin = (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__;
  (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__ = "open";
  try {
    const bakedOpen = readExperimentConfig(new URL("http://localhost/?placeTap=1"));
    assert.equal(bakedOpen.beginBake, "open");
    assert.equal(bakedOpen.beginLine, false);
    assert.equal(bakedOpen.beginFor, false);
    const urlOnOpenBake = readExperimentConfig(new URL("http://localhost/?beginLine=1"));
    assert.equal(urlOnOpenBake.beginBake, "open");
    assert.equal(urlOnOpenBake.beginLine, true);
    (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__ = "line:0";
    const fromLine = readExperimentConfig(new URL("http://localhost/"));
    assert.equal(fromLine.beginBake, "line");
    assert.equal(fromLine.beginLine, true);
    (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__ = "for:1";
    const fromFor = readExperimentConfig(new URL("http://localhost/"));
    assert.equal(fromFor.beginBake, "for");
    assert.equal(fromFor.beginFor, true);
  } finally {
    if (previousBegin === undefined) delete (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__;
    else (globalThis as { __LL_BEGIN__?: unknown }).__LL_BEGIN__ = previousBegin;
  }

  const keys = sceneStorageKeys(new URL("http://localhost/"), false);
  assert.equal(BEGIN_STUDY_KEY, "ikebana-web-alpha:begin-study-v1");
  assert.notEqual(BEGIN_STUDY_KEY, keys.studio);
  assert.notEqual(BEGIN_STUDY_KEY, keys.garden);
  const saved = parseSceneStudio(JSON.stringify({
    storageVersion: 2,
    savedAt: "2026-10-10T12:00:00.000Z",
    nextSuccessfulOrdinal: 1,
    plants: [],
    camera: canonicalCameraPose("front"),
    scene: DEFAULT_SCENE,
  }));
  assert.deepEqual(Object.keys(saved).sort(), ["camera", "nextSuccessfulOrdinal", "plants", "savedAt", "scene", "storageVersion"]);
  for (const invitation of BEGIN_INVITATIONS) {
    assert.equal(/study|experiment|score|timer|currency/i.test(invitation.text + invitation.summary), false);
    assert.notEqual(invitation.summary, "Across the table");
  }
  assert.equal(BEGIN_INVITATIONS.find((item) => item.id === "table")?.summary, "Two at a table");
});
