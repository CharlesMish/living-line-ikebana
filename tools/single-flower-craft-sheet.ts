/** CPU mesh illustration of production organ geometry. No browser or GPU.
 * Bundle with esbuild, run with an output JSON path, then use
 * tools/botanical-contact-sheet.py. Flat painter sorting is not WebGL evidence.
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { createSingleFlower, createCompactFlower } from "../src/core/index.ts";
import { ThreeStudio } from "../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../src/presentation/geometry.ts";
import { getMaterialAppearance } from "../src/presentation/materialAppearance.ts";
import { resolveBotanicalAppearance } from "../src/presentation/botanicalTones.ts";

const panels: unknown[] = [];
const camera = new THREE.OrthographicCamera(-0.79, 0.79, 0.82, -0.76, 0.1, 50);
for (const tone of ["natural", "rose", "lilac", "compact"] as const) {
  const graph = tone === "compact" ? createCompactFlower("plant-1", 8278, { x: 0, y: 0.55, z: 0 }) : createSingleFlower("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const studio: any = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });
  const bloom = [...graph.organs.values()].find(organ => organ.kind === "bloom")!;
  const organ = studio.createOrganVisual(graph, bloom, false);
  const tones = tone === "rose" || tone === "lilac" ? { "single-flower": tone } : {};
  organ.applyTone(resolveBotanicalAppearance(graph.generatorVersion, getMaterialAppearance(graph.generatorVersion), tones));
  organ.group.updateMatrixWorld(true);
  for (const view of ["front", "three-quarter", "back"] as const) {
    camera.position.set(...({ front: [0, 0, 5], "three-quarter": [3, 1, 4], back: [0, 0, -5] }[view] as [number, number, number]));
    camera.lookAt(0, 0, 0.04); camera.updateMatrixWorld(true);
    const triangles: number[][] = [];
    let calls = 0, triangleCount = 0;
    organ.group.traverseVisible((object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh) || object.material.colorWrite === false) return;
      calls++;
      const material = object.material as THREE.MeshStandardMaterial;
      const pos = object.geometry.getAttribute("position"), colors = object.geometry.getAttribute("color"), idx = object.geometry.index;
      for (let instance = 0; instance < (object instanceof THREE.InstancedMesh ? object.count : 1); instance++) {
        const world = object.matrixWorld.clone();
        if (object instanceof THREE.InstancedMesh) { const local = new THREE.Matrix4(); object.getMatrixAt(instance, local); world.multiply(local); }
        for (let i = 0; i < (idx?.count ?? pos.count); i += 3) {
          const ids = [0, 1, 2].map(j => idx ? idx.getX(i + j) : i + j);
          const points = ids.map(j => new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(world));
          const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
          const shade = 0.6 + 0.4 * Math.abs(normal.dot(new THREE.Vector3(-0.4, 0.8, 0.6).normalize()));
          const color = material.color.clone();
          if (material.vertexColors && colors) {
            const average = ids.reduce((sum, j) => sum.add(new THREE.Vector3(colors.getX(j), colors.getY(j), colors.getZ(j))), new THREE.Vector3()).divideScalar(3);
            color.r *= average.x; color.g *= average.y; color.b *= average.z;
          }
          color.multiplyScalar(shade).convertLinearToSRGB();
          const projected = points.map(point => point.project(camera));
          triangles.push([...projected.flatMap(p => [p.x, p.y, p.z]), color.r, color.g, color.b]);
          triangleCount++;
        }
      }
    });
    panels.push({ label: `CPU mesh · ${tone} · ${view}`, triangles, calls, triangleCount });
  }
  disposeObject(organ.group);
}
writeFileSync(process.argv[2], JSON.stringify({ columns: 3, panels }));
