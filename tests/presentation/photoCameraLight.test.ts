import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { canonicalCameraPose, orbitCameraPose } from "../../src/app/camera.ts";
import { validateArrangement } from "../../src/app/garden.ts";
import { framePhotoCamera } from "../../src/presentation/photoStage.ts";
import { PHOTO_FRAMING_CONTROLS, NEUTRAL_PHOTO_FRAMING, validatePhotoFraming } from "../../src/presentation/photoFraming.ts";
import { applyPhotoLighting, PHOTO_LIGHTING, validatePhotoLighting, type PhotoLightRig } from "../../src/presentation/photoLighting.ts";
import { ThreeStudio, type StudioCameraPose } from "../../src/presentation/ThreeStudio.ts";
import { fogRangeForDistance } from "../../src/presentation/stageLens.ts";

const vec = (v: {x:number;y:number;z:number}) => new THREE.Vector3(v.x,v.y,v.z);
function cameraFor(pose: StudioCameraPose) {
  const camera = new THREE.PerspectiveCamera(44, 4/3, .1, 100);
  camera.position.copy(vec(pose.position)); camera.up.copy(vec(pose.up)); camera.lookAt(vec(pose.target)); camera.updateMatrixWorld(true);
  return camera;
}
const radius = (pose: StudioCameraPose) => vec(pose.position).distanceTo(vec(pose.target));
const rig = (): PhotoLightRig => ({ hemisphere: new THREE.HemisphereLight(), key: new THREE.DirectionalLight(), fill: new THREE.DirectionalLight() });
const lightState = (lights: PhotoLightRig) => ({ sky: lights.hemisphere.color.getHex(), ground: lights.hemisphere.groundColor.getHex(),
  hemisphere: lights.hemisphere.intensity, key: [lights.key.color.getHex(),lights.key.intensity,...lights.key.position.toArray()],
  fill: [lights.fill.color.getHex(),lights.fill.intensity,...lights.fill.position.toArray()] });

test("neutral photograph framing preserves every canonical and rolled reference exactly", () => {
  const poses = [canonicalCameraPose("front"), canonicalCameraPose("above"), canonicalCameraPose("three-quarter")];
  poses.push(framePhotoCamera(poses[0], 1.2, .8, -.5, 31, 20, 8));
  for (const pose of poses) {
    const before = JSON.stringify(pose);
    assert.deepEqual(framePhotoCamera(pose, 1, 0, 0), pose);
    assert.equal(JSON.stringify(pose), before);
  }
  assert.deepEqual(validatePhotoFraming({...NEUTRAL_PHOTO_FRAMING}), NEUTRAL_PHOTO_FRAMING);
});

test("all photo framing extremes yield stable finite poses accepted by real Garden validation", () => {
  for (const view of ["front", "above", "three-quarter"] as const) {
    const base = canonicalCameraPose(view), before = JSON.stringify(base);
    for (const zoom of [.55, 2.8]) for (const yaw of [-60, 60]) for (const pitch of [-30, 30]) for (const roll of [-12, 12]) {
      const pose = framePhotoCamera(base, zoom, 4.8, -4.8, yaw, pitch, roll);
      assert.deepEqual(framePhotoCamera(base, zoom, 4.8, -4.8, yaw, pitch, roll), pose);
      const kept = validateArrangement({ plants: [], successfulPlantOrdinal: 0, camera: pose });
      assert.deepEqual(kept.camera, pose);
      assert.ok(Math.abs(radius(pose) * zoom - radius(base)) < 1e-10);
      const delta = vec(pose.position).sub(vec(pose.target));
      const elevation = THREE.MathUtils.radToDeg(Math.asin(delta.y / delta.length()));
      assert.ok(elevation >= 3 - 1e-10 && elevation <= 87 + 1e-10);
      assert.ok(cameraFor(pose).matrixWorld.elements.every(Number.isFinite));
      // The existing renderer follows distant photos with its fog range; wide
      // framing must not place the target beyond that scene's far fog plane.
      assert.ok(radius(pose) < fogRangeForDistance(radius(pose), 15.5).far);
    }
    assert.equal(JSON.stringify(base), before);
  }
});

test("Turn changes Above orientation, while pan remains screen-relative after turn and tilt", () => {
  const above = canonicalCameraPose("above"), turned = framePhotoCamera(above, 1, 0, 0, 45, 0, 0);
  const point = new THREE.Vector3(2, 1, 0);
  assert.ok(point.clone().project(cameraFor(above)).distanceTo(point.clone().project(cameraFor(turned))) > .05);
  const base = canonicalCameraPose("three-quarter");
  const centred = framePhotoCamera(base, 1.6, 0, 0, 48, 16, 12), camera = cameraFor(centred);
  const horizontal = framePhotoCamera(base, 1.6, 1, 0, 48, 16, 12);
  const vertical = framePhotoCamera(base, 1.6, 0, 1, 48, 16, 12);
  const target = vec(centred.target), origin = target.clone().project(camera);
  const x = target.clone().project(cameraFor(horizontal)), y = target.clone().project(cameraFor(vertical));
  assert.ok(x.x > origin.x && Math.abs(x.y-origin.y) < 1e-10);
  assert.ok(y.y > origin.y && Math.abs(y.x-origin.x) < 1e-10);
});

test("wide photo pan stops above the stage without changing view, roll or camera radius", () => {
  for (const view of ["front", "above", "three-quarter"] as const) {
    const base = canonicalCameraPose(view);
    for (const zoom of [.55, 1, 2.8]) for (const horizontal of [-4.8, 0, 4.8]) for (const vertical of [-4.8, 0, 4.8]) {
      for (const roll of [-12, 0, 12]) for (const pitch of [-30, 0, 30]) {
        const centred = framePhotoCamera(base, zoom, 0, 0, 25, pitch, roll);
        const panned = framePhotoCamera(base, zoom, horizontal, vertical, 25, pitch, roll);
        assert.ok(panned.position.y >= .12 - 1e-10, `${view}: ${JSON.stringify({zoom,horizontal,vertical,roll,pitch})}`);
        assert.ok(vec(panned.position).sub(vec(panned.target)).distanceTo(vec(centred.position).sub(vec(centred.target))) < 1e-10);
        assert.deepEqual(panned.up, centred.up);
        assert.ok(Math.abs(radius(panned)-radius(centred)) < 1e-10);
      }
    }
  }
  // Across acquires a vertical component after rolling; it must use the same
  // clearance rule instead of restricting only the Height slider.
  const low = {position:{x:0,y:.5,z:15},target:{x:0,y:.3,z:0},up:{x:0,y:1,z:0}};
  const rolledAcross = framePhotoCamera(low,1,-4.8,0,0,0,12);
  assert.ok(Math.abs(rolledAcross.position.y-.12)<1e-10);
  assert.ok(Math.abs(radius(rolledAcross)-radius(low))<1e-10);
  const centred = framePhotoCamera(canonicalCameraPose("front"),2.8,0,0,0,0,12);
  const diagonal = framePhotoCamera(canonicalCameraPose("front"),2.8,2.5,4.8,0,0,12);
  const basis = cameraFor(centred).matrixWorld;
  const wanted = new THREE.Vector3().setFromMatrixColumn(basis,0).multiplyScalar(-2.5)
    .addScaledVector(new THREE.Vector3().setFromMatrixColumn(basis,1),-4.8);
  const actual = vec(diagonal.target).sub(vec(centred.target));
  assert.ok(actual.clone().cross(wanted).length() < 1e-10, "the boundary stops along the requested pan ray");
  assert.ok(actual.length() > 0 && actual.length() < wanted.length());
});

test("closing in on a saved boundary pose stays above the floor, while neutral inherited poses stay exact", () => {
  const edge = framePhotoCamera(canonicalCameraPose("front"),1,0,4.8);
  assert.ok(Math.abs(edge.position.y-.12)<1e-10);
  const stored = validateArrangement(JSON.parse(JSON.stringify({plants:[],successfulPlantOrdinal:0,camera:edge}))).camera;
  assert.deepEqual(framePhotoCamera(stored,1,0,0),stored);
  const close = framePhotoCamera(stored,2.8,0,0);
  assert.ok(close.position.y >= .12 - 1e-10);
  assert.ok(Math.abs(radius(close)*2.8-radius(stored))<1e-10);
  assert.ok(vec(close.position).sub(vec(close.target)).normalize().distanceTo(vec(stored.position).sub(vec(stored.target)).normalize()) < 1e-10);
  const legacyLow = {position:{x:0,y:-.2,z:15},target:{x:0,y:-.4,z:0},up:{x:0,y:1,z:0}};
  assert.deepEqual(framePhotoCamera(legacyLow,1,0,0),legacyLow);
  assert.deepEqual(framePhotoCamera(legacyLow,1,0,4.8),legacyLow);
  assert.ok(framePhotoCamera(legacyLow,1,0,-1).position.y > legacyLow.position.y);
});

test("saved tilted camera renders the same projection without a second roll; ordinary orbit levels it", () => {
  const pose = framePhotoCamera(canonicalCameraPose("front"), 1.5, .5, -.25, 25, 18, 9);
  const saved = validateArrangement(JSON.parse(JSON.stringify({ plants: [], successfulPlantOrdinal: 0, camera: pose })));
  const camera = new THREE.PerspectiveCamera(44, 4/3, .1, 100);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { camera, cameraTarget: new THREE.Vector3(),
    updateAffordances() {}, requestRender() {}, options: {} });
  studio.setCameraPose(saved.camera, "free", false);
  for (const point of [new THREE.Vector3(0,.5,0),new THREE.Vector3(1,4,1),new THREE.Vector3(-2,2,-1)]) {
    assert.ok(point.clone().project(camera).distanceTo(point.clone().project(cameraFor(pose))) < 1e-12);
  }
  assert.ok(vec(studio.getCameraPose().up).distanceTo(vec(pose.up)) < 1e-12);
  assert.deepEqual(orbitCameraPose(saved.camera, 10, 0).up, {x:0,y:1,z:0});
});

test("framing rejects nonfinite controls and degenerate reference poses before producing a camera", () => {
  const pose = canonicalCameraPose("front");
  for (const {id,min,max} of PHOTO_FRAMING_CONTROLS) for (const invalid of [NaN,Infinity,min-1,max+1]) {
    assert.throws(() => validatePhotoFraming({...NEUTRAL_PHOTO_FRAMING,[id]:invalid}), /Invalid photograph framing/);
  }
  assert.throws(() => framePhotoCamera({...pose,up:{x:0,y:0,z:0}},1,0,0), /reference view/);
  assert.throws(() => framePhotoCamera({...pose,position:{x:NaN,y:0,z:0}},1,0,0), /reference view/);
});

test("Studio light reset is the accepted rig verbatim, and presets neither allocate nor contaminate another scene", () => {
  const a = rig(), b = rig(); applyPhotoLighting(a); applyPhotoLighting(b);
  const original = lightState(a), refs = [a.hemisphere,a.key,a.fill,a.key.shadow];
  assert.deepEqual(original, {sky:0xfffaec,ground:0x657064,hemisphere:1.95,key:[0xfff3d8,3,-3.2,12.5,4.4],fill:[0xcddce0,.8,6,4,-5]});
  for (const {id} of PHOTO_LIGHTING) {
    applyPhotoLighting(a,id);
    if (id !== "studio") assert.notDeepEqual(lightState(a),original);
    assert.deepEqual(lightState(b), original);
    assert.deepEqual([a.hemisphere,a.key,a.fill,a.key.shadow],refs);
    assert.equal(a.key.shadow.needsUpdate,true);
  }
  applyPhotoLighting(a,"studio"); assert.deepEqual(lightState(a),original);
  assert.throws(() => applyPhotoLighting(a,"unknown" as never), /Invalid photograph lighting/);
  assert.deepEqual(lightState(a),original);
  for (const invalid of [null,1,{},"blue"]) assert.throws(() => validatePhotoLighting(invalid));
});

test("production lighting setter changes only light properties, preserving cutout alpha and camera", () => {
  const scene = new THREE.Scene(); scene.background=null; scene.fog=null;
  const camera = cameraFor(canonicalCameraPose("front"));
  const lights=rig(); scene.add(lights.hemisphere,lights.key,lights.fill);
  const beforeCamera = camera.matrixWorld.clone(), beforeScene = scene.children.slice();
  let renders=0;
  const studio=Object.assign(Object.create(ThreeStudio.prototype), {scene,camera,photoLightRig:lights,requestRender(){renders++;}});
  studio.setPhotoLighting("evening");
  assert.equal(renders,1); assert.equal(scene.background,null); assert.equal(scene.fog,null);
  assert.deepEqual(scene.children,beforeScene); assert.deepEqual(camera.matrixWorld,beforeCamera);
  assert.equal(lights.key.intensity,3.1);
});
