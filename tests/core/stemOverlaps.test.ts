import assert from 'node:assert/strict';
import test from 'node:test';
import { closestStemSegments, findStemOverlaps } from '../../src/core/stemOverlaps.ts';
import { distance, type Vec3 } from '../../src/core/math.ts';
import { stem } from '../fixtures/stemOverlapFixture.ts';
import { applyPrune, previewPrune } from '../../src/core/prune.ts';


const p = (x: number, y: number, z = 0) => ({x,y,z});
const upright = () => stem('a',[p(0,0),p(0,2)]);
const crossing = (z = 0) => stem('b',[p(-1,1,z),p(1,1,z)]);

test('3D thickness distinguishes penetration, projected crossing, grazing and parallel stems', () => {
  assert.equal(findStemOverlaps([upright(),crossing()]).length,1);
  assert.equal(findStemOverlaps([upright(),crossing(.21)]).length,0);
  assert.equal(findStemOverlaps([upright(),crossing(.2)]).length,0,'exact touching');
  assert.equal(findStemOverlaps([upright(),crossing(.195)]).length,0,'tiny envelope grazing');
  assert.equal(findStemOverlaps([upright(),crossing(.15)]).length,1);
  assert.equal(findStemOverlaps([upright(),stem('b',[p(.1,0),p(.1,2)])]).length,1);
  assert.equal(findStemOverlaps([upright(),stem('b',[p(.3,0),p(.3,2)])]).length,0);
});

test('finite closest-segment calculation handles skew, parallel, endpoints and zero-length segments', () => {
  const cases = [
    [p(0,0),p(0,2),p(-1,1,1),p(1,1,1),1],
    [p(0,0),p(0,2),p(1,0),p(1,2),1],
    [p(0,0),p(0,1),p(0,2),p(0,3),1],
    [p(0,0),p(0,0),p(-1,1),p(1,1),1],
    [p(0,0),p(0,0),p(0,0),p(0,0),0],
  ] as const;
  for(const [a,b,c,d,expected] of cases) {
    const points = closestStemSegments(a,b,c,d);
    assert.ok(Math.abs(distance(...points)-expected)<1e-10);
    assert.ok(Math.abs(distance(...closestStemSegments(c,d,a,b))-expected)<1e-10);
  }
});

test('adjacent segment hits collapse but separated crossings of the same pair remain', () => {
  const a=stem('a',[p(0,0),p(0,1),p(0,2),p(0,3),p(0,4),p(0,5)]);
  const b=stem('b',[p(-1,.5),p(0,.5),p(1,.5),p(1,2),p(1,3.5),p(0,3.5),p(-1,3.5)]);
  assert.equal(findStemOverlaps([a,b]).length,2);
  const parallel=stem('b',[p(.1,0),p(.1,1),p(.1,2),p(.1,3),p(.1,4),p(.1,5)]);
  assert.equal(findStemOverlaps([a,parallel]).length,1);
});

test('detector is deterministic and nonmutating; ignores inactive, same-plant and organ stalk records', () => {
  const a=upright(), b=crossing();
  const before=JSON.stringify([...a.branches.values()]);
  assert.deepEqual(findStemOverlaps([a,b]),findStemOverlaps([b,a]));
  assert.equal(JSON.stringify([...a.branches.values()]),before);
  const branch=b.branches.get(b.rootBranchId)!;
  branch.active=false;
  assert.equal(findStemOverlaps([a,b]).length,0);
  branch.active=true; branch.kind='pedicel';
  assert.equal(findStemOverlaps([a,b]).length,0);
  branch.kind='lateral'; a.branches.set(branch.id,branch);
  assert.equal(findStemOverlaps([a]).length,0,'natural same-plant attachments are out of scope');
});

test('pruned distal material no longer contributes, while cancelled source still does', () => {
  const a=upright(), b=crossing();
  const pruned=applyPrune(a,previewPrune(a,a.rootBranchId,.7));
  assert.equal(findStemOverlaps([pruned,b]).length,0);
  assert.equal(findStemOverlaps([a,b]).length,1);
});
