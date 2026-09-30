import assert from 'node:assert/strict';
import test from 'node:test';
import { StemPrevention } from '../../src/app/stemPrevention.ts';
import { createDomainAdapters } from '../../src/app/domainAdapters.ts';
import { TransactionCoordinator } from '../../src/input/TransactionCoordinator.ts';
import { canonicalCameraPose } from '../../src/app/camera.ts';
import { stem } from '../fixtures/stemOverlapFixture.ts';
import { vec3 as p, scale, add } from '../../src/core/math.ts';
import { aimBranch, applyBendRotation, bendRotationVector } from '../../src/core/edit.ts';
import { contactEnvironment, insertionContacts } from '../../src/core/stemContact.ts';
import { serializePlantGraph, createReed, successfulSeatIdentity, sampleBranch } from '../../src/core/index.ts';
import { assertRestLengthsPreserved, assertAttachmentCoincidence } from '../core/helpers.ts';
function harness(plants: Map<string, any>) {
    let enabled = true, saves = 0;
    let coordinator: any;
    const protection = new StemPrevention(() => enabled, () => coordinator.getPresentationState().document.plants.values());
    coordinator = new TransactionCoordinator(createDomainAdapters(protection), { plants, selectedPlantId: 'a', camera: canonicalCameraPose('front'), successfulPlantOrdinal: 0 }, { onAutosave: () => saves++ });
    return { coordinator, protection, saves: () => saves, off: () => enabled = false };
}
const baseSpec = { plantId: 'a', context: {} };
const graphOf = (c: any) => c.getPresentationState().active.graph;
test('base travel along a clear lateral after contact follows the request, and keeps release, Cancel and Undo exact', () => {
    const a = stem('a', [p(-.6, .55), p(-.6, 1.2), p(-.6, 1.85), p(-.6, 2.55)], .02);
    const b = stem('b', [p(0, .55, -.9), p(0, 1.75, -.9)], .03);
    const child = stem('rail', [p(0, 1.75, -.9), p(0, 1.75, .9)], .03).branches.get('rail:trunk')!;
    Object.assign(child, { kind: 'lateral', parentId: b.rootBranchId, parentDistance: 1.2, referenceNormal: p(1, 0) });
    b.branches.set(child.id, child);
    const h = harness(new Map([['a', a], ['b', b]])), c = h.coordinator;
    const before = serializePlantGraph(a);
    c.beginBase(1, baseSpec, { base: p(-.6, .55) });
    c.updateBase(1, { base: p(.6, .55) });
    assert.equal(h.protection.feedback.reason, 'contact');
    const x = graphOf(c).branches.get(a.rootBranchId).points[0].x;
    for (let i = 1; i <= 12; i++) {
        c.updateBase(1, { base: p(x, .55, i * .03) });
        assert.equal(h.protection.feedback.reason, 'clear');
        assert.ok(Math.abs(graphOf(c).branches.get(a.rootBranchId).points[0].z - i * .03) < 1e-12);
        assert.equal(insertionContacts(graphOf(c), contactEnvironment(a, [b])).length, 0);
    }
    assert.equal(h.saves(), 0);
    const displayed = serializePlantGraph(graphOf(c));
    c.release(1);
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), displayed);
    assert.equal(h.saves(), 1);
    c.commandUndo();
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    c.beginBase(2, baseSpec, { base: p(-.6, .55) });
    c.updateBase(2, { base: p(.6, .55) });
    c.pointerCancel(2);
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    assert.equal(h.saves(), 2, 'only release and Undo saved');
});
test('base preview stops, reverses immediately, commits the displayed graph, and Undo restores exact acquisition', () => {
    const a = stem('a', [p(-.6, 0), p(-.6, 2)], .02), b = stem('b', [p(0, 0), p(0, 2)], .03);
    const h = harness(new Map([['a', a], ['b', b]])), c = h.coordinator, before = serializePlantGraph(a);
    c.beginBase(1, baseSpec, { base: p(-.6, 0) });
    assert.equal(serializePlantGraph(graphOf(c)), before, 'no acquisition jump');
    c.updateBase(1, { base: p(.6, 0) });
    assert.equal(h.protection.feedback.reason, 'contact');
    const first = serializePlantGraph(graphOf(c));
    c.updateBase(1, { base: p(.6, 0) });
    assert.equal(serializePlantGraph(graphOf(c)), first, 'held target cannot creep through');
    c.updateBase(1, { base: p(-.4, 0) });
    assert.equal(h.protection.feedback.reason, 'clear', 'can back away');
    const displayed = serializePlantGraph(graphOf(c));
    assert.equal(h.saves(), 0);
    c.release(1);
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), displayed);
    assert.equal(h.saves(), 1);
    c.commandUndo();
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
    assert.equal(h.saves(), 2);
});
test('cancel, interruption and next grab cannot reuse accepted path state; off uses ordinary free motion', () => {
    const a = stem('a', [p(-.6, 0), p(-.6, 2)], .02), b = stem('b', [p(0, 0), p(0, 2)], .03);
    const h = harness(new Map([['a', a], ['b', b]])), c = h.coordinator, before = serializePlantGraph(a);
    for (const finish of ['pointerCancel', 'lostCapture', 'visibilityHidden']) {
        c.beginBase(1, baseSpec, { base: p(-.6, 0) });
        c.updateBase(1, { base: p(.6, 0) });
        c[finish](1);
        assert.equal(h.saves(), 0);
        assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), before);
        assert.equal(c.release(1).ok, false);
    }
    h.off();
    c.beginBase(2, baseSpec, { base: p(-.6, 0) });
    c.updateBase(2, { base: p(.6, 0) });
    assert.equal(graphOf(c).branches.get('a:trunk').points[0].x, .6);
});
test('Aim cannot tunnel through a branch then end clear, including changes between accepted preview directions', () => {
    const a = stem('a', [p(0, 0), p(0, 2)], .02), b = stem('b', [p(.8, 1.2, -.2), p(.8, 1.2, .2)], .03);
    const h = harness(new Map([['a', a], ['b', b]])), c = h.coordinator;
    const spec = { plantId: 'a', branchId: 'a:trunk', grabbedMaterialDistance: 2, context: {} };
    const target = p(2, 1, 0), env = contactEnvironment(a, [b]);
    assert.equal(insertionContacts(aimBranch(a, spec.branchId, p(0, 2), target), env).length, 0);
    c.beginAim(1, spec, { target: p(0, 2) });
    c.updateAim(1, { target });
    assert.equal(h.protection.feedback.reason, 'contact');
    assert.equal(insertionContacts(graphOf(c), env).length, 0);
    assertRestLengthsPreserved(a, graphOf(c));
    c.updateAim(1, { target: p(-1, 2, 0) });
    assert.equal(h.protection.feedback.reason, 'clear');
    c.updateAim(1, { target });
    assert.equal(h.protection.feedback.reason, 'contact');
});
test('Bend stops along the actual curve path and descendants stay attached; a clear requested endpoint is insufficient', () => {
    const a = stem('a', [p(0, 0), p(0, 1), p(0, 2), p(0, 3)], .01);
    const request = { branchId: 'a:trunk', stationDistance: 1.62, target: p(2, 1.62, 0) };
    const rotation = bendRotationVector(a, request), middle = applyBendRotation(a, request, scale(rotation, .5));
    const contact = sampleBranch(middle.branches.get(a.rootBranchId)!, 2.8).position;
    const b = stem('b', [add(contact, p(0, 0, -.15)), add(contact, p(0, 0, .15))], .015);
    const h = harness(new Map([['a', a], ['b', b]])), c = h.coordinator;
    c.beginBend(1, { plantId: 'a', branchId: a.rootBranchId, beadStationDistance: 1.62, touchMaterialDistance: 1.62, context: {} }, { target: p(0, 1.62, 0) });
    c.updateBend(1, { target: request.target });
    assert.equal(h.protection.feedback.reason, 'contact');
    assert.equal(insertionContacts(graphOf(c), contactEnvironment(a, [b])).length, 0);
    assertRestLengthsPreserved(a, graphOf(c));
    assertAttachmentCoincidence(graphOf(c));
    const displayed = serializePlantGraph(graphOf(c));
    c.release(1);
    assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get('a')), displayed);
});
test('insertion still follows the pointer but blocked seats do not save or consume identity', () => {
    const identity = successfulSeatIdentity(1);
    const graph = createReed(identity.id, identity.seed, p(0, .55, 0));
    const root = graph.branches.get(graph.rootBranchId)!;
    const b = stem('obstacle', root.points.map(p => ({ ...p })), .08);
    const h = harness(new Map([['obstacle', b]])), c = h.coordinator;
    const reservation = { ordinal: 1, plantId: identity.id, seed: identity.seed, graph };
    c.beginInsert(1, reservation, {}, { base: p(0, .55, 0), valid: true });
    assert.equal(c.getDebugState().active.isValid, false);
    assert.equal(h.protection.feedback.reason, 'insertion');
    c.release(1);
    assert.equal(h.saves(), 0);
    assert.equal(c.getDebugState().successfulPlantOrdinal, 0);
    c.beginInsert(2, reservation, {}, { base: p(.8, .55, 0), valid: true });
    assert.equal(c.getDebugState().active.isValid, true);
    c.release(2);
    assert.equal(h.saves(), 1);
    assert.equal(c.getDebugState().successfulPlantOrdinal, 1);
});

test('clear Aim and Bend preserve ordinary results across the twelve-material palette', async()=>{
 const {createWorkbenchFixture}=await import('../../src/app/workbench.ts');
 const {fromCanonicalPlantGraph,bendBranch,distance}=await import('../../src/core/index.ts');
 const snapshots=createWorkbenchFixture('round5-palette',8278,12,{remember:false}).plants.map(fromCanonicalPlantGraph);
 const compare=(a:any,b:any)=>{
  assert.deepEqual([...a.organs],[...b.organs]);
  for(const [id,branch]of a.branches){const other=b.branches.get(id)!;assert.deepEqual(branch.restLengths,other.restLengths);
   for(let i=0;i<branch.points.length;i++)assert.ok(distance(branch.points[i],other.points[i])<1e-10,id);
  }
 };
 for(const graph of snapshots){
  const protection=new StemPrevention(()=>true,()=>[graph]);
  const root=graph.branches.get(graph.rootBranchId)!,station=root.activeLength*.54,grip=sampleBranch(root,station).position,target=add(grip,p(.3,.1,.2));
  compare(protection.aim(graph,{plantId:graph.id,branchId:root.id,grabbedMaterialDistance:station,context:{}},target),aimBranch(graph,root.id,grip,target));
  compare(protection.bend(graph,{plantId:graph.id,branchId:root.id,stationDistance:station,variant:'bead',context:{}},target),bendBranch(graph,{branchId:root.id,stationDistance:station,target}));
 }
});

test('Bend checks a carried structural child, not only the branch being grabbed',async()=>{
 const {createNoddingFlowerV2}=await import('../../src/core/index.ts');
 const graph=createNoddingFlowerV2('a',8278,p(0,.55,0));
 const root=graph.branches.get(graph.rootBranchId)!,station=root.activeLength*.54,point=sampleBranch(root,station).position;
 const request={branchId:root.id,stationDistance:station,target:add(point,p(1,0,0))};
 const middle=applyBendRotation(graph,request,scale(bendRotationVector(graph,request),.5));
 const child=[...middle.branches.values()].find(b=>b.kind==='lateral')!;
 const at=sampleBranch(child,child.activeLength*.65).position;
 const blocker=stem('b',[add(at,p(0,0,-.07)),add(at,p(0,0,.07))],.015);
 const environment=contactEnvironment(graph,[blocker]);assert.equal(environment.exempt.size,0);
 const protection=new StemPrevention(()=>true,()=>[graph,blocker]);
 const result=protection.bend(graph,{plantId:graph.id,branchId:root.id,stationDistance:station,variant:'bead',context:{}},request.target);
 assert.equal(protection.feedback.reason,'contact');
 assert.equal(protection.feedback.marks[0].branchA,child.id);
 assert.equal(insertionContacts(result,environment).length,0);
 assertRestLengthsPreserved(graph,result);assertAttachmentCoincidence(result);
});
