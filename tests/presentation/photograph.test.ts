import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createBareBranch, applyPrune, previewPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { framePhotoCamera, createPhotoPerch, PHOTO_SIZES, PHOTO_PERCHES } from "../../src/presentation/photoStage.ts";
import { createPerchSurface, disposePhotoPerch } from "../../src/presentation/perchSurfaces.ts";
import { attachStemSurface } from "../../src/presentation/stemSurface.ts";
import { updateTubeGeometry } from "../../src/presentation/geometry.ts";

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
  for (const { id: perch } of PHOTO_PERCHES) {
    const {group, floorY} = createPhotoPerch(perch);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (perch !== "ground") assert.ok(Math.abs(bounds.max.y - .04) < 1e-7);
    assert.ok(floorY < 0);
    if (perch !== "ground") assert.ok(Math.abs(bounds.min.y - floorY) < 1e-7, `${perch} meets its floor`);
    disposePhotoPerch(group);
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
    for (const { id: perch } of PHOTO_PERCHES.filter(perch => perch.id !== "ground")) {
      const created=createPhotoPerch(perch,supports);created.group.updateMatrixWorld(true);
      assert.ok(Math.abs(new THREE.Box3().setFromObject(created.group).max.y-bounds.topY)<1e-7);disposePhotoPerch(created.group);
    }
  }
});

test("crafted perches release shared maps, materials and geometries exactly once", () => {
  for (const { id } of PHOTO_PERCHES) {
    const { group } = createPhotoPerch(id);
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
      }
    });
    const disposed = new Map<object, number>();
    for (const resource of resources) resource.addEventListener("dispose", () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
    disposePhotoPerch(group); disposePhotoPerch(group);
    assert.equal(disposed.size, resources.size);
    assert.ok([...disposed.values()].every(count => count === 1));
  }
});

test("production stage replacement, transparent cutout and studio close release owned perch maps", async () => {
  const { ThreeStudio } = await import("../../src/presentation/ThreeStudio.ts");
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial());
  floor.name = "studio-floor"; scene.add(floor);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, photoPerch: null, disposed: false, renderFrame: null, resizeObserver: null,
    renderer: { setClearColor() {}, dispose() {} }, plants: new Map(), pendingPlant: null,
    requestRender() {}, getVesselPresentation: () => ({ vessels: [{ contactY: .04, footprintXZ: { minX: -2.64, maxX: 2.64, minZ: -2.64, maxZ: 2.64 } }] }),
  });
  const watchMaps = () => {
    const maps = new Set<THREE.Texture>(), counts = new Map<THREE.Texture, number>();
    studio.photoPerch.traverse((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) maps.add(value);
      }
    });
    for (const map of maps) map.addEventListener("dispose", () => counts.set(map, (counts.get(map) ?? 0) + 1));
    return () => { assert.ok(maps.size > 0); assert.equal(counts.size, maps.size); assert.ok([...counts.values()].every(count => count === 1)); };
  };
  studio.setPhotoStage("paper", "bench"); const benchDisposed = watchMaps();
  studio.setPhotoStage("sage", "plinth"); benchDisposed(); const plinthDisposed = watchMaps();
  studio.setPhotoStage("transparent", "plinth"); plinthDisposed();
  assert.equal(studio.photoPerch.children.length, 0);
  assert.equal(floor.visible, false); assert.equal(scene.background, null);
  studio.setPhotoStage("paper", "stone"); const stoneDisposed = watchMaps();
  studio.dispose(); stoneDisposed(); benchDisposed(); plinthDisposed();
});

test("perch textures repeat identically without sharing mutable GPU resources", () => {
  for (const kind of ["wood", "endgrain", "stone", "plaster"] as const) {
    const first = createPerchSurface(kind), second = createPerchSurface(kind);
    assert.notEqual(first.map, second.map);
    assert.notEqual(first.bumpMap, second.bumpMap);
    assert.deepEqual(first.map!.image.data, second.map!.image.data);
    assert.deepEqual(first.bumpMap!.image.data, second.bumpMap!.image.data);
    assert.ok(first.map!.image.width <= 256 && first.map!.image.height <= 128);
    for (const material of [first, second]) { material.map!.dispose(); material.bumpMap!.dispose(); material.dispose(); }
  }
});

test("bench grain follows the board, leg and apron axes with bounded photo cost", () => {
  const { group } = createPhotoPerch("bench");
  let triangles = 0, draws = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute("position").count) / 3;
    draws += Array.isArray(object.material) ? object.geometry.groups.length : 1;
    const expected = object.name.startsWith("bench-leg") ? "y" : object.name.startsWith("bench-end-apron") ? "z" : "x";
    const positions = object.geometry.getAttribute("position"), uvs = object.geometry.getAttribute("uv"), normals = object.geometry.getAttribute("normal");
    const residuals: number[] = [], longCoordinates: number[] = [];
    for (let index = 0; index < positions.count; index++) {
      assert.ok(Number.isFinite(uvs.getX(index)) && Number.isFinite(uvs.getY(index)));
      const faceNormal = expected === "x" ? normals.getY(index) : expected === "y" ? normals.getZ(index) : normals.getX(index);
      if (faceNormal < .99) continue;
      const along = expected === "x" ? positions.getX(index) : expected === "y" ? positions.getY(index) : positions.getZ(index);
      residuals.push(uvs.getX(index) - along / 6);
      longCoordinates.push(along);
    }
    assert.ok(residuals.length > 0);
    assert.ok(Math.max(...longCoordinates) - Math.min(...longCoordinates) > .3);
    assert.ok(Math.max(...residuals) - Math.min(...residuals) < 1e-6, `${object.name} grain follows its length`);
  });
  assert.ok(triangles <= 2000);
  assert.ok(draws <= 14);
  disposePhotoPerch(group);
});
