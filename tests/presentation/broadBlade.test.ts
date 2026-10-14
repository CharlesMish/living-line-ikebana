import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  aimBranch, applyPrune, bendBranchAtFraction, createBroadBlade, broadBladeStock,
  deserializePlantGraph, getMaterialDefinition, previewPrune, sampleBranch,
  serializePlantGraph, validatePlantGraph,
} from "../../src/core/index.ts";
import { broadBladeHalfWidth, updateBroadBladeGeometry } from "../../src/presentation/broadBladeGeometry.ts";
import { studioFixture } from "./studioFixture.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const seeds = [8278, 9255, 10232];
function geometry(graph: ReturnType<typeof createBroadBlade>, from = 0, to?: number) {
  const result = new THREE.BufferGeometry();
  updateBroadBladeGeometry(result, graph.branches.get(graph.rootBranchId)!, graph.seed, from, to);
  return result;
}
function vertexMap(geo: THREE.BufferGeometry) {
  const uv = geo.getAttribute("uv"), p = geo.getAttribute("position"), color = geo.getAttribute("color");
  const result = new Map<string, number[]>();
  for (let i = 0; i < uv.count; i++) result.set(`${uv.getX(i)}|${uv.getY(i)}`,
    [p.getX(i), p.getY(i), p.getZ(i), color.getX(i), color.getY(i), color.getZ(i)]);
  return result;
}

test("broad blade is deterministic registered stock with one persistent midrib and no rigid organ", () => {
  assert.equal(getMaterialDefinition("broad-blade")?.generator.generate, createBroadBlade);
  for (const seed of seeds) {
    const graph = createBroadBlade("blade", seed, BASE);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.branches.size, 1);
    assert.equal(graph.organs.size, 0);
    assert.equal(serializePlantGraph(graph), serializePlantGraph(createBroadBlade("blade", seed, BASE)));
    const stock = broadBladeStock(seed), branch = graph.branches.get(graph.rootBranchId)!;
    assert.ok(Math.abs(branch.activeLength - stock.length) < 1e-10);
    assert.ok(stock.bladeStart > 0.7 && stock.bladeStart < 1);
    assert.ok(broadBladeHalfWidth(seed, stock.bladeStart + (stock.length - stock.bladeStart) * 0.45) > 0.45);
  }
});

test("bend genuinely deforms blade surface while preserving midrib stock and exact reload geometry", () => {
  for (const seed of seeds) {
    const graph = createBroadBlade("blade", seed, BASE), before = serializePlantGraph(graph);
    const root = graph.branches.get(graph.rootBranchId)!;
    const station = sampleBranch(root, root.activeLength * 0.54).position;
    const bent = bendBranchAtFraction(graph, root.id, { x: station.x + 1.3, y: station.y - 0.45, z: station.z + 0.65 }, 0.54);
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.deepEqual(bent.branches.get(root.id)!.restLengths, root.restLengths);
    const original = geometry(graph), shaped = geometry(bent);
    assert.notDeepEqual([...shaped.getAttribute("position").array], [...original.getAttribute("position").array]);
    assert.deepEqual([...shaped.getAttribute("uv").array], [...original.getAttribute("uv").array]);
    assert.deepEqual([...shaped.getAttribute("color").array], [...original.getAttribute("color").array]);
    const loaded = deserializePlantGraph(serializePlantGraph(bent));
    const reloaded = geometry(loaded);
    assert.deepEqual([...reloaded.getAttribute("position").array], [...shaped.getAttribute("position").array]);
    assert.equal(serializePlantGraph(graph), before);
    const aimed = aimBranch(bent, root.id, bent.branches.get(root.id)!.points.at(-1)!, { x: -1.6, y: 3.4, z: 1.2 });
    assert.deepEqual(validatePlantGraph(aimed), []);
    assert.deepEqual(aimed.branches.get(root.id)!.restLengths, root.restLengths);
    original.dispose(); shaped.dispose(); reloaded.dispose();
  }
});

test("distal pruning clips the same blade without moving proximal vertices or retapering the new cut", () => {
  for (const seed of seeds) {
    const graph = createBroadBlade("blade", seed, BASE), root = graph.branches.get(graph.rootBranchId)!;
    const original = geometry(graph), originalVertices = vertexMap(original);
    const plan = previewPrune(graph, root.id, root.activeLength * 0.67);
    const preview = geometry(graph, 0, plan.distance), pruned = applyPrune(graph, plan), committed = geometry(pruned);
    assert.deepEqual([...preview.getAttribute("position").array], [...committed.getAttribute("position").array]);
    assert.deepEqual([...preview.getAttribute("uv").array], [...committed.getAttribute("uv").array]);
    const surviving = vertexMap(committed);
    let shared = 0;
    for (const [uv, vertex] of surviving) if (originalVertices.has(uv)) {
      assert.deepEqual(vertex, originalVertices.get(uv)); shared++;
    }
    assert.ok(shared > 250, "the old retained material and detail survive exactly");
    const p = committed.getAttribute("position"), lastRow = p.count - 9;
    const left = new THREE.Vector3().fromBufferAttribute(p, lastRow), right = new THREE.Vector3().fromBufferAttribute(p, lastRow + 8);
    assert.ok(left.distanceTo(right) > 0.65, "the cut has its old full width, not a new pointed tip");
    assert.equal(pruned.rootBranchId, graph.rootBranchId);
    assert.deepEqual(validatePlantGraph(pruned), []);
    const reload = geometry(deserializePlantGraph(serializePlantGraph(pruned)));
    assert.deepEqual([...reload.getAttribute("position").array], [...committed.getAttribute("position").array]);
    const petiole = geometry(applyPrune(graph, previewPrune(graph, root.id, 0.66)));
    assert.equal(petiole.getAttribute("position").count, 0, "cut below blade leaves petiole, not a miniature leaf");
    for (const g of [original, preview, committed, reload, petiole]) g.dispose();
  }
});

test("real lamina hits acquire their interpolated stock station and hold that station during prune movement", () => {
  const graph = createBroadBlade("blade", 8278, BASE);
  const root = graph.branches.get(graph.rootBranchId)!;
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const { studio, visual, scene, camera, dispose } = studioFixture(graph, width, height);
    try {
      for (const cameraPosition of [[0, 3.7, 15], [6, 5, 12], [-5, 3.8, -12]]) {
        camera.position.set(...cameraPosition as [number, number, number]);
        camera.lookAt(0, 2.5, 0); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
        const blade = visual.branches.get(root.id).blade.mesh as THREE.Mesh<THREE.BufferGeometry>;
        const position = blade.geometry.getAttribute("position"), uv = blade.geometry.getAttribute("uv");
        for (const row of [23, 36, 50]) {
          // Mid-face triangle away from the central tube. Project its exact
          // barycentre; the UV station must agree with that triangle in 3D.
          const indices = [row * 9 + 1, row * 9 + 2, (row + 1) * 9 + 1];
          const point = new THREE.Vector3(), station = indices.reduce((sum, i) => sum + uv.getX(i), 0) / 3;
          for (const i of indices) point.add(new THREE.Vector3().fromBufferAttribute(position, i).multiplyScalar(1 / 3));
          const press = studio.projectPoint(point);
          const candidate = studio.collectHitCandidates(press.clientX, press.clientY)[0];
          assert.equal(candidate?.branchId, root.id);
          assert.equal(candidate?.screenDistancePx, 0);
          assert.ok(candidate?.aimPoint, "visible blade supplies actual surface grip");
          assert.ok(Math.abs(candidate.materialDistance - station) < 1e-5);
          const slide = studio.closestProjectedPointOnBranch(graph.id, root.id, press.clientX, press.clientY);
          assert.ok(Math.abs(slide.materialDistance - station) < 1e-5);
          const plan = previewPrune(graph, root.id, station);
          studio.setCutPreview({ plantId: graph.id, plan }); scene.updateMatrixWorld(true);
          const during = studio.closestProjectedPointOnBranch(graph.id, root.id, press.clientX, press.clientY);
          assert.ok(Math.abs(during.materialDistance - station) < 1e-5);
          studio.setCutPreview(null);
        }
      }
    } finally { dispose(); }
  }
});

test("blade insertion and prune obey cancellation, save, and Undo through real coordinator", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: event => saves.push(event) });
  const prepared = prepareMaterialInsertionForApp("broad-blade", 0);
  assert.ok(prepared.ok); if (!prepared.ok) return;
  const reservation = { ordinal: prepared.ordinal, plantId: prepared.plantId, seed: prepared.seed, graph: prepared.graph };
  coordinator.beginInsert("cancel", reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("cancel");
  assert.equal(saves.length, 0); assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  coordinator.beginInsert("insert", reservation, {}, { base: BASE, valid: true }); coordinator.release("insert");
  const graph = coordinator.getDocumentSnapshot().plants.get(prepared.plantId)!;
  const before = serializePlantGraph(graph), root = graph.branches.get(graph.rootBranchId)!;
  coordinator.commandTool("prune");
  const spec = { plantId: graph.id, branchId: root.id, acquiredMaterialDistance: root.activeLength * 0.63, context: {} };
  coordinator.beginPrune("cut-cancel", spec, { distance: spec.acquiredMaterialDistance }); coordinator.pointerCancel("cut-cancel");
  assert.equal(saves.length, 1); assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
  coordinator.beginPrune("cut", spec, { distance: spec.acquiredMaterialDistance }); coordinator.release("cut");
  assert.equal(saves.length, 2);
  const cut = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
  assert.ok(cut.branches.get(root.id)!.activeLength < root.activeLength);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
  assert.deepEqual(coordinator.commandUndo(), { ok: true });
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
});


test("broad blade reuses live GPU attributes during Aim/Bend and disposes before cut topology replacement", () => {
  const graph = createBroadBlade("blade", 8278, BASE), root = graph.branches.get(graph.rootBranchId)!;
  const live = geometry(graph);
  const attributes = Object.fromEntries(["position", "normal", "color", "uv"].map(name => [name, live.getAttribute(name)]));
  const index = live.getIndex();
  const disposals: { position: THREE.BufferAttribute; index: THREE.BufferAttribute | null }[] = [];
  live.addEventListener("dispose", () => disposals.push({
    position: live.getAttribute("position") as THREE.BufferAttribute, index: live.getIndex(),
  }));
  const aimed = aimBranch(graph, root.id, root.points.at(-1)!, { x: 0.8, y: 3.8, z: 0.7 });
  const station = sampleBranch(aimed.branches.get(root.id)!, root.activeLength * 0.54).position;
  const bent = bendBranchAtFraction(aimed, root.id, { x: station.x + 0.7, y: station.y - 0.2, z: station.z + 0.3 }, 0.54);
  for (const edited of [aimed, bent, graph]) {
    updateBroadBladeGeometry(live, edited.branches.get(root.id)!, graph.seed);
    for (const name of Object.keys(attributes)) assert.equal(live.getAttribute(name), attributes[name], `${name} must reuse its GPU buffer`);
    assert.equal(live.getIndex(), index);
    assert.equal(disposals.length, 0, "ordinary shaping does not reallocate topology");
  }
  const plan = previewPrune(graph, root.id, root.activeLength * 0.67);
  updateBroadBladeGeometry(live, root, graph.seed, 0, plan.distance);
  assert.equal(disposals.length, 1);
  assert.equal(disposals[0].position, attributes.position, "dispose runs while the old buffers are still attached");
  assert.equal(disposals[0].index, index);
  assert.notEqual(live.getAttribute("position"), attributes.position);
  assert.notEqual(live.getAttribute("normal"), attributes.normal);
  assert.notEqual(live.getIndex(), index);
  const cutAttribute = live.getAttribute("position"), cutIndex = live.getIndex();
  const cut = applyPrune(graph, plan);
  updateBroadBladeGeometry(live, cut.branches.get(root.id)!, graph.seed);
  assert.equal(disposals.length, 1, "preview-to-commit has the same topology");
  assert.equal(live.getAttribute("position"), cutAttribute);
  assert.equal(live.getIndex(), cutIndex);
  updateBroadBladeGeometry(live, root, graph.seed);
  assert.equal(disposals.length, 2, "cancel/Undo restoration also releases the old cut buffers first");
  assert.equal(disposals[1].position, cutAttribute);
  assert.equal(disposals[1].index, cutIndex);
  live.dispose();
});
