import * as THREE from "three";
import { broadBladeStock, BROAD_BLADE_VERSION } from "../core/broadBlade.ts";
import { sampleMaterialFrame } from "../core/frames.ts";
import { clamp } from "../core/math.ts";
import type { Branch, PlantGraph } from "../core/types.ts";

export const isBroadBlade = (graph: PlantGraph, branch: Branch) =>
  graph.generatorVersion === BROAD_BLADE_VERSION && branch.id === graph.rootBranchId;

/** Width at an original-stock station. A cut through the blade never retapers
 * its new end. A modest asymmetric lanceolate profile, not a scaled organ. */
export function broadBladeHalfWidth(seed: number, distance: number): number {
  const stock = broadBladeStock(seed);
  const u = (distance - stock.bladeStart) / (stock.length - stock.bladeStart);
  if (u <= 0 || u >= 1) return 0;
  return stock.halfWidth * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.86)), 0.82);
}

/** Vertex rows are fixed original-stock stations plus exact clipping boundaries.
 * UV.x is ABSOLUTE material distance; interpolating it through the hit triangle
 * supplies the real lamina station, even far from its projected midrib. */
export function updateBroadBladeGeometry(
  geometry: THREE.BufferGeometry, branch: Branch, seed: number,
  from = 0, to = branch.activeLength,
): void {
  const stock = broadBladeStock(seed);
  const start = Math.max(stock.bladeStart, from);
  const end = Math.min(stock.length, branch.activeLength, to);
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  if (branch.active && end > start + 1e-8) {
    const rows = [start];
    // Include centerline vertices so the lamina never bridges across a bent
    // midrib segment. Fixed subdivisions preserve proximal tessellation on cut.
    for (let row = 1; row < 72; row += 1) {
      const distance = stock.bladeStart + (stock.length - stock.bladeStart) * row / 72;
      if (distance > start + 1e-8 && distance < end - 1e-8) rows.push(distance);
    }
    let cursor = 0;
    for (const length of branch.restLengths) {
      cursor += length;
      if (cursor > start + 1e-8 && cursor < end - 1e-8) rows.push(cursor);
    }
    rows.push(end);
    rows.sort((a, b) => a - b);
    const stations = rows.filter((value, i) => i === 0 || value - rows[i - 1] > 1e-8);
    const crossSegments = 8;
    for (const distance of stations) {
      const frame = sampleMaterialFrame(branch, distance);
      const halfWidth = broadBladeHalfWidth(seed, distance);
      const u = (distance - stock.bladeStart) / (stock.length - stock.bladeStart);
      for (let column = 0; column <= crossSegments; column += 1) {
        const v = column / crossSegments * 2 - 1;
        const lateral = v * halfWidth * (v < 0 ? 1 : 0.96);
        const cup = Math.pow(Math.abs(v), 1.7) * halfWidth * 0.13;
        const rib = (1 - Math.abs(v)) * 0.011 * Math.sin(Math.PI * u);
        positions.push(frame.position.x + frame.normal.x * lateral + frame.binormal.x * (cup + rib),
          frame.position.y + frame.normal.y * lateral + frame.binormal.y * (cup + rib),
          frame.position.z + frame.normal.z * lateral + frame.binormal.z * (cup + rib));
        // Restrained longitudinal parallel veins. Seed + original stations keep
        // these bands fixed to the remaining material through edits/reload/cuts.
        const edgeShade = 1 - 0.14 * Math.pow(Math.abs(v), 3);
        const ribShade = column === crossSegments / 2 ? 1.16 : 1;
        const vein = 1 + 0.028 * Math.cos(v * Math.PI * 8 + u * 1.3);
        const shade = edgeShade * ribShade * vein;
        colors.push(0.84 * shade, shade, 0.78 * shade);
        uvs.push(distance, (v + 1) * 0.5);
      }
    }
    for (let row = 0; row < stations.length - 1; row += 1) {
      for (let column = 0; column < crossSegments; column += 1) {
        const a = row * (crossSegments + 1) + column, b = a + crossSegments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const data = { position: positions, color: colors, uv: uvs };
  const attributesFit = Object.entries(data).every(([name, values]) => {
    const attribute = geometry.getAttribute(name);
    return attribute instanceof THREE.BufferAttribute && attribute.array.length === values.length;
  });
  const normals = geometry.getAttribute("normal");
  const index = geometry.getIndex();
  const topologyFits = attributesFit && normals instanceof THREE.BufferAttribute
    && normals.array.length === positions.length && index?.array.length === indices.length;
  // A geometry can be reused after dispose. Release its old GPU attribute
  // bindings BEFORE replacing any arrays; otherwise the renderer loses those
  // references and cannot reclaim their buffers. Stable topology reuses all
  // BufferAttribute objects throughout Aim/Bend and within a prune interval.
  if (!topologyFits && (Object.keys(geometry.attributes).length > 0 || index)) geometry.dispose();
  for (const [name, values] of Object.entries(data)) {
    const attribute = geometry.getAttribute(name);
    if (attribute instanceof THREE.BufferAttribute && attribute.array.length === values.length) {
      attribute.array.set(values);
      attribute.needsUpdate = true;
    } else {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, name === "uv" ? 2 : 3));
    }
  }
  if (!(normals instanceof THREE.BufferAttribute) || normals.array.length !== positions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  }
  if (index && index.array.length === indices.length) {
    index.array.set(indices);
    index.needsUpdate = true;
  } else {
    geometry.setIndex(indices);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
}

export function broadBladeSurfaceDistance(intersection: THREE.Intersection, branch: Branch): number | null {
  if (intersection.object.userData.broadBlade !== true || !intersection.uv || !Number.isFinite(intersection.uv.x)) return null;
  return clamp(intersection.uv.x, 0, branch.activeLength);
}
