import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSilverSeed, serializePlantGraph, previewPrune, applyPrune } from "../../src/core/index.ts";
import { createSeedDiscGeometry, createSeedDiscRimGeometry } from "../../src/presentation/seedDiscGeometry.ts";
import { studioFixture } from "./studioFixture.ts";
const SEEDS = [8278, 9255, 10232];

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
    const rim = createSeedDiscRimGeometry(seed), rp = rim.getAttribute("position"), ri = rim.index!;
    assert.ok(Array.from(rp.array).every(Number.isFinite));
    assert.ok(Array.from(rim.getAttribute("normal").array).every(Number.isFinite));
    let rimVolume = 0;
    const rimEdges = new Map<string, number>();
    for (let tri = 0; tri < ri.count / 3; tri++) {
      const v = [ri.getX(tri*3), ri.getX(tri*3+1), ri.getX(tri*3+2)];
      const a = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3));
      const b = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+1));
      const c = new THREE.Vector3().fromBufferAttribute(rp,ri.getX(tri*3+2));
      rimVolume += a.dot(b.clone().cross(c))/6;
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16);
      for (let e=0; e<3; e++) { const key = [v[e]!,v[(e+1)%3]!].sort((x,y)=>x-y).join(":"); rimEdges.set(key,(rimEdges.get(key)??0)+1); }
    }
    assert.ok(rimVolume > 0, "rim tube has outward winding independently of the membrane");
    assert.ok([...rimEdges.values()].every(count => count === 2), "the entire accessory is a closed rim, with no open strips");
    assert.ok(rim.getAttribute("normal").getX(0) > .9);
    g.dispose();rim.dispose();
  }
});

test("seed-disc accessory stays at the perimeter rather than drawing leaf veins across the septum", () => {
  for (const seed of SEEDS) {
    const membrane = createSeedDiscGeometry(seed), rim = createSeedDiscRimGeometry(seed);
    try {
      const p = membrane.getAttribute("position"), ix = membrane.index!, faceSize = p.count / 2;
      // Find the front face's boundary from topology, independently of its ring
      // count. Every accessory point must be within the existing narrow rim of
      // this perimeter; a closed interior ridge would also fail this check.
      const edges = new Map<string, { a: number; b: number; count: number }>();
      for (let i=0; i<ix.count; i+=3) {
        const vertices = [ix.getX(i), ix.getX(i+1), ix.getX(i+2)];
        if (vertices.some(v => v >= faceSize)) continue;
        for (let e=0; e<3; e++) {
          const a = vertices[e]!, b = vertices[(e+1)%3]!, key = [a,b].sort((x,y)=>x-y).join(":");
          const old = edges.get(key); edges.set(key, { a, b, count: (old?.count ?? 0) + 1 });
        }
      }
      const perimeter = [...edges.values()].filter(edge => edge.count === 1);
      assert.ok(perimeter.length > 0);
      const rp = rim.getAttribute("position");
      for (let i=0; i<rp.count; i++) {
        let distance = Infinity;
        for (const { a, b } of perimeter) {
          const dx = p.getX(b)-p.getX(a), dy = p.getY(b)-p.getY(a);
          const t = Math.max(0, Math.min(1, ((rp.getX(i)-p.getX(a))*dx + (rp.getY(i)-p.getY(a))*dy)/(dx*dx+dy*dy)));
          distance = Math.min(distance, Math.hypot(rp.getX(i)-p.getX(a)-t*dx, rp.getY(i)-p.getY(a)-t*dy));
        }
        assert.ok(distance <= .008001, `seed ${seed} accessory vertex ${i} stays at the perimeter (${distance})`);
      }
    } finally { membrane.dispose(); rim.dispose(); }
  }
});

test("both septum faces have deterministic, finite, softly varying paper colour", () => {
  for (const seed of SEEDS) {
    const g = createSeedDiscGeometry(seed), repeat = createSeedDiscGeometry(seed);
    try {
      const color = g.getAttribute("color"), ix = g.index!, faceSize = color.count / 2;
      assert.deepEqual(color.array, repeat.getAttribute("color").array);
      assert.ok(Array.from(color.array).every(value => Number.isFinite(value) && value >= .88 && value <= 1));
      for (let side=0; side<2; side++) {
        const shades = Array.from({ length: faceSize }, (_, i) => color.getX(side*faceSize+i));
        const variation = Math.max(...shades)-Math.min(...shades);
        assert.ok(variation > .012 && variation < .065, `seed ${seed} side ${side}: restrained variation ${variation}`);
      }
      for (let i=0; i<ix.count; i+=3) for (let edge=0; edge<3; edge++) {
        const a = ix.getX(i+edge), b = ix.getX(i+(edge+1)%3);
        assert.ok(Math.abs(color.getX(a)-color.getX(b)) < .03, "neighbouring vertices do not form sharp surface markings");
      }
    } finally { g.dispose(); repeat.dispose(); }
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
    assert.equal(triangles,10020);
  } finally {dispose();}
});
