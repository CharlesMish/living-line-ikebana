import * as THREE from "three";

/** Presentation for `parasol-leaf-v1`. Local +Y is the supporting tangent, so
 * the open blade lies across local X/Z with its hollow face toward +Y, and the
 * furled leaf stands along +Y. Every array is a pure function of the organ
 * seed: stable across edits, pruning elsewhere and renderer recreation. */

const TAU = Math.PI * 2;
/** Blade radius at organ scale 1, before the margin's slow undulation. */
export const PARASOL_BLADE_RADIUS = 0.66;
/** The rim stands this far above the centre: a shallow bowl, never a flat coin. */
export const PARASOL_BLADE_DEPTH = 0.085;
/** Furled leaf height and widest radius at organ scale 1. */
export const PARASOL_FURL_HEIGHT = 0.62;
export const PARASOL_FURL_RADIUS = 0.068;

const SEGMENTS = 56;
const RINGS = 6;
const HALF_THICKNESS = 0.008;

function noise(seed: number, channel: number): number {
  let n = (seed ^ Math.imul(channel + 17, 0x9e3779b1)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function finish(name: string, positions: number[], colors: number[], indices: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.name = name;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Number of main ribs radiating from the stalk attachment. */
export function parasolRibCount(seed: number): number {
  return 13 + Math.floor(noise(seed, 1) * 3);
}

/** Margin radius: entire (no notch), with two slow seeded undulations. */
function marginRadius(seed: number, angle: number): number {
  return PARASOL_BLADE_RADIUS * (1
    + 0.034 * Math.sin(5 * angle + noise(seed, 2) * TAU)
    + 0.016 * Math.sin(11 * angle + noise(seed, 3) * TAU));
}

/** Mid-surface point at ring fraction `rho` (0 centre, 1 margin). */
function bladePoint(seed: number, rho: number, angle: number): [number, number, number] {
  const radius = marginRadius(seed, angle) * rho;
  const wave = Math.sin(6 * angle + noise(seed, 4) * TAU) * 0.6 + Math.sin(3 * angle + noise(seed, 5) * TAU) * 0.4;
  // Rises to the rim, ripples only near it, and dips to a small navel where the stalk meets it.
  const y = PARASOL_BLADE_DEPTH * Math.pow(rho, 1.7)
    + 0.04 * rho * rho * rho * wave
    - 0.018 * Math.exp(-(rho * rho) / 0.018);
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

function bladeColor(seed: number, rho: number, angle: number, side: number): [number, number, number] {
  const ribs = parasolRibCount(seed);
  // Quiet darker panels between ribs and a pale eye at the attachment.
  const panel = 0.035 * Math.cos(ribs * angle + noise(seed, 6) * TAU) * rho;
  const eye = 0.2 * Math.exp(-(rho * rho) / 0.012);
  if (side > 0) {
    const shade = 0.98 + panel + eye - 0.07 * rho * rho;
    return [shade, shade * 1.01, shade * 0.98];
  }
  // The reverse is paler and greyer, so a tilted leaf reads as two faces.
  const shade = 1.2 + panel * 0.6 - 0.05 * rho;
  return [shade * 1.02, shade, shade * 0.9];
}

/** One connected round blade with a closed edge: 2 × (1 + 6 × 56) vertices.
 * Upper and lower faces are separate authored surfaces, not a doubled plane. */
export function createParasolBladeGeometry(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const faceSize = 1 + RINGS * SEGMENTS;
  for (const side of [1, -1]) {
    const centre = bladePoint(seed, 0, 0);
    positions.push(centre[0], centre[1] + side * HALF_THICKNESS, centre[2]);
    colors.push(...bladeColor(seed, 0, 0, side));
    for (let ring = 1; ring <= RINGS; ring++) {
      const rho = ring / RINGS;
      // Thin toward the margin so the edge is a line, not a slab.
      const half = HALF_THICKNESS * (1 - 0.55 * rho);
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = i / SEGMENTS * TAU, point = bladePoint(seed, rho, angle);
        positions.push(point[0], point[1] + side * half, point[2]);
        colors.push(...bladeColor(seed, rho, angle, side));
      }
    }
    const offset = side === 1 ? 0 : faceSize;
    // +Y is the upper face: wind it so its normals point up.
    const tri = (a: number, b: number, c: number) =>
      indices.push(...(side === 1 ? [a, c, b] : [a, b, c]).map(v => v + offset));
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
    indices.push(a, b, a + faceSize, b, b + faceSize, a + faceSize);
  }
  return finish("living-line/parasol-blade", positions, colors, indices);
}

/** Raised ribs on both faces: each runs from the attachment toward the margin
 * and divides once before it. They are part of the leaf's exact pick surface. */
export function createParasolRibGeometry(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const ribs = parasolRibCount(seed);
  const ribbon = (side: number, stations: Array<{ rho: number; angle: number; width: number }>) => {
    const start = positions.length / 3;
    for (const station of stations) {
      const point = bladePoint(seed, station.rho, station.angle);
      const lift = side * (HALF_THICKNESS * (1 - 0.55 * station.rho) + 0.0035);
      // Across the rib, along the local tangential direction.
      const tx = -Math.sin(station.angle), tz = Math.cos(station.angle);
      for (const across of [-1, 1]) {
        positions.push(point[0] + tx * across * station.width, point[1] + lift, point[2] + tz * across * station.width);
        const shade = side > 0 ? 1 : 0.9;
        colors.push(shade, shade, shade * 0.97);
      }
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = start + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side > 0) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
    }
  };
  for (const side of [1, -1]) {
    for (let rib = 0; rib < ribs; rib++) {
      const angle = (rib + (noise(seed, 20 + rib) - 0.5) * 0.3) / ribs * TAU;
      const fork = 0.56 + noise(seed, 40 + rib) * 0.1;
      const main = [0.05, 0.2, 0.36, fork].map(rho => ({ rho, angle, width: 0.0095 * (1 - rho * 0.72) }));
      ribbon(side, main);
      const spread = TAU / ribs * 0.26;
      for (const turn of [-1, 1]) {
        ribbon(side, [fork, 0.78, 0.93].map((rho, index) => ({
          rho, angle: angle + turn * spread * index / 2, width: 0.0095 * (1 - rho * 0.72) * (index === 2 ? 0.45 : 0.85),
        })));
      }
    }
  }
  return finish("living-line/parasol-ribs", positions, colors, indices);
}

const FURL_SIDES = 14;
const FURL_RINGS = 14;

/** A young leaf still rolled on itself: a pointed spindle whose radius grows
 * once around the roll and then steps back, so the overlapping edge spirals up
 * it. One connected mesh; the step is real geometry, not a painted line. It is
 * open only where it sits on its stalk and at the drawn-out point. */
export function createParasolFurlGeometry(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const twist = (1.15 + noise(seed, 7) * 0.5) * (noise(seed, 8) < 0.5 ? -1 : 1);
  const lean = (noise(seed, 9) - 0.5) * 0.05;
  for (let ring = 0; ring <= FURL_RINGS; ring++) {
    const t = ring / FURL_RINGS;
    // Slender at the stalk, fullest below the middle, drawn out to a point.
    const profile = 0.26 + 0.74 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.9);
    const radius = PARASOL_FURL_RADIUS * (t === 1 ? 0.06 : profile * (1 - 0.35 * t * t));
    for (let side = 0; side <= FURL_SIDES; side++) {
      const around = side / FURL_SIDES;
      const angle = around * TAU + twist * TAU * t;
      const r = radius * (0.8 + 0.34 * around);
      positions.push(Math.cos(angle) * r + lean * t * t, t * PARASOL_FURL_HEIGHT, Math.sin(angle) * r);
      // The outer wrap is lighter; the tucked edge and the tip are a little deeper.
      const shade = 1.04 + 0.14 * around - 0.1 * t;
      colors.push(shade * 1.04, shade * 1.08, shade * 0.86);
    }
  }
  const row = FURL_SIDES + 1;
  for (let ring = 0; ring < FURL_RINGS; ring++) {
    for (let side = 0; side < FURL_SIDES; side++) {
      const a = ring * row + side, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    // The step where the outer wrap ends and the roll shows beneath it.
    const outer = ring * row + FURL_SIDES, inner = ring * row;
    indices.push(outer, outer + row, inner, inner, outer + row, inner + row);
  }
  return finish("living-line/parasol-furl", positions, colors, indices);
}
