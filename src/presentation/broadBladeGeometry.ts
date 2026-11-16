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
/** Seeded natural form: a slow twist about the midrib and an uneven cup on
 * the two halves. Both are smooth by original-stock station, so the blade bends
 * with its midrib, a cut never reshapes what remains, and a lamina hit keeps its
 * exact station when a cut preview re-rows the surface. (A margin ripple broke
 * that station hold, so it is left out.) Absent (`natural = false`) is the
 * earlier draw. */
function naturalBlade(seed: number) {
  const noise = (channel: number) => {
    let n = (seed ^ Math.imul(channel + 211, 0x9e3779b1)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return {
    twist: (noise(1) - 0.5) * 0.7,
    twistShape: 0.6 + noise(2) * 0.8,
    cupLeft: 0.1 + noise(3) * 0.12,
    cupRight: 0.1 + noise(4) * 0.12,
  };
}

export function updateBroadBladeGeometry(
  geometry: THREE.BufferGeometry, branch: Branch, seed: number,
  from = 0, to = branch.activeLength, natural = false,
): void {
  const stock = broadBladeStock(seed);
  const form = natural ? naturalBlade(seed) : null;
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
        let lateral = v * halfWidth * (v < 0 ? 1 : 0.96);
        let lift = Math.pow(Math.abs(v), 1.7) * halfWidth * (form ? (v < 0 ? form.cupLeft : form.cupRight) : 0.13)
          + (1 - Math.abs(v)) * 0.011 * Math.sin(Math.PI * u);
        if (form) {
          const angle = form.twist * Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, u)), form.twistShape));
          const cos = Math.cos(angle), sin = Math.sin(angle);
          [lateral, lift] = [lateral * cos - lift * sin, lateral * sin + lift * cos];
        }
        positions.push(frame.position.x + frame.normal.x * lateral + frame.binormal.x * lift,
          frame.position.y + frame.normal.y * lateral + frame.binormal.y * lift,
          frame.position.z + frame.normal.z * lateral + frame.binormal.z * lift);
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
