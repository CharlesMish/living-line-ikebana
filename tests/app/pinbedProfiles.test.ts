import assert from "node:assert/strict";
import test from "node:test";
import { PINBED_PROFILES } from "../../src/study/pinbedProfiles.ts";
import { VESSEL_PROFILES, inPlantingArea, plantingPins, keyboardPlantingPoint, vesselParts } from "../../src/study/vesselProfiles.ts";
import { sceneStorageKeys, parseSceneStudio } from "../../src/app/scenePersistence.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { StemPrevention } from "../../src/app/stemPrevention.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createReed, successfulSeatIdentity, serializePlantGraph, toCanonicalPlantGraph, sampleBranch } from "../../src/core/index.ts";
import { assertRestLengthsPreserved } from "../core/helpers.ts";
const at = (x=0,z=0) => ({x,y:.55,z});

test("approved profiles use ordinary v2 saves, retain all earlier layouts and keep the default",()=>{
  assert.equal(VESSEL_PROFILES.length,10);
  assert.equal(VESSEL_PROFILES[0].id,"original");
  assert.deepEqual(PINBED_PROFILES.map(p=>p.id),["pinbed-small","pinbed-single","pinbed-medium-oval"]);
  const normal=sceneStorageKeys(new URL("https://example.test/"),false);
  assert.equal(normal.studio,"ikebana-web-alpha:studio-v2");
  assert.equal(normal.legacyStudio,"ikebana-web-alpha:studio-v1");
  const graph=toCanonicalPlantGraph(createReed("plant-1",8278,at()));
  for(const p of VESSEL_PROFILES){
    const raw={storageVersion:2,savedAt:"2026-10-03T00:00:00Z",nextSuccessfulOrdinal:2,plants:[graph],camera:canonicalCameraPose("front"),scene:{...DEFAULT_SCENE,layoutId:p.id}};
    const restored=parseSceneStudio(JSON.stringify(raw));
    assert.deepEqual(restored.plants,[graph]);assert.equal(restored.scene.layoutId,p.id);
  }
  assert.throws(()=>parseSceneStudio(JSON.stringify({storageVersion:2,savedAt:"2026-10-03T00:00:00Z",nextSuccessfulOrdinal:2,plants:[graph],camera:canonicalCameraPose("front"),scene:{...DEFAULT_SCENE,layoutId:"pinbed-tight"}})),/cannot be opened/);
});

test("round candidates change usable field independently of ceramic and retain the physical pin grid",()=>{
  const small=PINBED_PROFILES.slice(0,2),reference=VESSEL_PROFILES.find(p=>p.id==="vessel-pair")!.areas[0];
  for(const p of small){
    assert.deepEqual(vesselParts(p),vesselParts(small[0]));
    for(const [x,z] of plantingPins(p)){
      assert.ok(inPlantingArea(at(x,z),p));
      assert.ok(Math.abs((x+1.155)/.11-Math.round((x+1.155)/.11))<1e-8);
    }
    for(let n=1;n<=100;n++)assert.ok(inPlantingArea(keyboardPlantingPoint(n,p),p));
  }
  assert.equal(small[1].areas[0].rx,reference.rx);
  assert.ok(plantingPins(small[0]).length<plantingPins(small[1]).length);
});

for(const profile of PINBED_PROFILES)test(`${profile.id}: boundary/cancel, protected edits and v2 history remain exact`,()=>{
  let c:any,writes=0;
  const prevention=new StemPrevention(()=>true,()=>c.getDocumentSnapshot().plants.values());
  c=new TransactionCoordinator(createDomainAdapters(prevention,profile),{plants:new Map(),camera:canonicalCameraPose("front"),successfulPlantOrdinal:0},{onAutosave:()=>writes++});
  const identity=successfulSeatIdentity(1),stock=createReed(identity.id,identity.seed,at());
  const reservation={ordinal:1,plantId:identity.id,seed:identity.seed,graph:stock},area=profile.areas[0],seat=at(area.x,area.z);
  c.beginInsert(1,reservation,{}, {base:at(area.x+area.rx*1.01,area.z),valid:true});
  assert.equal(c.getDebugState().active.isValid,false);c.release(1);assert.equal(writes,0);
  c.beginInsert(2,reservation,{}, {base:seat,valid:true});c.pointerCancel(2);assert.equal(writes,0);
  c.beginInsert(3,reservation,{}, {base:seat,valid:true});c.release(3);
  const original=c.getDocumentSnapshot().plants.get(identity.id),before=serializePlantGraph(original);
  const branch=original.branches.get(original.rootBranchId),distance=branch.activeLength*.54,station=sampleBranch(branch,distance).position;
  c.beginBend(4,{plantId:identity.id,branchId:branch.id,beadStationDistance:distance,touchMaterialDistance:distance,context:{}},{target:station});
  c.updateBend(4,{target:{...station,x:station.x+.25}});assertRestLengthsPreserved(original,c.getPresentationState().active.graph);c.release(4);
  c.commandUndo();assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get(identity.id)),before);
  c.beginBase(5,{plantId:identity.id,context:{}},{base:seat});c.updateBase(5,{base:at(area.x+area.rx*2,area.z)});
  const moved=c.getPresentationState().active.graph;assert.ok(inPlantingArea(moved.branches.get(moved.rootBranchId).points[0],profile));assertRestLengthsPreserved(original,moved);
  c.pointerCancel(5);assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get(identity.id)),before);
  c.commandTool("prune");c.beginPrune(6,{plantId:identity.id,branchId:branch.id,acquiredMaterialDistance:branch.activeLength*.7,context:{}},{distance:branch.activeLength*.7});c.release(6);
  const pruned=toCanonicalPlantGraph(c.getDocumentSnapshot().plants.get(identity.id));
  const raw={storageVersion:2,savedAt:"2026-10-03T00:00:00Z",nextSuccessfulOrdinal:2,plants:[pruned],camera:canonicalCameraPose("front"),scene:{...DEFAULT_SCENE,layoutId:profile.id}};
  assert.deepEqual(parseSceneStudio(JSON.stringify(raw)).plants,[pruned]);
  c.commandUndo();assert.equal(serializePlantGraph(c.getDocumentSnapshot().plants.get(identity.id)),before);
});

test("pins are not occupied sockets: five coincident insertions stay legal with protection off",()=>{
  const p=PINBED_PROFILES[0];
  const c=new TransactionCoordinator(createDomainAdapters(undefined,p),{plants:new Map(),camera:canonicalCameraPose("front"),successfulPlantOrdinal:0});
  for(let n=1;n<=5;n++){
    const id=successfulSeatIdentity(n),graph=createReed(id.id,id.seed,at());
    c.beginInsert(n,{ordinal:n,plantId:id.id,seed:id.seed,graph},{},{base:at(),valid:true});
    assert.equal(c.getDebugState().active?.isValid,true);c.release(n);
  }
  assert.equal(c.getDocumentSnapshot().plants.size,5);
});
