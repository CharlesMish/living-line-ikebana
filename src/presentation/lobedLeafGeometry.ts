import * as THREE from "three";

/** A single connected, five-lobed lamina. Local origin is the petiole tip;
 * +Y follows the stalk. Radial rings preserve actual missing notch triangles.
 * This is geometry, not an alpha-cutout or five overlapping miniature leaves.
 */
const KNOT_Y = 0.16;
const RADIAL_STEPS = 4;
const OUTLINE: readonly (readonly [number, number])[] = [
  [-180, 0.16], [-146, 0.18], [-124, 0.3], [-108, 0.55],
  [-94, 0.32], [-80, 0.25], [-67, 0.49], [-49, 0.77],
  [-36, 0.48], [-23, 0.35], [-12, 0.72], [0, 0.97],
  [12, 0.72], [23, 0.35], [36, 0.48], [49, 0.77],
  [67, 0.49], [80, 0.25], [94, 0.32], [108, 0.55],
  [124, 0.3], [146, 0.18],
];
const VEIN_TIPS = [-108, -49, 0, 49, 108] as const;

function noise(seed: number, channel: number): number {
  let n = (seed ^ Math.imul(channel + 11, 0x9e3779b1)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function surfaceZ(x: number, y: number, seed: number): number {
  const t = Math.min(1, Math.max(0, y / 1.13));
  return 0.033 * Math.sin(Math.PI * t) - 0.053 * x * x
    - 0.024 * t * t + (noise(seed, 5) - 0.5) * 0.035 * x;
}

/** Stable boundary points, exposed for geometry checks and diagram evidence. */
export function lobedLeafOutline(seed = 0): readonly THREE.Vector2[] {
  const width = 0.96 + noise(seed, 0) * 0.07;
  const points: THREE.Vector2[] = [];
  for (let index = 0; index < OUTLINE.length; index += 1) {
    const [degrees, radius] = OUTLINE[index]!;
    const next = OUTLINE[(index + 1) % OUTLINE.length]!;
    const nextDegrees = index === OUTLINE.length - 1 ? 180 : next[0];
    // Two restrained teeth per edge; the major lobe/notch positions stay exact.
    for (let step = 0; step < 3; step += 1) {
      const t = step / 3;
      const angle = THREE.MathUtils.degToRad(degrees + (nextDegrees - degrees) * t);
      const interpolated = radius + (next[1] - radius) * t;
      const tooth = step === 1 && Math.abs(degrees) < 145 ? 1.038 : 1;
      const asymmetry = 1 + (noise(seed, index + 8) - 0.5) * 0.035;
      const r = interpolated * tooth * asymmetry;
      points.push(new THREE.Vector2(Math.sin(angle) * r * width, KNOT_Y + Math.cos(angle) * r));
    }
  }
  // The petiole/lamina seam is exact; jitter never leaves a floating blade.
  points[0]!.set(0, 0);
  return points;
}

export function createLobedLeafGeometry(seed = 0): THREE.BufferGeometry {
  const outline = lobedLeafOutline(seed);
  const positions: number[] = [0, KNOT_Y, surfaceZ(0, KNOT_Y, seed)];
  const colors: number[] = [0.91, 0.98, 0.86];
  const uvs: number[] = [0.5, KNOT_Y / 1.15];
  const indices: number[] = [];
  for (let ring = 1; ring <= RADIAL_STEPS; ring += 1) {
    const radius = ring / RADIAL_STEPS;
    for (let index = 0; index < outline.length; index += 1) {
      const tip = outline[index]!;
      const x = tip.x * radius;
      const y = KNOT_Y + (tip.y - KNOT_Y) * radius;
      positions.push(x, y, surfaceZ(x, y, seed));
      const tone = 0.87 - 0.09 * radius + noise(seed, index + 110) * 0.025;
      colors.push(tone * 0.96, tone * 1.04, tone * 0.9);
      uvs.push(x / 1.25 + 0.5, y / 1.15);
    }
  }
  const count = outline.length;
  // Outline is clockwise in the XY plane; reverse triangles to face +Z.
  for (let index = 0; index < count; index += 1) indices.push(0, 1 + (index + 1) % count, 1 + index);
  for (let ring = 1; ring < RADIAL_STEPS; ring += 1) {
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const a = 1 + (ring - 1) * count + index;
      const b = 1 + (ring - 1) * count + next;
      const c = 1 + ring * count + index;
      const d = 1 + ring * count + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  return finishGeometry("living-line/lobed-leaf", positions, colors, uvs, indices);
}

/** Five primary palmate veins, with fine secondary ribs inside each lobe.
 * All are subordinate raised ribbons, never separate acquisition targets.
 */
export function createLobedLeafVeinGeometry(seed = 0): THREE.BufferGeometry {
  const boundary = lobedLeafOutline(seed);
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  const ribbon = (from: THREE.Vector2, to: THREE.Vector2, width: number) => {
    const direction = to.clone().sub(from);
    const perpendicular = new THREE.Vector2(-direction.y, direction.x).normalize();
    const rows = 4;
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      const at = from.clone().lerp(to, t);
      const half = width * (1 - t * 0.85);
      for (const side of [-1, 1]) {
        const p = at.clone().addScaledVector(perpendicular, half * side);
        positions.push(p.x, p.y, surfaceZ(p.x, p.y, seed) + 0.0018);
        colors.push(0.81, 0.91, 0.75);
        uvs.push(p.x / 1.25 + 0.5, p.y / 1.15);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      const a = start + row * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  ribbon(new THREE.Vector2(0, 0.015), new THREE.Vector2(0, KNOT_Y), 0.0038);
  for (const angle of VEIN_TIPS) {
    const tipIndex = OUTLINE.findIndex(([degrees]) => degrees === angle) * 3;
    const tip = boundary[tipIndex]!;
    const origin = new THREE.Vector2(0, KNOT_Y);
    ribbon(origin, origin.clone().lerp(tip, 0.94), 0.0035);
    for (const fraction of [0.42, 0.65]) {
      for (const side of [-1, 1]) {
        const sideTip = boundary[(tipIndex + side * 3 + boundary.length) % boundary.length]!;
        const from = origin.clone().lerp(tip, fraction);
        const to = origin.clone().lerp(sideTip, fraction + 0.17);
        ribbon(from, to, 0.0013);
      }
    }
  }
  return finishGeometry("living-line/lobed-leaf-veins", positions, colors, uvs, indices);
}

function finishGeometry(name: string, positions: number[], colors: number[], uvs: number[], indices: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
