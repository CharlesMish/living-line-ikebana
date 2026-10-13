import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { disposePhotoLighting, type PhotoLightRig } from "../../src/presentation/photoLighting.ts";

function rig(): PhotoLightRig {
  return { hemisphere: new THREE.HemisphereLight(), key: new THREE.DirectionalLight(), fill: new THREE.DirectionalLight() };
}

test("production studio releases allocated shadow targets before renderer teardown exactly once", () => {
  const lights = rig(), scene = new THREE.Scene();
  scene.add(lights.hemisphere, lights.key, lights.fill);
  lights.key.shadow.map = new THREE.WebGLRenderTarget(16, 16);
  lights.key.shadow.mapPass = new THREE.WebGLRenderTarget(16, 16);
  const events: string[] = [];
  lights.key.shadow.map.addEventListener("dispose", () => events.push("map"));
  lights.key.shadow.mapPass.addEventListener("dispose", () => events.push("mapPass"));
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, photoLightRig: lights, plants: new Map(), renderFrame: null, resizeObserver: null, disposed: false,
    renderer: { dispose() { events.push("renderer"); } },
  });
  studio.dispose(); studio.dispose();
  assert.deepEqual(events, ["map", "mapPass", "renderer"]);
  assert.equal(lights.key.shadow.map, null); assert.equal(lights.key.shadow.mapPass, null);
  assert.equal(lights.fill.shadow.map, null); assert.equal(lights.fill.shadow.mapPass, null);
});

test("unallocated and shared rig targets are safe and do not release another studio's resources", () => {
  const first = rig(), second = rig();
  disposePhotoLighting(first);
  const shared = new THREE.WebGLRenderTarget(16, 16), other = new THREE.WebGLRenderTarget(16, 16);
  first.key.shadow.map = shared; first.key.shadow.mapPass = shared; first.fill.shadow.map = shared;
  second.key.shadow.map = other;
  let sharedDisposals = 0, otherDisposals = 0;
  shared.addEventListener("dispose", () => sharedDisposals++); other.addEventListener("dispose", () => otherDisposals++);
  disposePhotoLighting(first); disposePhotoLighting(first);
  assert.equal(sharedDisposals, 1); assert.equal(otherDisposals, 0); assert.equal(second.key.shadow.map, other);
  disposePhotoLighting(second); assert.equal(otherDisposals, 1);
});
