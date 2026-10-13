import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-lobed-leaf-v1.json";
import {
  add, aimBranch, applyPrune, bendBranch, createLobedLeaf, deserializePlantGraph,
  dot, normalize, previewPrune, sampleBranch, serializePlantGraph, subtract,
  toCanonicalPlantGraph, validatePlantGraph,
} from "../../src/core/index.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "./helpers.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [0, 8278, 9255, 10232, 0xffffffff];

test("lobed-leaf-v1 is deterministic, additive, and has two real opposite leaf nodes", () => {
  for (const seed of SEEDS) {
    const graph = createLobedLeaf("plant-1", seed, BASE);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.branches.size, 6);
    assert.equal(graph.organs.size, 4);
    assert.equal(graph.generatorVersion, "lobed-leaf-v1");
    const serialized = serializePlantGraph(graph);
    assert.equal(serialized, serializePlantGraph(createLobedLeaf("plant-1", seed, BASE)));
    assert.equal(serialized, serializePlantGraph(deserializePlantGraph(serialized)));
    if (seed === 8278) assert.deepEqual(JSON.parse(serialized), fixture);
    for (const first of [1, 3]) {
      const a = graph.branches.get(`plant-1:petiole-${first}`)!;
      const b = graph.branches.get(`plant-1:petiole-${first + 1}`)!;
      assert.equal(a.parentId, b.parentId);
      assert.equal(a.parentDistance, b.parentDistance);
      assert.deepEqual(a.points[0], b.points[0]);
      const da = normalize(subtract(a.points[1], a.points[0]));
      const db = normalize(subtract(b.points[1], b.points[0]));
      assert.ok(dot(da, db) < -0.85, "opposite petioles, with a shared slight upward departure");
    }
  }
});

test("ordinary Aim and Bend preserve lobed stock, coherent attachments, and immutable acquisition", () => {
  for (const seed of SEEDS) {
    const graph = createLobedLeaf("plant-1", seed, BASE);
    const snapshot = serializePlantGraph(graph);
    for (const id of [graph.rootBranchId, "plant-1:fork", "plant-1:petiole-1"]) {
      const branch = graph.branches.get(id)!;
      const tip = branch.points.at(-1)!;
      const aimed = aimBranch(graph, id, tip, add(tip, { x: 0.6, y: 0.1, z: -0.6 }));
      assertAttachmentCoincidence(aimed);
      assertRestLengthsPreserved(graph, aimed);
      assert.notDeepEqual(aimed.branches.get(id)!.points, branch.points);
      if (branch.kind === "petiole") continue;
      const stationDistance = branch.activeLength * 0.54;
      const bent = bendBranch(graph, {
        branchId: id, stationDistance,
        target: add(sampleBranch(branch, stationDistance).position, { x: -0.7, y: 0.15, z: 0.5 }),
      });
      assertAttachmentCoincidence(bent);
      assertRestLengthsPreserved(graph, bent);
      assert.notDeepEqual(bent.branches.get(id)!.points, branch.points);
      assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
    }
    assert.equal(serializePlantGraph(graph), snapshot);
  }
});

test("one petiole cut removes one whole blade; fork cut opens a two-leaf window and retains history", () => {
  for (const seed of SEEDS) {
    const graph = createLobedLeaf("plant-1", seed, BASE);
    const petiole = graph.branches.get("plant-1:petiole-3")!;
    const leafPlan = previewPrune(graph, petiole.id, petiole.activeLength * 0.5)!;
    assert.deepEqual(leafPlan.removedOrganIds, ["plant-1:leaf-3"]);
    const leafCut = applyPrune(graph, leafPlan);
    for (const branch of graph.branches.values()) {
      if (branch.id !== petiole.id) assert.deepEqual(leafCut.branches.get(branch.id), branch);
    }
    const forkPlan = previewPrune(graph, "plant-1:fork", 0.12)!;
    assert.deepEqual(forkPlan.removedOrganIds, ["plant-1:leaf-3", "plant-1:leaf-4"]);
    const forkCut = applyPrune(graph, forkPlan);
    assert.equal(forkCut.branches.size, graph.branches.size);
    assert.equal(forkCut.organs.size, graph.organs.size);
    for (const id of ["plant-1:wood", "plant-1:petiole-1", "plant-1:petiole-2"]) {
      assert.deepEqual(forkCut.branches.get(id), graph.branches.get(id));
    }
    assertAttachmentCoincidence(leafCut);
    assertAttachmentCoincidence(forkCut);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(forkCut))), serializePlantGraph(forkCut));
  }
});

test("cancelled lobed insertion, Aim, Bend and prune keep canonical state and write nothing", () => {
  let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: () => saves++ });
  const prepared = prepareMaterialInsertionForApp("lobed-leaf", 0);
  assert.ok(prepared.ok);
  const reservation = { ordinal: prepared.ordinal, plantId: prepared.plantId, seed: prepared.seed, graph: prepared.graph };
  coordinator.beginInsert(1, reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel(1);
  assert.equal(saves, 0);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  coordinator.beginInsert(2, reservation, {}, { base: BASE, valid: true });
  coordinator.release(2);
  assert.equal(saves, 1);
  const graph = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  const snapshot = serializePlantGraph(graph);
  const branch = graph.branches.get(graph.rootBranchId)!;
  const station = branch.activeLength * 0.54;
  const at = sampleBranch(branch, station).position;
  const target = add(at, { x: 0.6, y: 0.1, z: 0.5 });
  assert.ok(coordinator.beginAim(3, { plantId: graph.id, branchId: branch.id, grabbedMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(3);
  assert.ok(coordinator.beginBend(4, { plantId: graph.id, branchId: branch.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(4);
  coordinator.commandTool("prune");
  assert.ok(coordinator.beginPrune(5, { plantId: graph.id, branchId: "plant-1:petiole-1", acquiredMaterialDistance: 0.1, context: {} }, { distance: 0.1 }).ok);
  coordinator.pointerCancel(5);
  assert.equal(saves, 1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), snapshot);
  coordinator.beginPrune(6, { plantId: graph.id, branchId: "plant-1:petiole-1", acquiredMaterialDistance: 0.1, context: {} }, { distance: 0.1 });
  coordinator.release(6);
  assert.equal(saves, 2);
  const kept = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  assert.equal(kept.organs.get("plant-1:leaf-1")!.active, false);
  assert.equal(kept.organs.size, 4);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(kept))), serializePlantGraph(kept));
});
