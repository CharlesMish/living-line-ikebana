import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createBareBranch, applyPrune, previewPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { framePhotoCamera, createPhotoPerch, PHOTO_SIZES } from "../../src/presentation/photoStage.ts";
import { attachStemSurface } from "../../src/presentation/stemSurface.ts";
import { updateTubeGeometry, disposeObject } from "../../src/presentation/geometry.ts";

test("photo framing recomputes from its fixed pose and does not change its input", () => {
  const pose = { position: { x: 0, y: 4, z: 15 }, target: { x: 0, y: 2.5, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  const before = JSON.stringify(pose);
  assert.deepEqual(framePhotoCamera(pose, 1, 0, 0), pose);
  const first = framePhotoCamera(pose, 1.5, 0.4, -0.7);
  assert.deepEqual(framePhotoCamera(pose, 1.5, 0.4, -0.7), first);
  assert.equal(JSON.stringify(pose), before);
  const length = (p: typeof pose) => Math.hypot(p.position.x-p.target.x, p.position.y-p.target.y, p.position.z-p.target.z);
  assert.ok(Math.abs(length(first) * 1.5 - length(pose)) < 1e-10);
  assert.equal(PHOTO_SIZES.landscape.width / PHOTO_SIZES.landscape.height, 4/3);
});

test("perch tops meet the unchanged vessel bottom", () => {
  for (const perch of ["ground", "stone", "bench"] as const) {
    const {group, floorY} = createPhotoPerch(perch);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (perch !== "ground") assert.ok(Math.abs(bounds.max.y - .04) < 1e-7);
    assert.ok(floorY < 0); disposeObject(group);
  }
});

test("fiber coordinates preserve geometry and proximal material phase through pruning", () => {
  const graph = createBareBranch("plant-1", 8278, {x:0,y:.55,z:0});
  const canonical = JSON.stringify(toCanonicalPlantGraph(graph));
  const branch = graph.branches.get(graph.rootBranchId)!;
  const geometry = new THREE.BufferGeometry();
  updateTubeGeometry(geometry, branch.points, branch.radius, branch.referenceNormal, 10, true);
  const positions = [...geometry.getAttribute("position").array];
  const normals = [...geometry.getAttribute("normal").array];
  const indices = [...geometry.getIndex()!.array];
  attachStemSurface(geometry, branch);
  assert.deepEqual([...geometry.getAttribute("position").array], positions);
  assert.deepEqual([...geometry.getAttribute("normal").array], normals);
  assert.deepEqual([...geometry.getIndex()!.array], indices);
  const cut = applyPrune(graph, previewPrune(graph, branch.id, branch.activeLength*.7));
  const remaining = cut.branches.get(branch.id)!;
  const second = new THREE.BufferGeometry();
  updateTubeGeometry(second, remaining.points, remaining.radius, remaining.referenceNormal, 10, true);
  attachStemSurface(second, remaining);
  const oldCoords = geometry.getAttribute("stemSurface"), nextCoords = second.getAttribute("stemSurface");
  for (let index=0; index < (remaining.points.length-1)*10; index++) {
    assert.equal(nextCoords.getX(index), oldCoords.getX(index));
    assert.equal(nextCoords.getY(index), oldCoords.getY(index));
    assert.equal(nextCoords.getZ(index), oldCoords.getZ(index));
  }
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), canonical);
  geometry.dispose(); second.dispose();
});

test("all perches support every frozen vessel profile at contact height without moving vessels", async () => {
  const { VESSEL_PROFILES } = await import("../../src/study/vesselProfiles.ts");
  const { resolveVesselPresentation, DEFAULT_VESSEL_APPEARANCE } = await import("../../src/study/vesselAppearance.ts");
  const { photoSupportBounds } = await import("../../src/presentation/photoStage.ts");
  for (const profile of VESSEL_PROFILES) {
    const supports = resolveVesselPresentation(profile, DEFAULT_VESSEL_APPEARANCE).vessels;
    const bounds = photoSupportBounds(supports);
    for (const support of supports) {
      const b = support.footprintXZ, cx = (b.minX+b.maxX)/2, cz = (b.minZ+b.maxZ)/2;
      for (let angle=0;angle<Math.PI*2;angle+=.05) {
        const x=cx+Math.cos(angle)*(b.maxX-b.minX)/2, z=cz+Math.sin(angle)*(b.maxZ-b.minZ)/2;
        assert.ok(Math.hypot(x-bounds.x,z-bounds.z)<bounds.radius);
        assert.ok(Math.abs(x-bounds.x)<bounds.width/2 && Math.abs(z-bounds.z)<bounds.depth/2);
      }
      assert.equal(bounds.topY,support.contactY);
    }
    for (const perch of ["stone", "bench"] as const) {
      const created=createPhotoPerch(perch,supports);created.group.updateMatrixWorld(true);
      assert.ok(Math.abs(new THREE.Box3().setFromObject(created.group).max.y-bounds.topY)<1e-7);disposeObject(created.group);
    }
  }
});
