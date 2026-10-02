import { stem } from '../fixtures/stemOverlapFixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { VESSEL_PROFILES, readVesselStudy, inPlantingArea, constrainBaseToProfile, keyboardPlantingPoint, vesselStudyStorageKey } from '../../src/study/vesselProfiles.ts';
import { createDomainAdapters } from '../../src/app/domainAdapters.ts';
import { StemPrevention } from '../../src/app/stemPrevention.ts';
import { TransactionCoordinator } from '../../src/input/TransactionCoordinator.ts';
import { canonicalCameraPose } from '../../src/app/camera.ts';
import { createReed, createFloweringBranch, serializePlantGraph, successfulSeatIdentity, sampleBranch, toCanonicalPlantGraph, fromCanonicalPlantGraph, applyPrune, previewPrune } from '../../src/core/index.ts';
import { assertRestLengthsPreserved, assertAttachmentCoincidence } from '../core/helpers.ts';
import { GardenStore } from '../../src/app/garden.ts';
import { CommittedStore } from '../../src/app/persistence.ts';
const point = (x: number, z = 0) => ({ x, y: .55, z });
const profile = (id: string) => VESSEL_PROFILES.find(p => p.id === id)!;
function harness(id: string, plants = new Map(), protectedOn = false) {
  let coordinator: any, saves = 0;
  const protection = new StemPrevention(() => protectedOn, () => coordinator.getPresentationState().document.plants.values());
  coordinator = new TransactionCoordinator(createDomainAdapters(protection, profile(id)), {
    plants, selectedPlantId: plants.keys().next().value ?? null, camera: canonicalCameraPose('front'), successfulPlantOrdinal: 0,
  }, { onAutosave: () => saves++ });
  return { c: coordinator, protection, saves: () => saves };
}
const active = (c: any) => c.getPresentationState().active.graph;

test('profile opt-in and namespaces preserve normal play and isolate every study', () => {
  assert.equal(readVesselStudy(new URL('https://example.test/?vesselStudy=unknown')), undefined);
  assert.equal(readVesselStudy(new URL('https://example.test/')), undefined);
  assert.equal(vesselStudyStorageKey(undefined, 'studio'), undefined);
  const keys = VESSEL_PROFILES.flatMap(p => ['studio', 'garden', 'telemetry'].flatMap(k => [false, true].map(w => vesselStudyStorageKey(p, k as any, w))));
  assert.equal(new Set(keys).size, VESSEL_PROFILES.length * 6);
});

test('keyboard placements and each visible footprint agree; the island gap and offset empty water reject seats', () => {
  for (const p of VESSEL_PROFILES) for (let ordinal = 1; ordinal <= 100; ordinal++) {
    assert.ok(inPlantingArea(keyboardPlantingPoint(ordinal, p), p));
  }
  assert.equal(inPlantingArea(point(0), profile('islands')), false);
  assert.equal(inPlantingArea(point(.5), profile('offset')), false);
  assert.equal(inPlantingArea(point(-.45), profile('offset')), true);
  assert.equal(inPlantingArea(point(.671), profile('petite')), false);
});

for (const p of VESSEL_PROFILES) test(`${p.id}: invalid seat/cancel preserves ordinal, valid release saves exact full graph`, () => {
  const { c, saves } = harness(p.id);
  const identity = successfulSeatIdentity(1);
  const graph = createReed(identity.id, identity.seed, point(0));
  const reservation = { ordinal: 1, plantId: identity.id, seed: identity.seed, graph };
  c.beginInsert(1, reservation, {}, { base: point(4), valid: true });
  assert.equal(c.getDebugState().active.isValid, false);
  c.release(1);
  assert.equal(saves(), 0); assert.equal(c.getDebugState().successfulPlantOrdinal, 0);
  const seat = keyboardPlantingPoint(1, p);
  c.beginInsert(2, reservation, {}, { base: seat, valid: true });
  c.pointerCancel(2); assert.equal(saves(), 0);
  c.beginInsert(3, reservation, {}, { base: seat, valid: true });
  const displayed = serializePlantGraph(active(c));
  c.release(3);
  assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get(identity.id)), displayed);
  assert.equal(saves(), 1); assert.equal(c.getDebugState().successfulPlantOrdinal, 1);
  assertRestLengthsPreserved(graph, c.getDocumentSnapshot().plants.get(identity.id));
});

test('split bases stay on the acquired island, including with protection enabled; release/cancel/Undo remain exact', () => {
  for (const protectedOn of [false, true]) {
    const a = createReed('a', 8278, point(-.75));
    const h = harness('islands', new Map([['a', a]]), protectedOn), c = h.c;
    const before = serializePlantGraph(a), spec = { plantId: 'a', context: {} };
    c.beginBase(1, spec, { base: point(-.75) });
    c.updateBase(1, { base: point(.75) });
    const moved = active(c), root = moved.branches.get(moved.rootBranchId).points[0];
    assert.ok(root.x < -.32 && root.x > -.34); assert.ok(inPlantingArea(root, profile('islands')));
    assertRestLengthsPreserved(a, moved);
    const displayed = serializePlantGraph(moved);
    c.release(1); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), displayed);
    c.commandUndo(); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    c.beginBase(2, spec, { base: point(-.75) }); c.updateBase(2, { base: point(.75) }); c.pointerCancel(2);
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    assert.equal(h.saves(), 2);
  }
});

test('legacy out-of-field roots do not jump on acquisition or get silently migrated', () => {
  const original = point(1.1, .2), p = profile('petite');
  const clamped = constrainBaseToProfile(original, original, p);
  assert.deepEqual(clamped, original);
  const a = createReed('a', 8278, original), { c } = harness('petite', new Map([['a', a]]));
  const before = serializePlantGraph(a);
  c.beginBase(1, { plantId: 'a', context: {} }, { base: original });
  assert.equal(serializePlantGraph(active(c)), before);
  c.pointerCancel(1); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
});

test('protection still rejects a collided insertion inside an experimental footprint', () => {
  const identity = successfulSeatIdentity(1), base = point(-.75);
  const graph = createReed(identity.id, identity.seed, base), obstacle = createReed('old', identity.seed, base);
  const h = harness('islands', new Map([['old', obstacle]]), true);
  h.c.beginInsert(1, { ordinal: 1, plantId: identity.id, seed: identity.seed, graph }, {}, { base, valid: true });
  assert.equal(h.c.getDebugState().active.isValid, false);
  assert.equal(h.protection.feedback.reason, 'insertion');
  h.c.release(1); assert.equal(h.saves(), 0);
});

for (const p of VESSEL_PROFILES) test(`${p.id}: bend keeps stock; prune/Undo keeps exact historical records`, () => {
  const a = createReed('a', 8278, keyboardPlantingPoint(1, p)), { c } = harness(p.id, new Map([['a', a]]), true);
  const branch = a.branches.get(a.rootBranchId)!, distance = branch.activeLength * .54;
  const station = sampleBranch(branch, distance).position;
  c.beginBend(1, { plantId: 'a', branchId: a.rootBranchId, beadStationDistance: distance, touchMaterialDistance: distance, context: {} }, { target: station });
  c.updateBend(1, { target: { ...station, x: station.x + .3 } });
  assertRestLengthsPreserved(a, active(c)); assertAttachmentCoincidence(active(c));
  c.release(1);
  const before = serializePlantGraph(c.getDocumentSnapshot().plants.get('a'));
  c.commandTool('prune');
  c.beginPrune(2, { plantId: 'a', branchId: a.rootBranchId, acquiredMaterialDistance: branch.activeLength * .65, context: {} }, { distance: branch.activeLength * .65 });
  c.release(2);
  assert.notEqual(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
  c.commandUndo(); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
});

test('experimental working saves and Garden round-trip canonical old/pruned graphs without touching original bowl', () => {
  const values = new Map<string, string>();
  const memory = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
  const a = createFloweringBranch('plant-1', 8278, point(.9));
  const root = a.branches.get(a.rootBranchId)!;
  const pruned = applyPrune(a, previewPrune(a, root.id, root.activeLength * .65));
  const plants = [toCanonicalPlantGraph(pruned)];
  new CommittedStore().save(2, plants);
  const original = values.get('ikebana-web-alpha:studio-v1');
  for (const p of VESSEL_PROFILES) {
    const store = new CommittedStore(vesselStudyStorageKey(p, 'studio'));
    assert.equal(store.load(), null);
    store.save(2, plants);
    assert.equal(JSON.stringify(store.load()!.plants), JSON.stringify(plants));
    const garden = new GardenStore(vesselStudyStorageKey(p, 'garden'), memory); garden.load();
    garden.keep({ id: 'old-bowl', title: 'Legacy', keptAt: '2026-10-02T00:00:00Z', thumbnail: null, arrangement: { plants, successfulPlantOrdinal: 1, camera: canonicalCameraPose('front') } });
    const restored = garden.load().entries[0].arrangement.plants[0];
    assert.equal(serializePlantGraph(fromCanonicalPlantGraph(restored)), serializePlantGraph(pruned));
    store.clear();
  }
  assert.equal(values.get('ikebana-web-alpha:studio-v1'), original);
});


test('expanded fields preserve bases beyond the original clamp and retain contact stopping', () => {
  for (const protectedOn of [false, true]) {
    const a = createReed('a', 8278, point(1.65)), { c } = harness('vessel-pair', new Map([['a', a]]), protectedOn);
    const before = serializePlantGraph(a), spec = { plantId: 'a', context: {} };
    assert.ok(c.beginBase(1, spec, { base: point(1.65) }).ok);
    assert.equal(serializePlantGraph(active(c)), before, 'no acquisition snap to old r=1.22');
    c.updateBase(1, { base: point(-1.65) });
    const root = active(c).branches.get(a.rootBranchId).points[0];
    assert.ok(Math.abs(root.x - 1.19) < 1e-10, 'right bowl does not hand over to left bowl');
    c.pointerCancel(1); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    c.beginBase(2, spec, { base: point(1.65) }); c.updateBase(2, { base: point(2.0) });
    assert.ok(Math.abs(active(c).branches.get(a.rootBranchId).points[0].x - 2) < 1e-10);
    c.release(2); c.commandUndo(); assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
  }
  const a = stem('a', [{x:1.3,y:.55,z:0},{x:1.3,y:2.5,z:0}], .02);
  const b = stem('b', [{x:1.7,y:.55,z:0},{x:1.7,y:2.5,z:0}], .02);
  const h = harness('vessel-pair', new Map([['a',a],['b',b]]), true);
  h.c.beginBase(1, {plantId:'a',context:{}}, {base:point(1.3)});
  h.c.updateBase(1, {base:point(2)});
  assert.equal(h.protection.feedback.reason, 'contact');
  assert.ok(active(h.c).branches.get(a.rootBranchId).points[0].x < 1.7);
});

test('long bed admits its distant ends while rejecting narrow-side water', () => {
  const p = profile('long-bed');
  assert.ok(inPlantingArea(point(-1.74, -.22), p));
  assert.ok(inPlantingArea(point(1.14, -.22), p));
  assert.equal(inPlantingArea(point(-.3, -.22 + .161), p), false);
  const a = createReed('a',8278,point(-1.6,-.22)), {c}=harness('long-bed',new Map([['a',a]]),true);
  const before=serializePlantGraph(a);
  c.beginBase(1,{plantId:'a',context:{}},{base:point(-1.6,-.22)});
  assert.equal(serializePlantGraph(active(c)),before);
  c.updateBase(1,{base:point(-1.7,-.22)});
  assert.ok(Math.abs(active(c).branches.get(a.rootBranchId).points[0].x+1.7)<1e-10);
});
