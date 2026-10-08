import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createReed } from "../../src/core/index.ts";
import { EXPERIMENTAL_VESSEL_PROFILES, inPlantingArea } from "../../src/study/vesselProfiles.ts";
import { studioFixture } from "./studioFixture.ts";

const a2 = EXPERIMENTAL_VESSEL_PROFILES.find(profile => profile.id === "pinbed-small-a2");
if (!a2) throw new Error("Missing pinbed-small-a2 profile");

test("pinbed-small-a2: visible pins and projected boundary agree with insertion validity in three views", () => {
  const { studio, scene, dispose } = studioFixture(createReed("p", 8278, { x: 0, y: .55, z: 0 }));
  studio.cameraTarget = new THREE.Vector3(0, 2.55, 0);
  Object.assign(studio.options, { vesselProfile: a2 });
  try {
    const parts = studio.buildStudio();
    studio.kenzanGlow = parts.kenzanGlow;
    const pins = scene.children.find((child: THREE.Object3D) => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    assert.ok(pins && pins.count > 0);
    for (let index = 0; index < pins.count; index += 1) {
      const matrix = new THREE.Matrix4();
      pins.getMatrixAt(index, matrix);
      const pin = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(inPlantingArea(pin, a2));
    }

    for (const view of ["front", "three-quarter", "above"] as const) {
      studio.setCanonicalView(view, false);
      for (let index = 0; index < 12; index += 1) {
        const angle = index * Math.PI / 6;
        for (const scale of [.999, 1.001] as const) {
          const point = {
            x: a2.areas[0].x + a2.areas[0].rx * Math.cos(angle) * scale,
            y: .55,
            z: a2.areas[0].z + a2.areas[0].rz * Math.sin(angle) * scale,
          };
          const screen = studio.projectPoint(point);
          assert.equal(studio.intersectKenzanPlane(screen.clientX, screen.clientY)?.valid, scale < 1);
        }
      }
    }
  } finally {
    dispose();
  }
});
