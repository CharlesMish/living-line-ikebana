import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSilverSeed, serializePlantGraph, previewPrune, applyPrune } from "../../src/core/index.ts";
import { createSeedDiscGeometry, createSeedDiscRimGeometry } from "../../src/presentation/seedDiscGeometry.ts";
import { studioFixture } from "./studioFixture.ts";
const SEEDS = [8278, 9255, 10232];

function surfaceZ(g: THREE.BufferGeometry, x: number, y: number, front: boolean): number {
  const p = g.getAttribute("position"), ix = g.index!, faceTriangles = 9 * 48;
  for (let i = (front ? 0 : faceTriangles * 3); i < (front ? faceTriangles * 3 : faceTriangles * 6); i += 3) {
    const a = ix.getX(i), b = ix.getX(i+1), c = ix.getX(i+2);
    const ax = p.getX(a), ay = p.getY(a), bx = p.getX(b), by = p.getY(b), cx = p.getX(c), cy = p.getY(c);
    const d = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    const u = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d, v = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d;
    if (u >= -1e-7 && v >= -1e-7 && u+v <= 1+1e-7) return u*p.getZ(a)+v*p.getZ(b)+(1-u-v)*p.getZ(c);
  }
  throw Error("outside membrane");
}

test("dry discs are finite thin closed surfaces with outward normals on both faces and a real edge", () => {
  for (const seed of SEEDS) {
    const g = createSeedDiscGeometry(seed), p = g.getAttribute("position"), n = g.getAttribute("normal");
    assert.ok(Array.from(p.array).every(Number.isFinite)); assert.ok(Array.from(n.array).every(Number.isFinite));
    const edges = new Map<string, number>(); let volume = 0;
    for (let i=0; i<g.index!.count; i+=3) {
      const v = [g.index!.getX(i), g.index!.getX(i+1), g.index!.getX(i+2)];
      const a = new THREE.Vector3().fromBufferAttribute(p,v[0]!), b = new THREE.Vector3().fromBufferAttribute(p,v[1]!), c = new THREE.Vector3().fromBufferAttribute(p,v[2]!);
      volume += a.dot(b.clone().cross(c))/6;
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16);
      for (let e=0;e<3;e++) { const key = [v[e]!,v[(e+1)%3]!].sort((x,y)=>x-y).join(":"); edges.set(key,(edges.get(key)??0)+1); }
    }
    assert.ok(volume > .001); assert.ok([...edges.values()].every(n=>n===2));
    assert.ok(n.getZ(0) > .9); assert.ok(n.getZ(241) < -.9);
    assert.ok(g.boundingBox!.max.z-g.boundingBox!.min.z < .045);
    assert.ok(g.boundingBox!.max.x-g.boundingBox!.min.x > .5);
    assert.equal(g.boundingBox!.min.y,0); assert.ok(g.boundingBox!.max.y > .63);
    const rim = createSeedDiscRimGeometry(seed,g), rp = rim.getAttribute("position"), ri = rim.index!;
    assert.ok(Array.from(rp.array).every(Number.isFinite));
    let rimVolume = 0;
    for (let tri = 0; tri < 480; tri++) {
      const a = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3));
      const b = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+1));
      const c = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+2));
      rimVolume += a.dot(b.cross(c))/6;
    }
    assert.ok(rimVolume > 0, "rim tube has outward winding independently of the membrane");
    assert.ok(rim.getAttribute("normal").getX(0) > .9);
    // Ribbons must remain on their own side BETWEEN vertices too. Each face has
    // seven strips with twelve rows and two triangles per row; rim is480triangles.
    for (let tri=480;tri<ri.count/3;tri++) {
      const side=tri<480+7*12*2?1:-1;
      const a=new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3));
      const b=new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+1));
      const c=new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+2));
      const normal=b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(normal.z*side>0,"each ribbon faces away from its membrane");
      for(let u=0;u<=8;u++) for(let v=0;v<=8-u;v++) {
        const q=a.clone().multiplyScalar(u/8).addScaledVector(b,v/8).addScaledVector(c,1-(u+v)/8);
        assert.ok(side*(q.z-surfaceZ(g,q.x,q.y,side===1))>.00015,`seed${seed} tri${tri} never pierces membrane`);
      }
    }
    g.dispose();rim.dispose();
  }
});

test("both disc faces acquire the correct stalk at phone projection; their edge and silhouette match their exact proxy", () => {
  for (const seed of SEEDS) {
    const graph=createSilverSeed("plant-1",seed,{x:0,y:.55,z:0}); const { studio,visual,camera,scene,dispose }=studioFixture(graph);
    try {
      for(const o of graph.organs.values()) {
        const v=visual.organs.get(o.id)!;
        const membrane=v.group.children.find((n:THREE.Object3D)=>n instanceof THREE.Mesh&&n.geometry.name==="living-line/seed-disc") as THREE.Mesh;
        const rim=v.group.children.find((n:THREE.Object3D)=>n instanceof THREE.Mesh&&n.geometry.name==="living-line/seed-disc-rim") as THREE.Mesh;
        assert.equal(v.hit.geometry.getAttribute("position").count,membrane.geometry.getAttribute("position").count+rim.geometry.getAttribute("position").count);
        assert.deepEqual(Array.from(v.hit.geometry.getAttribute("position").array).slice(0,membrane.geometry.getAttribute("position").array.length),Array.from(membrane.geometry.getAttribute("position").array));
        v.group.updateWorldMatrix(true,true);
        const center=v.group.localToWorld(new THREE.Vector3(.075,.32,.02));
        const normal=new THREE.Vector3(0,0,1).transformDirection(v.group.matrixWorld);
        for(const side of [1,-1]) {
          camera.position.copy(center).addScaledVector(normal,side*7); camera.up.set(0,1,0); camera.lookAt(center); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
          const hit=studio.collectHitCandidates(195,422)[0];
          assert.equal(hit?.organId,o.id,`seed${seed} ${o.id} side${side}`);assert.equal(hit?.branchId,o.branchId); assert.equal(hit?.screenDistancePx,0);
        }
      }
    } finally {dispose();}
  }
});

test("seed discs restore opacity and identical geometry after prune/cancel, and tone changes keep bounded draw cost", () => {
  const graph=createSilverSeed("plant-1",8278,{x:0,y:.55,z:0}),before=serializePlantGraph(graph);
  const {studio,visual,dispose}=studioFixture(graph);
  try {
    const o=[...graph.organs.values()][0]!, v=visual.organs.get(o.id)!;
    const mesh=v.group.children[0] as THREE.Mesh; const positions=Array.from(mesh.geometry.getAttribute("position").array);
    const plan=previewPrune(graph,o.branchId,o.distance*.5);
    studio.setCutPreview({plantId:graph.id,plan}); assert.ok(v.bodyMaterials.every((m:THREE.Material)=>m.transparent));
    studio.setCutPreview(null); assert.ok(v.bodyMaterials.every((m:THREE.Material)=>!m.transparent&&m.opacity===1));
    studio.upsertGraph(applyPrune(graph,plan));assert.equal(v.group.visible,false);
    studio.upsertGraph(graph);assert.equal(v.group.visible,true);
    studio.setBotanicalTones({"silver-seed":"straw"});
    assert.equal((mesh.material as THREE.MeshStandardMaterial).color.getHex(),0xd3bc8d);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute("position").array),positions);assert.equal(serializePlantGraph(graph),before);
    let draws=0,triangles=0;
    visual.group.traverse((n:THREE.Object3D)=>{if(n instanceof THREE.Mesh&&n.visible&&!n.userData?.targetKind){draws++;triangles+=(n.geometry.index?.count??n.geometry.getAttribute("position").count)/3;}});
    assert.equal(draws,22);assert.ok(triangles<14000,`triangles=${triangles}`);
    assert.equal(triangles,12036);
  } finally {dispose();}
});
