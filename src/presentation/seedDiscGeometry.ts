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
    colors.push(.98, .98, .965);
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = ring / RINGS;
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = i / SEGMENTS * Math.PI * 2, p = outline(seed, angle);
        const x = p.x * r, y = .32 + (p.y - .32) * r;
        positions.push(x, y, surfaceZ(seed, x, y) + side * HALF_THICKNESS);
        // Radial fibres and a subdued darker margin, with a slightly chalkier
        // reverse. The dry septum has shed the large seeds and outer valves.
        const fibre = .023 * Math.sin(angle * 17 + r * 3 + noise(seed, 4));
        const shade = .96 - r * r * .10 + fibre + (side < 0 ? -.025 : 0);
        colors.push(shade, shade * .995, shade * .96);
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

/** One owned accessory mesh: rounded fibrous rim, a
 * faint branching vein network on BOTH faces. Veins use the actual triangulated
 * membrane height so a shaded line cannot poke through the opposing surface. */
export function createSeedDiscRimGeometry(seed = 0, membrane?: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const membraneGeometry = membrane ?? createSeedDiscGeometry(seed);
  const p = membraneGeometry.getAttribute("position"), ix = membraneGeometry.index!;
  const sample = (x: number, y: number): number => {
    // First face has (2 * RINGS - 1) * SEGMENTS triangles.
    for (let t = 0; t < (2 * RINGS - 1) * SEGMENTS * 3; t += 3) {
      const a = ix.getX(t), b = ix.getX(t + 1), c = ix.getX(t + 2);
      const ax = p.getX(a), ay = p.getY(a), bx = p.getX(b), by = p.getY(b), cx = p.getX(c), cy = p.getY(c);
      const det = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
      const u = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det;
      const v = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det;
      if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return u*p.getZ(a)+v*p.getZ(b)+(1-u-v)*p.getZ(c)-HALF_THICKNESS;
    }
    throw new Error("Seed-disc vein left its partition.");
  };
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
  const ribbon = (from: THREE.Vector2, to: THREE.Vector2, width: number, side: number) => {
    const offset = positions.length / 3, direction = to.clone().sub(from);
    const across = new THREE.Vector2(-direction.y, direction.x).normalize();
    for (let row = 0; row <= 12; row++) {
      const t = row / 12, point = from.clone().lerp(to, t);
      for (const edge of [-1, 1]) {
        const x = point.x + across.x * width * (1 - t * .6) * edge;
        const y = point.y + across.y * width * (1 - t * .6) * edge;
        positions.push(x, y, sample(x, y) + side * (HALF_THICKNESS + .0024));
        colors.push(1.18, 1.16, 1.10);
      }
    }
    for (let row = 0; row < 12; row++) {
      const a = offset + row * 2;
      const faces = [a, a + 2, a + 1, a + 1, a + 2, a + 3];
      for (let t = 0; t < faces.length; t += 3) indices.push(...(side === 1 ? faces.slice(t, t + 3) : [faces[t]!, faces[t + 2]!, faces[t + 1]!]));
    }
  };
  for (const side of [1, -1]) {
    ribbon(new THREE.Vector2(0, .035), new THREE.Vector2(0, .6), .0017, side);
    for (const y of [.16, .29, .41]) for (const sign of [-1, 1]) {
      ribbon(new THREE.Vector2(0, y), new THREE.Vector2(sign * (.17 - Math.abs(y - .28) * .3), y + .12), .0010, side);
    }
  }
  if (!membrane) membraneGeometry.dispose();
  return finish("living-line/seed-disc-rim", positions, colors, indices);
}
