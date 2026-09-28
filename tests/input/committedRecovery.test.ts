import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPrune,
  createFloweringBranch,
  previewPrune,
  sampleBranch,
  serializePlantGraph,
  successfulSeatIdentity,
  type PlantGraph,
} from "../../src/core/index.ts";
import { canonicalCameraPose, type CameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import type { AutosaveEvent, CoordinatorOptions, DocumentSnapshot, RecoveryCommitEvent } from "../../src/input/types.ts";

const first = () => createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
const second = () => createFloweringBranch("plant-2", 9255, { x: 0.4, y: 0.55, z: 0 });
function setup(options: CoordinatorOptions<PlantGraph, CameraPose> = {}, plants = [first(), second()]) {
  return new TransactionCoordinator(createDomainAdapters(), {
    plants: plants.map((plant) => [plant.id, plant] as const),
    camera: canonicalCameraPose("front"),
    selectedPlantId: plants[0]?.id ?? null,
    successfulPlantOrdinal: 2,
  }, options);
}
type Coordinator = ReturnType<typeof setup>;
function canonical(document: DocumentSnapshot<PlantGraph, CameraPose>) {
  return [...document.plants].map(([id, graph]) => [id, serializePlantGraph(graph)]);
}
function move(coordinator: Coordinator, x: number, owner = 1) {
  assert.deepEqual(coordinator.beginBase(owner, { plantId: "plant-1", context: {} }, {
    base: { x, y: 0.55, z: 0 },
  }), { ok: true });
  assert.deepEqual(coordinator.release(owner), { ok: true });
}
function pending(coordinator: Coordinator, ordinal: number, valid = true) {
  const { id, seed } = successfulSeatIdentity(ordinal);
  const graph = createFloweringBranch(id, seed, { x: 0, y: 0.55, z: 0 });
  return coordinator.beginInsert("insert", { plantId: id, seed, ordinal, graph }, {}, {
    base: { x: -0.3, y: 0.55, z: 0 }, valid,
  });
}

test("undo insertion restores the prior selection without reusing an ordinal or seed", () => {
  const saves: AutosaveEvent<PlantGraph, CameraPose>[] = [];
  const coordinator = setup({ onAutosave: (event) => saves.push(event) });
  const before = coordinator.getDocumentSnapshot();
  assert.deepEqual(pending(coordinator, 3), { ok: true });
  coordinator.release("insert");
  assert.equal(coordinator.getDebugState().selectedPlantId, "plant-3");
  assert.equal(coordinator.canUndo(), true);
  assert.deepEqual(coordinator.commandUndo(), { ok: true });
  assert.deepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(before));
  assert.equal(coordinator.getDebugState().selectedPlantId, "plant-1");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 3);
  assert.equal(saves.at(-1)?.operation, "undo");
  assert.equal(saves.at(-1)?.document.successfulPlantOrdinal, 3);
  assert.equal(coordinator.canUndo(), false);
  assert.deepEqual(coordinator.commandUndo(), { ok: false, reason: "nothing-to-undo" });
  assert.deepEqual(pending(coordinator, 3), { ok: false, reason: "ordinal-mismatch" });
  assert.deepEqual(pending(coordinator, 4), { ok: true });
  coordinator.release("insert");
  assert.equal(coordinator.getDocumentSnapshot().plants.get("plant-4")?.seed, successfulSeatIdentity(4).seed);
});

test("undo restores only the most recent changed botanical action; camera and no-op releases do not replace it", () => {
  const coordinator = setup();
  move(coordinator, 0.2);
  const afterFirst = coordinator.getDocumentSnapshot();
  move(coordinator, 0.7);
  // A no-op base release, failed insertion, and a cancelled preview cannot hide
  // the second move behind a useless checkpoint.
  move(coordinator, 0.7);
  pending(coordinator, 3, false);
  coordinator.release("insert");
  coordinator.beginBase(8, { plantId: "plant-1", context: {} }, { base: { x: -0.8, y: 0.55, z: 0 } });
  assert.deepEqual(coordinator.release(9), { ok: false, reason: "owner-mismatch" });
  coordinator.pointerCancel(8);
  coordinator.commandPosture("step-back");
  const camera = canonicalCameraPose("above");
  coordinator.beginCamera(10, {}, { pose: camera });
  coordinator.release(10);
  coordinator.commandSelection("plant-2");
  assert.deepEqual(coordinator.commandUndo(), { ok: true });
  const undone = coordinator.getDocumentSnapshot();
  assert.deepEqual(canonical(undone), canonical(afterFirst));
  assert.deepEqual(undone.camera, camera, "undo must not undo looking");
  assert.equal(undone.selectedPlantId, "plant-1");
  assert.equal(coordinator.getDebugState().posture, "step-back");
  assert.equal(coordinator.canUndo(), false, "one step, not an implicit undo stack or redo");
  coordinator.commandPosture("arrange");
  move(coordinator, 0.2);
  assert.equal(coordinator.canUndo(), false, "unchanged release must not create a checkpoint either");
});

for (const operation of ["aim", "bend", "prune"] as const) {
  test(`undo ${operation} restores exact canonical and inactive records`, () => {
    const original = first();
    const lateral = [...original.branches.values()].find((branch) => branch.kind === "lateral")!;
    const oldCut = applyPrune(original, previewPrune(original, lateral.id, lateral.activeLength * 0.7));
    const coordinator = setup({}, [oldCut, second()]);
    const before = coordinator.getDocumentSnapshot();
    const graph = before.plants.get("plant-1")!;
    const trunk = graph.branches.get(graph.rootBranchId)!;
    if (operation === "aim") {
      const point = sampleBranch(trunk, trunk.activeLength * 0.8).position;
      coordinator.beginAim(1, { plantId: graph.id, branchId: trunk.id, grabbedMaterialDistance: trunk.activeLength * 0.8, context: {} }, {
        target: { ...point, x: point.x + 0.7 },
      });
    } else if (operation === "bend") {
      const station = trunk.activeLength * 0.54;
      const point = sampleBranch(trunk, station).position;
      coordinator.beginBend(1, { plantId: graph.id, branchId: trunk.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, {
        target: { ...point, x: point.x + 0.7 },
      });
    } else {
      coordinator.commandTool("prune");
      coordinator.beginPrune(1, { plantId: graph.id, branchId: trunk.id, acquiredMaterialDistance: trunk.activeLength * 0.5, context: {} }, {
        distance: trunk.activeLength * 0.5,
      });
    }
    assert.deepEqual(coordinator.release(1), { ok: true });
    assert.notDeepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(before));
    assert.deepEqual(coordinator.commandUndo(), { ok: true });
    assert.deepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(before));
  });
}

test("undo an Aim to another plant restores pre-acquisition selection", () => {
  const coordinator = setup();
  const graph = coordinator.getDocumentSnapshot().plants.get("plant-2")!;
  const trunk = graph.branches.get(graph.rootBranchId)!;
  const point = sampleBranch(trunk, 2).position;
  coordinator.beginAim(1, { plantId: graph.id, branchId: trunk.id, grabbedMaterialDistance: 2, context: {} }, {
    target: { ...point, x: point.x + 0.7 },
  });
  coordinator.release(1);
  assert.equal(coordinator.getDebugState().selectedPlantId, "plant-2");
  coordinator.commandUndo();
  assert.equal(coordinator.getDebugState().selectedPlantId, "plant-1");
});

test("remove selected cutting is explicit, reversible, and preserves all material history", () => {
  const original = first();
  const cut = applyPrune(original, previewPrune(original, original.rootBranchId, 2));
  const saves: AutosaveEvent<PlantGraph, CameraPose>[] = [];
  const coordinator = setup({ onAutosave: (event) => saves.push(event) }, [cut, second()]);
  const before = coordinator.getDocumentSnapshot();
  coordinator.commandPosture("step-back");
  assert.deepEqual(coordinator.commandRemoveSelected(), { ok: false, reason: "wrong-posture" });
  coordinator.commandPosture("arrange");
  assert.deepEqual(coordinator.commandRemoveSelected(), { ok: true });
  assert.deepEqual([...coordinator.getDocumentSnapshot().plants.keys()], ["plant-2"]);
  assert.equal(coordinator.getDebugState().selectedPlantId, null);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 2);
  assert.deepEqual(coordinator.commandRemoveSelected(), { ok: false, reason: "plant-not-selected" });
  coordinator.commandUndo();
  assert.deepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(before));
  assert.equal(coordinator.getDebugState().selectedPlantId, "plant-1");
  assert.deepEqual(saves.map((event) => event.operation), ["remove", "undo"]);
});

test("recovery storage veto and exception leave document, sequence, and undo checkpoint intact", () => {
  const observed: RecoveryCommitEvent<PlantGraph, CameraPose>[] = [];
  const saves: AutosaveEvent<PlantGraph, CameraPose>[] = [];
  let persistence: "false" | "throw" | "accept" = "false";
  const coordinator = setup({
    beforeRecoveryCommit(event) {
      observed.push(event);
      assert.equal(coordinator.getDebugState().active, null);
      assert.deepEqual(coordinator.commandUndo(), { ok: false, reason: "busy" });
      if (persistence === "throw") throw new Error("quota");
      return persistence === "accept";
    },
    onAutosave: (event) => saves.push(event),
  });
  move(coordinator, 0.7);
  const before = coordinator.getDocumentSnapshot();
  const sequence = coordinator.getDebugState().commitSequence;
  for (const mode of ["false", "throw"] as const) {
    persistence = mode;
    assert.deepEqual(coordinator.commandUndo(), { ok: false, reason: "save-failed" });
    assert.deepEqual(coordinator.commandRemoveSelected(), { ok: false, reason: "save-failed" });
    assert.deepEqual(coordinator.getDocumentSnapshot(), before);
    assert.equal(coordinator.getDebugState().commitSequence, sequence);
    assert.equal(coordinator.canUndo(), true);
    assert.equal(saves.length, 1);
  }
  persistence = "accept";
  assert.deepEqual(coordinator.commandUndo(), { ok: true });
  assert.equal(saves.length, 2);
  assert.equal(observed.at(-1)?.sequence, sequence + 1);
  assert.deepEqual(observed.at(-1)?.document, saves.at(-1)?.document);
  assert.equal(coordinator.canUndo(), false);
});

test("undo/removal do not steal an active transaction; cancellation then undo makes old release inert", () => {
  const saves: AutosaveEvent<PlantGraph, CameraPose>[] = [];
  const coordinator = setup({ onAutosave: (event) => saves.push(event) });
  const original = coordinator.getDocumentSnapshot();
  move(coordinator, 0.7);
  coordinator.beginBase(4, { plantId: "plant-1", context: {} }, { base: { x: 0.8, y: 0.55, z: 0 } });
  assert.deepEqual(coordinator.commandUndo(), { ok: false, reason: "busy" });
  assert.deepEqual(coordinator.commandRemoveSelected(), { ok: false, reason: "busy" });
  assert.equal(coordinator.getDebugState().active?.owner, 4);
  coordinator.interrupt();
  coordinator.commandUndo();
  assert.deepEqual(coordinator.release(4), { ok: false, reason: "idle" });
  assert.equal(saves.length, 2);
  assert.deepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(original));
});

test("new working coordinators and loaded documents never inherit session recovery", () => {
  const coordinator = setup();
  move(coordinator, 0.7);
  assert.equal(coordinator.canUndo(), true);
  const saved = coordinator.getDocumentSnapshot();
  for (const replacement of [saved, { ...saved, plants: new Map(), selectedPlantId: null }]) {
    const loaded = new TransactionCoordinator(createDomainAdapters(), replacement);
    assert.equal(loaded.canUndo(), false);
    assert.deepEqual(loaded.commandUndo(), { ok: false, reason: "nothing-to-undo" });
    assert.deepEqual(loaded.getDocumentSnapshot(), replacement);
  }
  assert.deepEqual(Object.keys(saved).sort(), ["camera", "plants", "selectedPlantId", "successfulPlantOrdinal"]);
});

test("defensive recovery snapshots cannot corrupt the stored checkpoint", () => {
  const coordinator = setup({ beforeRecoveryCommit(event) {
    for (const graph of event.document.plants.values()) graph.branches.clear();
    return true;
  } });
  const before = coordinator.getDocumentSnapshot();
  move(coordinator, 0.7);
  const disposable = coordinator.getDocumentSnapshot();
  disposable.plants.get("plant-1")!.branches.clear();
  coordinator.commandUndo();
  assert.deepEqual(canonical(coordinator.getDocumentSnapshot()), canonical(before));
});
