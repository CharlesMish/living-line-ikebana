import * as THREE from "three";

const SEGMENTS = 48;
const RINGS = 5;
const HALF_THICKNESS = .007;
function noise(seed: number, channel: number): number {
  let n = (seed ^ Math.imul(channel + 11, 0x9e3779b1)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function outline(seed: number, angle: number) {
  const ripple = 1 + .014 * Math.sin(angle * 7 + noise(seed, 3) * 6.28);
  const x = Math.cos(angle) * (.253 + noise(seed, 1) * .013) * ripple;
  const y = Math.sin(angle) * .32;
  // Both axial endpoints remain anchored; no detached membrane above a stalk.
  return new THREE.Vector2(x, .32 + y);
}
function surfaceZ(seed: number, x: number, y: number) {
  const normalizedY = (y - .32) / .32;
  return .019 * (1 - normalizedY * normalizedY) - .036 * x * x
    + (noise(seed, 9) - .5) * .045 * x + .002 * Math.sin(23 * y + 2 * x);
}
function paperColor(seed: number, x: number, y: number, radius: number, side: number): number[] {
  const nx = x / .26, ny = (y - .32) / .32;
  // A dry septum reads as a largely even sheet. These broad, quiet patches
  // suggest paper without inventing a leaf midrib or macroscopic radial veins;
  // the real cellulose structure is much smaller than this rendered surface.
  const patch = .012 * Math.sin(2.1 * nx + 1.3 * ny + noise(seed, 4) * Math.PI * 2)
    * Math.cos(1.8 * ny - .7 * nx + noise(seed, 5) * Math.PI * 2)
    + .005 * Math.sin(3.3 * nx - 2.5 * ny + noise(seed, 6) * Math.PI * 2);
  const shade = .96 - .022 * radius * radius + patch - (side < 0 ? .012 : 0);
  return [shade, shade * .995, shade * .97];
}
function finish(name: string, positions: number[], colors: number[], indices: number[]) {
  const g = new THREE.BufferGeometry(); g.name = name;
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}

/** A shallow billowed middle partition with a closed edge, not two coincident
 * planes. Opaque paper shading avoids alpha sorting through neighbouring stock.
 * Front and reverse are authored separately; neither face is a blank back. */
export function createSeedDiscGeometry(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const faceSize = 1 + RINGS * SEGMENTS;
  for (const side of [1, -1]) {
    positions.push(0, .32, surfaceZ(seed, 0, .32) + side * HALF_THICKNESS);
    colors.push(...paperColor(seed, 0, .32, 0, side));
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = ring / RINGS;
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = i / SEGMENTS * Math.PI * 2, p = outline(seed, angle);
        const x = p.x * r, y = .32 + (p.y - .32) * r;
        positions.push(x, y, surfaceZ(seed, x, y) + side * HALF_THICKNESS);
        colors.push(...paperColor(seed, x, y, r, side));
      }
    }
    const offset = side === 1 ? 0 : faceSize;
    const tri = (a: number, b: number, c: number) => indices.push(...(side === 1 ? [a, b, c] : [a, c, b]).map(v => v + offset));
    for (let i = 0; i < SEGMENTS; i++) tri(0, 1 + i, 1 + (i + 1) % SEGMENTS);
    for (let ring = 1; ring < RINGS; ring++) for (let i = 0; i < SEGMENTS; i++) {
      const next = (i + 1) % SEGMENTS;
      const a = 1 + (ring - 1) * SEGMENTS + i, b = 1 + ring * SEGMENTS + i;
      const c = 1 + (ring - 1) * SEGMENTS + next, d = 1 + ring * SEGMENTS + next;
      tri(a, b, c); tri(c, b, d);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = 1 + (RINGS - 1) * SEGMENTS + i, b = 1 + (RINGS - 1) * SEGMENTS + (i + 1) % SEGMENTS;
    indices.push(a, a + faceSize, b, b, a + faceSize, b + faceSize);
  }
  return finish("living-line/seed-disc", positions, colors, indices);
}

/** One owned accessory mesh: the rounded rim of the retained dry partition.
 * Its interior has no raised midrib or branching leaf-vein network. */
export function createSeedDiscRimGeometry(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  // Closed tubular rim. A pale brown edge keeps the silver visible against paper.
  const ringSides = 5;
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = i / SEGMENTS * Math.PI * 2, point = outline(seed, angle);
    const outward = new THREE.Vector2(Math.cos(angle), Math.sin(angle)).normalize();
    for (let j = 0; j < ringSides; j++) {
      const a = j / ringSides * Math.PI * 2;
      positions.push(point.x + outward.x * Math.cos(a) * .008,
        point.y + outward.y * Math.cos(a) * .008,
        surfaceZ(seed, point.x, point.y) + Math.sin(a) * .010);
      colors.push(.94, .92, .88);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < ringSides; j++) {
    const a = i * ringSides + j, b = ((i + 1) % SEGMENTS) * ringSides + j;
    const c = i * ringSides + (j + 1) % ringSides, d = ((i + 1) % SEGMENTS) * ringSides + (j + 1) % ringSides;
    indices.push(a, b, c, b, d, c);
  }
  return finish("living-line/seed-disc-rim", positions, colors, indices);
}
