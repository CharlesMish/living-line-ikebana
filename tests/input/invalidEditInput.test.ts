import assert from 'node:assert/strict';
import test from 'node:test';
import { createDomainAdapters } from '../../src/app/domainAdapters.ts';
import { canonicalCameraPose } from '../../src/app/camera.ts';
import { TransactionCoordinator } from '../../src/input/TransactionCoordinator.ts';
import { createBotanicalTransactionAdapters } from '../../src/input/botanicalAdapters.ts';
import { applyPrune, createFloweringBranch, sampleBranch, serializePlantGraph, validatePlantGraph } from '../../src/core/index.ts';

const owner = 'finger';
const invalidResult = { ok: false, reason: 'invalid-input' };
const plant = () => createFloweringBranch('plant-1', 8278, { x: 0, y: .55, z: 0 });
const bytes = (coordinator) => serializePlantGraph(coordinator.getDocumentSnapshot().plants.get('plant-1'));

for (const kind of ['aim', 'bend', 'base', 'prune'] as const) {
  test(`production ${kind} rejects invalid acquisition and preserves last valid preview after bad updates`, () => {
    const graph = plant();
    const root = graph.branches.get(graph.rootBranchId)!;
    const station = root.activeLength * .54;
    const point = sampleBranch(root, station).position;
    const saves = [];
    const coordinator = new TransactionCoordinator(createDomainAdapters(), {
      plants: [[graph.id, graph]], camera: canonicalCameraPose('front'),
      selectedPlantId: kind === 'bend' || kind === 'base' ? graph.id : null,
      successfulPlantOrdinal: 1,
    }, { tool: kind === 'prune' ? 'prune' : 'shape', onAutosave: event => saves.push(event) });
    const originalDebug = coordinator.getDebugState();
    const spec = { plantId: graph.id, branchId: root.id, context: {},
      grabbedMaterialDistance: station, acquiredMaterialDistance: station,
      beadStationDistance: station, touchMaterialDistance: station };
    const begin = input => kind === 'aim' ? coordinator.beginAim(owner, spec, input)
      : kind === 'bend' ? coordinator.beginBend(owner, spec, input)
        : kind === 'base' ? coordinator.beginBase(owner, spec, input) : coordinator.beginPrune(owner, spec, input);
    const update = input => kind === 'aim' ? coordinator.updateAim(owner, input)
      : kind === 'bend' ? coordinator.updateBend(owner, input)
        : kind === 'base' ? coordinator.updateBase(owner, input) : coordinator.updatePrune(owner, input);
    const input = value => kind === 'prune' ? { distance: value }
      : kind === 'base' ? { base: { x: value, y: .55, z: .1 } }
        : { target: { ...point, x: value } };
    const bad = [NaN, Infinity, -Infinity, ...(kind === 'prune' ? [] : [1e308, -1e308])];
    for (const value of bad) {
      assert.deepEqual(begin(input(value)), invalidResult);
      assert.deepEqual(coordinator.getDebugState(), originalDebug);
      assert.equal(bytes(coordinator), serializePlantGraph(graph));
      assert.equal(saves.length, 0);
    }
    assert.deepEqual(begin(input(kind === 'prune' ? station : .2)), { ok: true });
    assert.deepEqual(update(input(kind === 'prune' ? station + .1 : .4)), { ok: true });
    const lastGood = structuredClone(coordinator.getPresentationState().active);
    for (const value of bad) {
      assert.deepEqual(update(input(value)), invalidResult);
      assert.deepEqual(coordinator.getPresentationState().active, lastGood);
      assert.equal(saves.length, 0);
    }
    // Invalid input does not cancel ownership or poison the next ordinary edit.
    assert.deepEqual(update(input(kind === 'prune' ? station + .2 : .6)), { ok: true });
    const final = coordinator.getPresentationState().active!;
    const expected = final.kind === 'prune' ? applyPrune(graph, final.plan) : final.graph;
    assert.deepEqual(update(input(NaN)), invalidResult);
    assert.deepEqual(coordinator.release(owner), { ok: true });
    assert.equal(bytes(coordinator), serializePlantGraph(expected));
    assert.deepEqual(validatePlantGraph(expected), []);
    assert.equal(saves.length, 1);
    assert.deepEqual(validatePlantGraph(saves[0].document.plants.get(graph.id)), []);
    assert.equal(coordinator.canUndo(), true);
    coordinator.commandUndo();
    assert.equal(bytes(coordinator), serializePlantGraph(graph));
  });
}

test('invalid insertion never consumes identity or seats last valid ghost; valid retry still works', () => {
  const graph = plant();
  const saves = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), { camera: canonicalCameraPose('front') }, {
    onAutosave: event => saves.push(event),
  });
  const reservation = { ordinal: 1, plantId: graph.id, seed: graph.seed, graph };
  const invalid = { base: { x: NaN, y: .55, z: 0 }, valid: true };
  const valid = { base: { x: .1, y: .55, z: 0 }, valid: true };
  assert.deepEqual(coordinator.beginInsert(owner, reservation, {}, invalid), invalidResult);
  assert.equal(coordinator.getDebugState().active, null);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.deepEqual(coordinator.beginInsert(owner, reservation, {}, valid), { ok: true });
  const ghost = coordinator.getPresentationState().active!.graph;
  assert.deepEqual(coordinator.updateInsert(owner, invalid), invalidResult);
  assert.deepEqual(coordinator.getPresentationState().active!.graph, ghost);
  coordinator.release(owner);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(saves.length, 0);
  coordinator.beginInsert(owner, reservation, {}, valid);
  coordinator.release(owner);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 1);
  assert.equal(saves.length, 1);
});

test('production guards head rotation, acquired surface grip, and camera without saving invalid values', () => {
  const graph = plant();
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: [[graph.id, graph]], camera: canonicalCameraPose('front'),
  });
  const target = sampleBranch(graph.branches.get(graph.rootBranchId)!, 2).position;
  const spec = { plantId: graph.id, branchId: graph.rootBranchId, grabbedMaterialDistance: 2, context: {} };
  for (const value of [NaN, Infinity, 1e308]) {
    assert.deepEqual(coordinator.beginAim(owner, spec, { target, headRotation: { x: value, y: 0, z: 0, w: 1 } }), invalidResult);
    assert.deepEqual(coordinator.beginAim(owner, { ...spec, context: { surfaceGrip: { ...target, z: value } } }, { target }), invalidResult);
  }
  coordinator.commandPosture('step-back');
  const pose = canonicalCameraPose('above');
  assert.deepEqual(coordinator.beginCamera(owner, {}, { pose: { ...pose, up: { x: NaN, y: 1, z: 0 } } }), invalidResult);
  assert.deepEqual(coordinator.beginCamera(owner, {}, { pose }), { ok: true });
  assert.deepEqual(coordinator.updateCamera(owner, { pose: { ...pose, target: { x: Infinity, y: 1, z: 0 } } }), invalidResult);
  coordinator.release(owner);
  assert.deepEqual(coordinator.getDocumentSnapshot().camera, pose);
});

test('renderer-free botanical adapter enforces validation through generic coordinator, retaining camera policy injection', () => {
  const graph = plant();
  const adapters = createBotanicalTransactionAdapters({ clone: x => x, update: (_x, input: number) => input,
    validateInput: Number.isFinite });
  const coordinator = new TransactionCoordinator(adapters, { plants: [[graph.id, graph]], camera: 0 }, { tool: 'prune' });
  const spec = { plantId: graph.id, branchId: graph.rootBranchId, acquiredMaterialDistance: 2, context: null };
  assert.deepEqual(coordinator.beginPrune(owner, spec, { materialDistance: NaN }), invalidResult);
  coordinator.beginPrune(owner, spec, { materialDistance: 2 });
  const plan = structuredClone(coordinator.getPresentationState().active);
  assert.deepEqual(coordinator.updatePrune(owner, { materialDistance: Infinity }), invalidResult);
  assert.deepEqual(coordinator.getPresentationState().active, plan);
  coordinator.cancel(owner);
  coordinator.commandPosture('step-back');
  assert.deepEqual(coordinator.beginCamera(owner, null, NaN), invalidResult);
  coordinator.beginCamera(owner, null, 1);
  assert.deepEqual(coordinator.updateCamera(owner, Infinity), invalidResult);
  coordinator.release(owner);
  assert.equal(coordinator.getDocumentSnapshot().camera, 1);
});
