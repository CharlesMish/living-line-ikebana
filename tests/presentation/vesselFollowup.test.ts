import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { VESSEL_PROFILES, inVesselWater, plantingPins } from '../../src/study/vesselProfiles.ts';
import { DEFAULT_VESSEL_APPEARANCE, VESSEL_COLORS, VESSEL_FINISHES, resolveVesselAppearance, resolveVesselPresentation, readVesselAppearance, vesselAppearanceURL } from '../../src/study/vesselAppearance.ts';
import { createVesselGrain } from '../../src/presentation/vesselAppearance.ts';
import { innerWallRadiusAt, WATER_Y, waterlineCrossings } from '../../src/presentation/waterline.ts';
import { createReed, serializePlantGraph } from '../../src/core/index.ts';
import { studioFixture } from './studioFixture.ts';
const pair = VESSEL_PROFILES.find(p=>p.id==='vessel-pair')!;

test('separate bowls have disjoint ceramic, separate water meshes and no surface or pins in the gap', () => {
  const {studio,scene,dispose}=studioFixture(createReed('a',8278,{x:-1.65,y:.55,z:0}));
  Object.assign(studio.options,{vesselProfile:pair});
  studio.buildStudio();scene.updateMatrixWorld(true);
  try {
    const left = scene.getObjectByName('vessel:left')!, right=scene.getObjectByName('vessel:right')!;
    const a=new THREE.Box3().setFromObject(left),b=new THREE.Box3().setFromObject(right);
    assert.ok(Math.abs((b.min.x-a.max.x)-.4488)<1e-6);
    const surfaces=[left,right,scene.getObjectByName('vessel-water:left')!,scene.getObjectByName('vessel-water:right')!];
    const ray=new THREE.Raycaster(new THREE.Vector3(0,3,0),new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObjects(surfaces).length,0,'no hidden common bowl or water cap');
    assert.equal(inVesselWater({x:0,z:0},pair,innerWallRadiusAt(WATER_Y)),false);
    for (const [x] of plantingPins(pair)) assert.ok(Math.abs(x)>1.18);
    for (const x of [-1.65,1.65]) {
      const graph=createReed('g',8278,{x,y:.55,z:0});
      assert.equal(waterlineCrossings(graph,WATER_Y,p=>inVesselWater(p,pair,innerWallRadiusAt(WATER_Y))).length,1);
    }
    const outer=createReed('g',8278,{x:2.65,y:.55,z:0});
    assert.equal(waterlineCrossings(outer,WATER_Y,p=>inVesselWater(p,pair,innerWallRadiusAt(WATER_Y))).length,1,'remote basin is not clipped to old centered water');
  } finally {dispose();}
});

test('appearance choices leave geometry, botanical data, camera and support extents unchanged', () => {
  const graph=createReed('g',8278,{x:1.65,y:.55,z:0}),before=serializePlantGraph(graph);
  const {studio,scene,camera,dispose}=studioFixture(graph);Object.assign(studio.options,{vesselProfile:pair});studio.buildStudio();
  const mesh=scene.getObjectByName('vessel:right') as THREE.Mesh;
  const positions=Array.from(mesh.geometry.getAttribute('position').array),matrix=camera.projectionMatrix.toArray();
  const extents=resolveVesselPresentation(pair,DEFAULT_VESSEL_APPEARANCE).vessels.map(v=>v.footprintXZ);
  try {
    for(const color of VESSEL_COLORS)for(const finish of VESSEL_FINISHES){
      const choice={colorId:color.id,finishId:finish.id};studio.setVesselAppearance(choice);
      assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),positions);
      assert.deepEqual(camera.projectionMatrix.toArray(),matrix);
      assert.equal(serializePlantGraph(graph),before);
      assert.deepEqual(studio.getVesselPresentation().vessels.map((v:any)=>v.footprintXZ),extents);
      assert.equal((mesh.material as THREE.MeshPhysicalMaterial).color.getHex(THREE.SRGBColorSpace),color.color);
      assert.equal(Boolean((mesh.material as THREE.MeshPhysicalMaterial).bumpMap),finish.grain);
    }
    studio.setVesselAppearance(DEFAULT_VESSEL_APPEARANCE);
    assert.equal((mesh.material as THREE.MeshPhysicalMaterial).roughness,.38);
    assert.equal((mesh.material as THREE.MeshPhysicalMaterial).bumpMap,null);
  }finally{studio.vesselGrain?.dispose();dispose();}
});

test('palette is bounded, defaults are stable, and the URL records appearance without a save schema', () => {
  assert.deepEqual(resolveVesselAppearance({colorId:'<bad>',finishId:'unknown'}).choice,DEFAULT_VESSEL_APPEARANCE);
  const url=vesselAppearanceURL({colorId:'celadon',finishId:'stoneware'},new URL('https://example.test/?vesselStudy=vessel-pair&fresh=1&clearStudyData=1'));
  assert.deepEqual(readVesselAppearance(url),{colorId:'celadon',finishId:'stoneware'});
  assert.equal(url.searchParams.get('vesselStudy'),'vessel-pair');assert.equal(url.searchParams.has('fresh'),false);
  const descriptor=resolveVesselPresentation(pair,{colorId:'charcoal',finishId:'glaze'});
  assert.equal(descriptor.vessels.length,2);assert.equal(descriptor.vessels[0].contactY,.04);
  assert.ok(descriptor.vessels[0].footprintXZ.maxX<descriptor.vessels[1].footprintXZ.minX);
  const a=createVesselGrain(),b=createVesselGrain();
  assert.deepEqual(a.image.data,b.image.data);a.dispose();b.dispose();
});
