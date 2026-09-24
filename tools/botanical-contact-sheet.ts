/** Offline silhouette review using production meshes and organ transforms.
 * This is not WebGL, browser interaction, performance, or phone evidence.
 * Bundle with esbuild (node/esm), run with an output JSON path, then render
 * using botanical-contact-sheet.py. No browser or GPU is needed.
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { getGeneratorDefinition, getMaterialDefinitions, bendBranch, sampleBranch } from "../src/core/index.ts";
import { ThreeStudio } from "../src/presentation/ThreeStudio.ts";
import { createVesselGeometry } from "../src/presentation/vessel.ts";

const pairs = ["fern-frond", "blossom-spray", "nodding-flower"];
const seeds = [8278, 9255, 10232];
const camera = new THREE.OrthographicCamera(-3.8, 3.8, 7.4, -0.4, 0.1, 100);
const panels: unknown[] = [];
const palette = process.argv.includes("--palette");
const shape = process.argv.includes("--shape");
const variants = palette ? getMaterialDefinitions().map(m => m.generator.generatorVersion)
  : shape ? ["nodding-flower-v2", "fern-frond-v2", "blossom-spray-v2"]
    : pairs.flatMap(id => [`${id}-v1`, `${id}-v2`]);
for (const seed of palette ? [8278] : seeds) for (const version of variants) {
  const views = palette ? ["three-quarter"] : shape ? ["lower", "middle", "upper"] : ["front", "three-quarter"];
  for (const view of views) {
    camera.position.set(view === "three-quarter" ? 7 : 0, 3.5, 14);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    let graph = getGeneratorDefinition(version)!.generate("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    if (shape) {
      const branch = graph.branches.get(version.startsWith("nodding") ? "plant-1:neck" : graph.rootBranchId)!;
      const station = branch.activeLength * ({ lower: 0.32, middle: 0.54, upper: 0.76 }[view]!);
      const p = sampleBranch(branch, station).position;
      graph = bendBranch(graph, { branchId: branch.id, stationDistance: station, target: { x: p.x + 0.7, y: p.y + 0.1, z: p.z } });
    }
    const scene = new THREE.Group();
    // Only the GPU constructor/render hooks are replaced. Graph rebuild and
    // placement are the actual production methods, including instanced petals.
    const studio: any = Object.assign(Object.create(ThreeStudio.prototype), {
      options: { debugHitTargets: false }, botanicalRoot: scene, updateAffordances() {}, updateCutCollar() {}, requestRender() {},
    });
    studio.createPlantVisual(graph, false);
    const bowl = new THREE.Mesh(createVesselGeometry(), new THREE.MeshStandardMaterial({ color: 0xd3cbae }));
    scene.add(bowl);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.35, 64), new THREE.MeshStandardMaterial({ color: 0x74a5a0 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.43; scene.add(water);
    const pins = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x514b3d }));
    pins.position.y = 0.49; scene.add(pins);
    scene.updateMatrixWorld(true);
    const triangles: number[][] = [];
    scene.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh) || object.material.opacity < 0.99 || object.material.colorWrite === false) return;
      const mesh = object;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const pos = mesh.geometry.getAttribute("position"), colors = mesh.geometry.getAttribute("color"), idx = mesh.geometry.index;
      if (!pos) return;
      for (let instance = 0; instance < (mesh instanceof THREE.InstancedMesh ? mesh.count : 1); instance++) {
        const world = mesh.matrixWorld.clone();
        if (mesh instanceof THREE.InstancedMesh) { const local = new THREE.Matrix4(); mesh.getMatrixAt(instance, local); world.multiply(local); }
        for (let i = 0; i < (idx?.count ?? pos.count); i += 3) {
          const indices = [0, 1, 2].map(j => idx ? idx.getX(i + j) : i + j);
          const points = indices.map(j => new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(world));
          const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
          const shade = 0.55 + 0.45 * Math.abs(normal.dot(new THREE.Vector3(-0.4, 0.8, 0.6).normalize()));
          const color = material.color.clone();
          if (material.vertexColors && colors) {
            const average = indices.reduce((sum, j) => sum.add(new THREE.Vector3(colors.getX(j), colors.getY(j), colors.getZ(j))), new THREE.Vector3()).divideScalar(3);
            color.r *= average.x; color.g *= average.y; color.b *= average.z;
          }
          color.multiplyScalar(shade).convertLinearToSRGB();
          const projected = points.map(p => p.project(camera));
          triangles.push([...projected.flatMap(p => [p.x, p.y, p.z]), color.r, color.g, color.b]);
        }
      }
    });
    panels.push({ label: `${version} / ${seed} / ${view}`, triangles });
  }
}
writeFileSync(process.argv[2], JSON.stringify({ columns: palette ? 4 : shape ? 3 : 4, panels }));
