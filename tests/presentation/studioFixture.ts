import * as THREE from "three";
import type { PlantGraph } from "../../src/core/types.ts";
import { ThreeStudio, STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

/** Real production geometry/picking, with only GPU drawing and chrome omitted. */
export function studioFixture(graph: PlantGraph, width = 390, height = 844) {
  const scene = new THREE.Scene();
  const botanicalRoot = new THREE.Group();
  scene.add(botanicalRoot);
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, width / height, 0.1, 80);
  camera.position.set(0, 3.7, 15);
  camera.lookAt(0, 2.55, 0);
  camera.updateMatrixWorld(true);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, botanicalRoot, pendingRoot: new THREE.Group(), camera,
    raycaster: new THREE.Raycaster(), plants: new Map(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) },
    options: { debugHitTargets: false },
    baseHandle: { group: { visible: false } }, bendHandle: { group: { visible: false } },
    selection: null, cutPreview: null,
    updateAffordances() {}, updateCutCollar() {}, requestRender() {},
  });
  studio.upsertGraph(graph);
  scene.updateMatrixWorld(true);
  return { studio, scene, camera, visual: studio.plants.get(graph.id), dispose: () => disposeObject(scene) };
}
