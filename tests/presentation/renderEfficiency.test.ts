import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyPrune, createFloweringBranch, createBroadBlade, previewPrune, sampleBranch, serializePlantGraph } from "../../src/core/index.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { attachStemSurface } from "../../src/presentation/stemSurface.ts";
import { updateLineGeometry, updateTubeGeometry } from "../../src/presentation/geometry.ts";
import { studioFixture } from "./studioFixture.ts";

const point = (x: number, y: number) => ({ x, y, z: 0 });
const normal = { x: 1, y: 0, z: 0 };

function buffers(geometry: THREE.BufferGeometry) {
  return { attributes: { ...geometry.attributes }, index: geometry.getIndex() };
}

test("tube deformation reuses every GPU attribute; topology changes dispose while old bindings are reachable", () => {
  const geometry = new THREE.BufferGeometry();
  const points = [point(0, 0), point(0, 1), point(0, 2)];
  updateTubeGeometry(geometry, points, .12, normal, 10, true);
  const initial = buffers(geometry);
  const initialIndexVersion = initial.index!.version;
  let disposed = 0;
  let observed: ReturnType<typeof buffers> | null = null;
  geometry.addEventListener("dispose", () => { disposed++; observed = buffers(geometry); });
  for (let i = 0; i < 40; i++) updateTubeGeometry(geometry, [points[0], point(i / 100, 1), points[2]], .12, normal, 10, true);
  assert.deepEqual(buffers(geometry), initial, "stable topology retains attribute identities");
  assert.equal(initial.index!.version, initialIndexVersion, "unchanged indices need no GPU upload during deformation");
  assert.equal(disposed, 0);
  updateTubeGeometry(geometry, points.slice(0, 2), .12, normal, 10, true);
  assert.equal(disposed, 1);
  assert.deepEqual(observed, initial, "dispose precedes all replacements");
  assert.notEqual(geometry.getAttribute("position"), initial.attributes.position);
  assert.notEqual(geometry.getIndex(), initial.index);
  const small = buffers(geometry);
  updateTubeGeometry(geometry, [], .12, normal, 10, true);
  assert.equal(disposed, 2);
  assert.deepEqual(observed, small);
  assert.equal(geometry.getAttribute("position").count, 0);
  assert.equal(geometry.getAttribute("color").count, 0);
  updateTubeGeometry(geometry, points, .12, normal, 10, true);
  assert.equal(disposed, 3, "the disposed geometry can be restored after a cut");
  geometry.dispose();
});

test("selection lines dispose before size changes and reuse attributes while aiming", () => {
  const geometry = new THREE.BufferGeometry();
  updateLineGeometry(geometry, [point(0, 0), point(0, 1)]);
  const original = geometry.getAttribute("position");
  let observed: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  geometry.addEventListener("dispose", () => { observed = geometry.getAttribute("position"); });
  updateLineGeometry(geometry, [point(0, 0), point(.4, 1)]);
  assert.equal(geometry.getAttribute("position"), original);
  assert.equal(observed, undefined);
  updateLineGeometry(geometry, [point(0, 0), point(.4, 1), point(.5, 2)]);
  assert.equal(observed, original);
  assert.notEqual(geometry.getAttribute("position"), original);
  geometry.dispose();
});

test("stem fibers retain one attribute across repeated shape frames and release mismatched binding before replacement", () => {
  const graph = createFloweringBranch("plant-1", 8278, point(0, .55));
  const branch = graph.branches.get(graph.rootBranchId)!;
  const geometry = new THREE.BufferGeometry();
  updateTubeGeometry(geometry, branch.points, branch.radius, branch.referenceNormal, 10, true);
  attachStemSurface(geometry, branch);
  const original = geometry.getAttribute("stemSurface");
  const values = [...original.array];
  for (let i = 0; i < 40; i++) attachStemSurface(geometry, branch);
  assert.equal(geometry.getAttribute("stemSurface"), original);
  assert.deepEqual([...original.array], values, "no surface-coordinate drift");
  const shortBranch = { ...branch, points: branch.points.slice(0, 3), restLengths: branch.restLengths.slice(0, 2) };
  updateTubeGeometry(geometry, shortBranch.points, branch.radius, branch.referenceNormal, 10, true);
  let observed: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  geometry.addEventListener("dispose", () => { observed = geometry.getAttribute("stemSurface"); });
  attachStemSurface(geometry, shortBranch);
  assert.equal(observed, original);
  assert.notEqual(geometry.getAttribute("stemSurface"), original);
  assert.equal(geometry.getAttribute("stemSurface").count, geometry.getAttribute("position").count);
  geometry.dispose();
});

function countSyncs(studio: any) {
  const calls: string[] = [];
  const sync = studio.syncPlantVisual.bind(studio);
  studio.syncPlantVisual = (visual: any, ...args: any[]) => { calls.push(visual.graph.id); return sync(visual, ...args); };
  return calls;
}

test("coordinator frames sync only the edited plant, with correct cancellation, commit, Undo and cloned-document replacement", () => {
  const plants = Array.from({ length: 5 }, (_, i) => createFloweringBranch(`plant-${i + 1}`, 8278 + i, point(i / 10, .55)));
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: plants.map(graph => [graph.id, graph]), camera: canonicalCameraPose("front"), selectedPlantId: plants[0].id,
  });
  const { studio, dispose } = studioFixture(plants[0]);
  const paint = () => {
    const presentation = coordinator.getPresentationState();
    const graphs = new Map(presentation.document.plants);
    if (presentation.active && "graph" in presentation.active) graphs.set(presentation.active.plantId, presentation.active.graph);
    studio.setGraphs(graphs.values());
    studio.setSelection({ plantId: plants[0].id, branchId: plants[0].rootBranchId });
  };
  try {
    paint();
    const calls = countSyncs(studio);
    const committed = coordinator.getPresentationState().document.plants;
    paint(); paint();
    assert.deepEqual(calls, [], "unchanged frame and selection skip botanical sync");
    const root = plants[0].branches.get(plants[0].rootBranchId)!;
    const grab = sampleBranch(root, root.activeLength * .8).position;
    assert.equal(coordinator.beginAim(1, { plantId: plants[0].id, branchId: root.id, grabbedMaterialDistance: root.activeLength * .8, context: {} }, { target: grab }).ok, true);
    paint(); calls.length = 0;
    for (let i = 1; i <= 20; i++) {
      coordinator.updateAim(1, { target: { ...grab, x: grab.x + i / 30 } });
      paint();
    }
    assert.deepEqual(calls, Array(20).fill(plants[0].id), "one sync per shape frame, not twice every plant");
    assert.equal(coordinator.getPresentationState().document.plants.get(plants[1].id), committed.get(plants[1].id));
    coordinator.pointerCancel(1); paint();
    assert.equal(studio.plants.get(plants[0].id).graph, committed.get(plants[0].id));
    assert.equal(serializePlantGraph(studio.plants.get(plants[0].id).graph), serializePlantGraph(plants[0]));
    coordinator.beginAim(2, { plantId: plants[0].id, branchId: root.id, grabbedMaterialDistance: root.activeLength * .8, context: {} }, { target: { ...grab, x: grab.x + .6 } });
    paint(); coordinator.release(2); paint();
    assert.notEqual(studio.plants.get(plants[0].id).graph, committed.get(plants[0].id));
    coordinator.commandUndo(); paint();
    assert.equal(serializePlantGraph(studio.plants.get(plants[0].id).graph), serializePlantGraph(plants[0]));
    calls.length = 0;
    studio.setGraphs(coordinator.getDocumentSnapshot().plants.values());
    assert.equal(calls.length, 5, "a cloned restore/Garden document still updates all plants");
    calls.length = 0;
    studio.upsertGraph(studio.plants.get(plants[0].id).graph);
    assert.deepEqual(calls, [plants[0].id], "explicit upsert remains a forced sync");
  } finally { dispose(); }
});

test("selection changes only tint and affordances, including broad blades, without disturbing prune opacity or tones", () => {
  const a = createBroadBlade("blade", 8278, point(0, .55));
  const b = createFloweringBranch("flowers", 9255, point(.3, .55));
  const { studio, dispose } = studioFixture(a);
  try {
    studio.upsertGraph(b);
    const blade = studio.plants.get(a.id).branches.get(a.rootBranchId);
    const branch = studio.plants.get(b.id).branches.get(b.rootBranchId);
    const plan = previewPrune(b, b.rootBranchId, .5);
    studio.setCutPreview({ plantId: b.id, plan });
    const flowerMaterials = [...studio.plants.get(b.id).organs.values()].flatMap((v: any) => v.bodyMaterials) as THREE.MeshStandardMaterial[];
    const modes = flowerMaterials.map(m => [m.opacity, m.transparent, m.version]);
    const calls = countSyncs(studio);
    studio.setSelection({ plantId: a.id, branchId: a.rootBranchId });
    assert.equal(blade.mesh.material.emissive.getHex(), 0x171009);
    assert.equal(blade.blade.mesh.material.emissive.getHex(), 0x171009);
    studio.setSelection({ plantId: b.id, branchId: b.rootBranchId });
    assert.equal(blade.mesh.material.emissive.getHex(), 0);
    assert.equal(blade.blade.mesh.material.emissive.getHex(), 0);
    assert.equal(branch.mesh.material.emissive.getHex(), 0x171009);
    studio.setSelection(null);
    assert.equal(branch.mesh.material.emissive.getHex(), 0);
    assert.deepEqual(calls, []);
    assert.deepEqual(flowerMaterials.map(m => [m.opacity, m.transparent, m.version]), modes);
    studio.setBotanicalTones({ "flowering-branch": "rose" });
    studio.setCutPreview(null);
    assert.ok(flowerMaterials.every(m => m.opacity === 1 && !m.transparent));
    studio.setGraphs([applyPrune(b, plan)]);
    assert.equal(studio.plants.has(a.id), false, "removing a plant is not skipped by identity caching");
  } finally { dispose(); }
});

test("invisible hit materials remain ray-pickable; debug proxies remain drawable", () => {
  const graph = createFloweringBranch("plant-1", 8278, point(0, .55));
  const { studio, visual, dispose } = studioFixture(graph);
  try {
    const branch = graph.branches.get(graph.rootBranchId)!;
    const p = studio.projectPoint(sampleBranch(branch, 1).position);
    const hit = visual.branches.get(branch.id).hit;
    assert.equal(hit.visible, true);
    assert.equal(hit.material.visible, false);
    studio.setRaycaster(p.clientX, p.clientY);
    assert.ok(studio.raycaster.intersectObject(hit, false).length > 0);
    const before = studio.collectHitCandidates(p.clientX, p.clientY);
    hit.material.visible = true;
    assert.deepEqual(studio.collectHitCandidates(p.clientX, p.clientY), before);
    studio.options.debugHitTargets = true;
    const debug = studio.createBranchVisual(graph, branch, false);
    assert.equal(debug.hit.material.visible, true);
    assert.equal(debug.hit.material.opacity, .12);
    debug.mesh.geometry.dispose(); debug.hit.geometry.dispose(); debug.selection.geometry.dispose(); debug.doomed.geometry.dispose();
  } finally { dispose(); }
});
