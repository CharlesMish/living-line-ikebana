import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createReed } from '../../src/core/index.ts';
import { VESSEL_PROFILES, inPlantingArea } from '../../src/study/vesselProfiles.ts';
import { studioFixture } from './studioFixture.ts';

for (const profile of VESSEL_PROFILES) test(`${profile.id}: visible pins and projected boundary agree with actual insertion in three views`, () => {
  const { studio, scene, dispose } = studioFixture(createReed('p', 8278, {x:0,y:.55,z:0}));
  studio.cameraTarget = new THREE.Vector3(0, 2.55, 0);
  Object.assign(studio.options, { vesselProfile: profile });
  try {
    const parts = studio.buildStudio();
    studio.kenzanGlow = parts.kenzanGlow;
    const pins = scene.children.find((child: THREE.Object3D) => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    assert.ok(pins && pins.count > 0);
    for (let i = 0; i < pins.count; i++) {
      const matrix = new THREE.Matrix4(); pins.getMatrixAt(i, matrix);
      const point = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(inPlantingArea(point, profile));
    }
    for (const view of ['front', 'three-quarter', 'above']) {
      studio.setCanonicalView(view, false);
      for (const area of profile.areas) for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        for (const scale of [.999, 1.001]) {
          const p = {x:area.x + area.rx * Math.cos(angle) * scale,y:.55,z:area.z + area.rz * Math.sin(angle) * scale};
          const screen = studio.projectPoint(p);
          assert.equal(studio.intersectKenzanPlane(screen.clientX, screen.clientY)?.valid, scale < 1);
        }
      }
    }
  } finally { dispose(); }
});
