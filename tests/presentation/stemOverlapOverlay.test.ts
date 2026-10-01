import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { StemOverlapOverlay, MAX_OVERLAP_MARKS } from '../../src/presentation/stemOverlapOverlay.ts';
import { ThreeStudio } from '../../src/presentation/ThreeStudio.ts';
import { stem } from '../fixtures/stemOverlapFixture.ts';
const p=(x:number,y:number,z=0)=>({x,y,z});
const a=()=>stem('a',[p(0,-1),p(0,1)]);
const b=()=>stem('b',[p(-1,0),p(1,0)]);
function camera() { const c=new THREE.PerspectiveCamera(44,390/844,.1,80);c.position.set(0,0,10);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c; }

test('contact glyph has straight angular corners and an empty centre distinct from a round bend bead',()=>{
 const overlay=new StemOverlapOverlay();
 for(const mesh of overlay.group.children as THREE.InstancedMesh[]) {
  const positions=mesh.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i+=3) {
   const pts=Array.from({length:3},(_,j)=>[positions.getX(i+j),positions.getY(i+j)]);
   assert.ok(pts.every(([x,y])=>Math.abs(x)>=.34 && Math.abs(y)>=.34),'centre stays open');
   assert.equal(new Set(pts.map(([x])=>x)).size,2,'each corner stroke is a rectangle');
   assert.equal(new Set(pts.map(([,y])=>y)).size,2);
  }
  assert.equal((mesh.material as THREE.MeshBasicMaterial).opacity,1);
  assert.equal((mesh.material as THREE.MeshBasicMaterial).toneMapped,false,'indicator contrast does not follow scene exposure');
 }
 overlay.dispose();
});

test('inspection updates and clears derived marks without changing graphs or adding pick targets',()=>{
 const overlay=new StemOverlapOverlay(),graphs=[a(),b()], c=camera();
 const before=JSON.stringify(graphs.map(g=>[...g.branches.values()]));
 assert.equal(overlay.setGraphs(graphs),1);overlay.update(c,844);
 for(const mesh of overlay.group.children as THREE.InstancedMesh[]) {
  assert.equal(mesh.count,1);assert.equal((mesh.material as THREE.MeshBasicMaterial).depthWrite,false);
  assert.equal(new THREE.Raycaster(c.position,new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,0);
 }
 assert.equal(overlay.setGraphs([graphs[0]]),0);overlay.update(c,844);
 assert.equal((overlay.group.children[0] as THREE.InstancedMesh).count,0);
 assert.equal(overlay.setGraphs(graphs),1);overlay.update(c,844);
 overlay.setGraphs(null);assert.equal(overlay.group.visible,false);
 assert.equal(JSON.stringify(graphs.map(g=>[...g.branches.values()])),before);
 overlay.dispose();
});

test('inspection brackets retain CSS size across portrait zoom and cull behind-camera contacts',()=>{
 const overlay=new StemOverlapOverlay();overlay.setGraphs([a(),b()]);
 const c=camera(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(const depth of [6,15,23]) {
  c.position.z=depth;c.updateMatrixWorld(true);overlay.update(c,844);
  (overlay.group.children[0] as THREE.InstancedMesh).getMatrixAt(0,matrix);matrix.decompose(position,q,scale);
  const pixelRadius=scale.x/depth*c.projectionMatrix.elements[5]*844/2;
  assert.ok(Math.abs(pixelRadius-9)<1e-5);
 }
 c.position.z=-10;c.updateMatrixWorld(true);overlay.update(c,844);
 assert.equal((overlay.group.children[0] as THREE.InstancedMesh).count,0);
 overlay.dispose();
});

test('dense scenes cap draw instances, not the reported overlap-area count',()=>{
 const overlay=new StemOverlapOverlay();
 const graphs=Array.from({length:12},(_,i)=>stem(String(i),[p(0,-1),p(0,1)]));
 assert.equal(overlay.setGraphs(graphs),66);overlay.update(camera(),844);
 assert.equal((overlay.group.children[0] as THREE.InstancedMesh).count,MAX_OVERLAP_MARKS);
 overlay.dispose();
});

test('Garden thumbnail hides inspection and restores it even when capture fails',()=>{
 const overlay=new StemOverlapOverlay();overlay.setGraphs([a(),b()]);
 const selected={plantId:'a',branchId:'a:trunk'};
 let restored: unknown;
 const studio=Object.assign(Object.create(ThreeStudio.prototype),{
  stemOverlaps:overlay,getSelection:()=>selected,setSelection:(s:unknown)=>{restored=s},
  renderNow:()=>{assert.equal(overlay.group.visible,false);throw new Error('capture unavailable')},
 });
 assert.equal(studio.captureThumbnail(),null);
 assert.equal(overlay.group.visible,true);assert.deepEqual(restored,selected);
 overlay.dispose();
});

test('a protection boundary is marked without falsely increasing the overlap count, and clears after release',()=>{
 const overlay=new StemOverlapOverlay();
 const mark={plantA:'a',branchA:'a:trunk',plantB:'b',branchB:'b:trunk',position:p(0,0),penetration:0};
 assert.equal(overlay.setGraphs([a()],[mark]),0);
 overlay.update(camera(),844);assert.equal((overlay.group.children[0] as THREE.InstancedMesh).count,1);
 overlay.setGraphs([a()]);overlay.update(camera(),844);
 assert.equal((overlay.group.children[0] as THREE.InstancedMesh).count,0);
 overlay.dispose();
});
