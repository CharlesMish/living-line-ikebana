import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createStarryHeadGeometry } from "../../src/presentation/starryHeadGeometry.ts";
import { createStarryPincushion, serializePlantGraph, previewPrune, applyPrune } from "../../src/core/index.ts";
import { studioFixture } from "./studioFixture.ts";

test("starry bracts and florets have closed outward surfaces, deliberate bract gaps and bounded cost", () => {
  for (const seed of [8278, 9255, 10232]) {
    const g = createStarryHeadGeometry(seed), p = g.getAttribute("position"), n = g.getAttribute("normal");
    assert.ok(g.index); assert.ok(Array.from(p.array).every(Number.isFinite)); assert.ok(Array.from(n.array).every(Number.isFinite));
    assert.ok(g.index.count / 3 < 3500);
    const edges = new Map<string, number>(); let volume = 0;
    for (let i = 0; i < g.index.count; i += 3) {
      const ids = [g.index.getX(i), g.index.getX(i+1), g.index.getX(i+2)];
      const a = new THREE.Vector3().fromBufferAttribute(p, ids[0]!), b = new THREE.Vector3().fromBufferAttribute(p, ids[1]!), c = new THREE.Vector3().fromBufferAttribute(p, ids[2]!);
      volume += a.dot(b.clone().cross(c)) / 6;
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-17, "no zero-area triangles");
      for (let e=0;e<3;e++) { const key=[ids[e]!, ids[(e+1)%3]!].sort((x,y)=>x-y).join(":"); edges.set(key,(edges.get(key)??0)+1); }
    }
    assert.ok(volume > 0); assert.ok([...edges.values()].every(count=>count===2));
    const sheet = 40;
    for(let bract=0;bract<10;bract++) {
      const start=bract*sheet*2;
      assert.ok(n.getZ(start+17)>.85, "front bract faces +Z");
      assert.ok(n.getZ(start+sheet+17)<-.85, "reverse bract faces -Z");
      const angles: number[]=[];
      for(let i=0;i<sheet;i++) {
        const a=Math.atan2(p.getY(start+i),p.getX(start+i))-bract*Math.PI/5;
        angles.push(Math.atan2(Math.sin(a),Math.cos(a)));
      }
      assert.ok(Math.max(...angles)-Math.min(...angles)<Math.PI/5-.03, "bract leaves space before the next sector");
    }
    g.computeBoundingBox(); assert.ok(g.boundingBox!.max.z < .12); assert.ok(g.boundingBox!.max.x>.30);
    assert.deepEqual([...p.array], [...createStarryHeadGeometry(seed).getAttribute("position").array]); g.dispose();
  }
});

test("starry heads restore after prune/cancel and tone changes keep buffers and graph identity", () => {
  const graph=createStarryPincushion("plant-1",8278,{x:0,y:.55,z:0}), before=serializePlantGraph(graph);
  const {studio,visual,dispose}=studioFixture(graph);
  try {
    const bloom=graph.organs.get("plant-1:head-1")!, organ=visual.organs.get(bloom.id)!;
    const surfaces:THREE.Mesh[]=[];
    organ.group.traverse((node:THREE.Object3D)=>{if(node instanceof THREE.Mesh&&node.geometry.name==="living-line/starry-pincushion-head")surfaces.push(node);});
    assert.equal(surfaces.length,1);
    const head=surfaces[0]!, positions=[...head.geometry.getAttribute("position").array];
    const plan=previewPrune(graph,bloom.branchId,bloom.distance*.5);
    studio.setCutPreview({plantId:graph.id,plan}); studio.setCutPreview(null);
    studio.upsertGraph(applyPrune(graph,plan)); assert.equal(organ.group.visible,false);
    studio.upsertGraph(graph); assert.equal(organ.group.visible,true);
    studio.setBotanicalTones({"starry-pincushion":"plum"});
    assert.deepEqual([...head.geometry.getAttribute("position").array],positions);
    assert.equal(visual.organs.get(bloom.id),organ); assert.equal(serializePlantGraph(graph),before);
  } finally {dispose();}
});
