import assert from "node:assert/strict";
import test from "node:test";

import { TransactionCoordinator } from "../../src/input/TransactionCoordinator";
import { createBotanicalTransactionAdapters } from "../../src/input/botanicalAdapters";
import { createFloweringBranch } from "../../src/core/generator";
import type {
  AutosaveEvent,
  OperationContextMap,
  OperationInputMap,
  TransactionAdapters,
} from "../../src/input/types";

interface FakeGraph {
  id: string;
  value: number;
  pieces: string[];
}

interface FakeCamera {
  yaw: number;
  distance: number;
}

interface FakePlan {
  branchId: string;
  distance: number;
  sourceValue: number;
}

interface Inputs extends OperationInputMap {
  insert: { offset: number; valid: boolean };
  aim: number;
  bend: number;
  base: number;
  prune: number;
  camera: number;
}

interface Contexts extends OperationContextMap {
  insert: { plane: string };
  aim: { plane: string };
  bend: { plane: string };
  base: { plane: string };
  prune: { projection: string };
  camera: { gesture: string };
}

function graph(id = "plant-1", value = 10): FakeGraph {
  return { id, value, pieces: ["trunk", "bloom"] };
}

function cloneGraph(value: FakeGraph): FakeGraph {
  return { ...value, pieces: [...value.pieces] };
}

function makeAdapters(log: string[] = []): TransactionAdapters<
  FakeGraph,
  FakeCamera,
  FakePlan,
  Inputs,
  Contexts
> {
  return {
    cloneGraph,
    cloneCamera: (camera) => ({ ...camera }),
    validateInsertReservation: ({ ordinal, plantId, seed, graph: pending }) =>
      plantId === `plant-${ordinal}` &&
      seed === (7301 + ordinal * 977) >>> 0 &&
      pending.id === plantId,
    placePending: (snapshot, _spec, input) => ({
      graph: { ...cloneGraph(snapshot), value: snapshot.value + input.offset },
      isValid: input.valid,
    }),
    aim: (snapshot, _spec, input) => ({
      ...cloneGraph(snapshot),
      value: snapshot.value + input,
    }),
    bend: (snapshot, spec, input) => {
      log.push(`bend:${spec.variant}:${spec.stationDistance}`);
      return {
        ...cloneGraph(snapshot),
        value: snapshot.value + spec.stationDistance + input,
      };
    },
    moveBase: (snapshot, _spec, input) => ({
      ...cloneGraph(snapshot),
      value: snapshot.value + input,
    }),
    previewPrune: (snapshot, spec, input) => ({
      branchId: spec.branchId,
      distance: input,
      sourceValue: snapshot.value,
    }),
    applyPrune: (snapshot, plan) => {
      log.push(`apply:${plan.branchId}:${plan.distance}`);
      return {
        ...cloneGraph(snapshot),
        value: snapshot.value - plan.distance,
        pieces: snapshot.pieces.filter((piece) => piece !== "bloom"),
      };
    },
    updateCamera: (snapshot, _spec, input) => ({
      ...snapshot,
      yaw: snapshot.yaw + input,
    }),
  };
}

function seededCoordinator(
  options: ConstructorParameters<
    typeof TransactionCoordinator<
      FakeGraph,
      FakeCamera,
      FakePlan,
      Inputs,
      Contexts
    >
  >[2] = {},
  log: string[] = [],
) {
  return new TransactionCoordinator<FakeGraph, FakeCamera, FakePlan, Inputs, Contexts>(
    makeAdapters(log),
    {
      plants: [["plant-1", graph()]],
      camera: { yaw: 0, distance: 8 },
      selectedPlantId: "plant-1",
      successfulPlantOrdinal: 1,
    },
    options,
  );
}

function currentValue(
  coordinator: TransactionCoordinator<
    FakeGraph,
    FakeCamera,
    FakePlan,
    Inputs,
    Contexts
  >,
  plantId = "plant-1",
): number {
  return coordinator.getDocumentSnapshot().plants.get(plantId)!.value;
}

test("updates aim from the immutable acquisition snapshot and commits once", () => {
  const saves: AutosaveEvent<FakeGraph, FakeCamera>[] = [];
  const cancellations: string[] = [];
  const coordinator = seededCoordinator({
    onAutosave: (event) => saves.push(event),
    onCancel: (event) => cancellations.push(event.reason),
  });

  assert.deepEqual(
    coordinator.beginAim(
      1,
      {
        plantId: "plant-1",
        branchId: "trunk",
        grabbedMaterialDistance: 4,
        context: { plane: "front" },
      },
      1,
    ),
    { ok: true },
  );
  assert.equal(coordinator.getPresentationState().active?.kind, "aim");
  assert.equal(currentValue(coordinator), 10, "preview must not mutate committed data");

  assert.deepEqual(coordinator.updateAim(2, 99), {
    ok: false,
    reason: "owner-mismatch",
  });
  coordinator.updateAim(1, 3);
  coordinator.updateAim(1, 7);
  const active = coordinator.getPresentationState().active;
  assert.equal(active?.kind, "aim");
  if (active?.kind === "aim") assert.equal(active.graph.value, 17);

  assert.deepEqual(coordinator.release(1), { ok: true });
  assert.equal(currentValue(coordinator), 17, "second update must be 10 + 7, not 10 + 3 + 7");
  assert.equal(saves.length, 1);
  assert.equal(saves[0]?.operation, "aim");
  assert.equal(saves[0]?.document.plants.get("plant-1")?.value, 17);
  assert.deepEqual(coordinator.release(1), { ok: false, reason: "idle" });
  assert.deepEqual(coordinator.lostCapture(1), { ok: false, reason: "idle" });
  assert.equal(saves.length, 1, "idempotent finish must not save twice");
  assert.deepEqual(
    cancellations,
    [],
    "implicit capture loss after pointerup must be an idle no-op",
  );
});

test("invalid and cancelled insertions keep the same successful ordinal", () => {
  const saves: AutosaveEvent<FakeGraph, FakeCamera>[] = [];
  const coordinator = seededCoordinator({ onAutosave: (event) => saves.push(event) });
  const pending = graph("plant-2", 20);
  const reservation = { ordinal: 2, plantId: "plant-2", seed: 9255, graph: pending };

  coordinator.beginInsert(
    "tray",
    reservation,
    { plane: "kenzan" },
    { offset: 4, valid: false },
  );
  const invalidGhost = coordinator.getPresentationState().active;
  assert.equal(invalidGhost?.kind, "insert");
  if (invalidGhost?.kind === "insert") {
    assert.equal(invalidGhost.graph.value, 24);
    assert.equal(invalidGhost.isValid, false);
  }
  coordinator.release("tray");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(coordinator.getDocumentSnapshot().plants.has("plant-2"), false);
  assert.equal(saves.length, 0);

  coordinator.beginInsert(
    "tray",
    reservation,
    { plane: "kenzan" },
    { offset: 5, valid: true },
  );
  coordinator.pointerCancel("tray");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 0);

  coordinator.beginInsert(
    "tray",
    reservation,
    { plane: "kenzan" },
    { offset: 6, valid: true },
  );
  coordinator.release("tray");
  const committed = coordinator.getDocumentSnapshot();
  assert.equal(committed.successfulPlantOrdinal, 2);
  assert.equal(committed.selectedPlantId, "plant-2");
  assert.equal(committed.plants.get("plant-2")?.value, 26);
  assert.equal(saves.length, 1);
  assert.equal(saves[0]?.operation, "insert");
});

test("all interruption families discard graph previews", () => {
  const cases: Array<{
    label: string;
    interrupt: (
      coordinator: ReturnType<typeof seededCoordinator>,
      owner: OwnerTokenForTest,
    ) => void;
  }> = [
    { label: "pointercancel", interrupt: (c, owner) => void c.pointerCancel(owner) },
    { label: "lost capture", interrupt: (c, owner) => void c.lostCapture(owner) },
    { label: "visibility", interrupt: (c) => void c.visibilityHidden() },
    { label: "posture", interrupt: (c) => c.commandPosture("step-back") },
    { label: "tool", interrupt: (c) => c.commandTool("prune") },
    {
      label: "view",
      interrupt: (c) => c.commandView("above", { yaw: 4, distance: 9 }),
    },
    { label: "selection", interrupt: (c) => void c.commandSelection(null) },
  ];

  for (const entry of cases) {
    const saves: AutosaveEvent<FakeGraph, FakeCamera>[] = [];
    const coordinator = seededCoordinator({ onAutosave: (event) => saves.push(event) });
    coordinator.beginAim(
      7,
      {
        plantId: "plant-1",
        branchId: "trunk",
        grabbedMaterialDistance: 2,
        context: { plane: "front" },
      },
      30,
    );
    entry.interrupt(coordinator, 7);
    assert.equal(currentValue(coordinator), 10, `${entry.label} must restore snapshot`);
    assert.equal(coordinator.getDebugState().active, null);
    assert.equal(saves.length, 0, `${entry.label} must never autosave preview`);
  }
});

type OwnerTokenForTest = string | number;

test("prune previews are non-mutating, frozen to one branch, and apply once", () => {
  const log: string[] = [];
  const coordinator = seededCoordinator({}, log);
  coordinator.commandTool("prune");
  coordinator.beginPrune(
    "cut",
    {
      plantId: "plant-1",
      branchId: "twig-a",
      acquiredMaterialDistance: 3,
      context: { projection: "front" },
    },
    2,
  );
  coordinator.updatePrune("cut", 4);
  const active = coordinator.getPresentationState().active;
  assert.equal(active?.kind, "prune");
  if (active?.kind === "prune") {
    assert.equal(active.plan.branchId, "twig-a");
    assert.equal(active.plan.distance, 4);
    assert.equal(active.plan.sourceValue, 10);
  }
  assert.equal(currentValue(coordinator), 10);
  coordinator.release("cut");
  assert.equal(currentValue(coordinator), 6);
  assert.deepEqual(log, ["apply:twig-a:4"]);
  coordinator.release("cut");
  assert.deepEqual(log, ["apply:twig-a:4"]);
});

test("bead and touch choose different frozen stations but share one solver", () => {
  const log: string[] = [];
  const coordinator = seededCoordinator({}, log);
  const candidate = {
    plantId: "plant-1",
    branchId: "trunk",
    beadStationDistance: 5.4,
    touchMaterialDistance: 3.2,
    context: { plane: "front" },
  } as const;

  coordinator.beginBend("bend-a", candidate, 1);
  coordinator.updateBend("bend-a", 2);
  assert.equal(coordinator.getDebugState().active?.kind, "bend");
  const beadState = coordinator.getDebugState().active;
  if (beadState?.kind === "bend") assert.equal(beadState.stationDistance, 5.4);
  coordinator.pointerCancel("bend-a");

  coordinator.commandBendVariant("touch");
  coordinator.beginBend("bend-b", candidate, 1);
  coordinator.updateBend("bend-b", 2);
  const touchState = coordinator.getDebugState().active;
  if (touchState?.kind === "bend") assert.equal(touchState.stationDistance, 3.2);
  coordinator.pointerCancel("bend-b");

  assert.deepEqual(log, [
    "bend:bead:5.4",
    "bend:bead:5.4",
    "bend:touch:3.2",
    "bend:touch:3.2",
  ]);
});

test("camera can acquire only in Step Back and cancel never changes its pose", () => {
  const saves: AutosaveEvent<FakeGraph, FakeCamera>[] = [];
  const coordinator = seededCoordinator({
    autosaveCameraCommits: true,
    onAutosave: (event) => saves.push(event),
  });

  assert.deepEqual(
    coordinator.beginCamera("camera", { gesture: "orbit" }, 2),
    { ok: false, reason: "wrong-posture" },
  );
  coordinator.commandPosture("step-back");
  coordinator.beginCamera("camera", { gesture: "orbit" }, 2);
  coordinator.updateCamera("camera", 5);
  assert.equal(coordinator.getPresentationState().document.camera.yaw, 0);
  coordinator.lostCapture("camera");
  assert.equal(coordinator.getDocumentSnapshot().camera.yaw, 0);
  assert.equal(saves.length, 0);

  coordinator.beginCamera("camera", { gesture: "orbit" }, 2);
  coordinator.updateCamera("camera", 5);
  coordinator.release("camera");
  assert.equal(coordinator.getDocumentSnapshot().camera.yaw, 5);
  assert.equal(saves.length, 1);
  assert.equal(saves[0]?.domain, "camera");
});

test("acquired target owns the interaction until finish", () => {
  const coordinator = seededCoordinator();
  coordinator.beginAim(
    "first",
    {
      plantId: "plant-1",
      branchId: "trunk",
      grabbedMaterialDistance: 2,
      context: { plane: "front" },
    },
    1,
  );
  assert.deepEqual(
    coordinator.beginAim(
      "second",
      {
        plantId: "plant-1",
        branchId: "twig",
        grabbedMaterialDistance: 1,
        context: { plane: "front" },
      },
      50,
    ),
    { ok: false, reason: "busy" },
  );
  assert.deepEqual(coordinator.cancel("second"), {
    ok: false,
    reason: "owner-mismatch",
  });
  assert.equal(coordinator.getDebugState().active?.owner, "first");
  coordinator.release("first");
  assert.equal(currentValue(coordinator), 11);
});

test("base and bend handles only acquire for the already selected plant", () => {
  const coordinator = seededCoordinator();
  const second = graph("plant-2", 20);
  coordinator.beginInsert(
    "tray",
    { ordinal: 2, plantId: "plant-2", seed: 9255, graph: second },
    { plane: "kenzan" },
    { offset: 0, valid: true },
  );
  coordinator.release("tray");
  coordinator.commandSelection("plant-1");

  assert.deepEqual(
    coordinator.beginBase(
      "base",
      { plantId: "plant-2", context: { plane: "kenzan" } },
      1,
    ),
    { ok: false, reason: "plant-not-selected" },
  );
  assert.deepEqual(
    coordinator.beginBend(
      "bend",
      {
        plantId: "plant-2",
        branchId: "trunk",
        beadStationDistance: 4,
        touchMaterialDistance: 2,
        context: { plane: "front" },
      },
      1,
    ),
    { ok: false, reason: "plant-not-selected" },
  );
});

test("pending placement follows invalid space while base editing remains clamped", () => {
  const adapters = createBotanicalTransactionAdapters<{ yaw: number }, number>({
    clone: (camera) => ({ ...camera }),
    update: (camera, delta) => ({ yaw: camera.yaw + delta }),
  });
  const pending = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.5, z: 0 });
  const reservation = { ordinal: 1, plantId: "plant-1", seed: 8278, graph: pending };
  const placed = adapters.placePending(
    pending,
    { reservation, context: null },
    {
      targetBase: { x: 3, y: 0.5, z: 0 },
      usableRadius: 1.22,
      isValid: false,
    },
  );
  const pendingRoot = placed.graph.branches.get(placed.graph.rootBranchId)!;
  assert.equal(pendingRoot.points[0]?.x, 3, "invalid ghost must not stick to the rim");
  assert.equal(placed.isValid, false);

  const moved = adapters.moveBase(
    pending,
    { plantId: "plant-1", context: null },
    { targetBase: { x: 3, y: 0.5, z: 0 }, usableRadius: 1.22 },
  );
  const movedRoot = moved.branches.get(moved.rootBranchId)!;
  assert.ok(Math.abs((movedRoot.points[0]?.x ?? 0) - 1.22) < 1e-12);
});
