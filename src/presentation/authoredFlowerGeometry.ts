import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Two related but distinct small flowers. Local +Z is the organ facing axis.
 * Each petal owns a disjoint convex polar sector. Its thin reverse has the same
 * XY footprint, so cupping and seed detail cannot push it through a neighbour.
 * Variation changes the petal within its sector, never its whole-object tilt.
 * This is disposable appearance: no saved radius, scale, spin or graph changes.
 */
export type AuthoredFlowerForm = "compact-cup" | "spray-cup";
const TAU = Math.PI * 2;
const ROWS = 12, COLUMNS = 8;

function variation(seed: number, channel: number): number {
  let value = (seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function authoredFlowerPetalCount(form: AuthoredFlowerForm): number {
  return form === "compact-cup" ? 8 : 6;
}

function petal(seed: number, petalIndex: number, form: AuthoredFlowerForm): THREE.BufferGeometry {
  const compact = form === "compact-cup";
  const count = authoredFlowerPetalCount(form), sector = TAU / count;
  const angle = petalIndex * sector;
  // Compact is 12% wider than the earlier nominal .412-radius tuft. Spray
  // retains that reach; a six-petal face gives it more air than Compact.
  const radius = (compact ? 0.461 : 0.412) * (0.985 + 0.03 * variation(seed, petalIndex + 10));
  const reach = radius - 0.046;
  const bend = (variation(seed, petalIndex + 20) - 0.5) * 0.034;
  const phase = variation(seed, petalIndex + 30) * TAU;
  const samples: Array<[number, number]> = [[0, 0]];
  for (let row = 1; row < ROWS; row++) for (let col = 0; col <= COLUMNS; col++) {
    samples.push([row / ROWS, col / COLUMNS * 2 - 1]);
  }
  samples.push([1, 0]);
  const verticesPerSide = samples.length;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  for (let side = 0; side < 2; side++) for (const [t, across] of samples) {
    const envelope = Math.sin(Math.PI * t);
    // The maximum half-width is less than half the fixed sector. Every point
    // and every triangle remain inside it, including the slight vein bend.
    const halfWidth = sector * (compact ? 0.477 : 0.465) * Math.pow(envelope, compact ? 0.30 : 0.44);
    const theta = angle + across * halfWidth + bend * envelope;
    const r = 0.046 + reach * t;
    const edge = Math.abs(across);
    const cup = compact ? 0.215 * Math.pow(t, 1.28) - 0.049 * Math.pow(t, 7)
      : 0.088 * Math.pow(t, 1.3) - 0.021 * Math.pow(t, 6);
    const fold = (compact ? 0.018 : 0.011) * across * across * envelope;
    const ripple = 0.0024 * Math.sin(phase + t * 3 * Math.PI) * Math.pow(edge, 3) * envelope;
    const z = 0.022 + cup + fold + ripple + (side ? -1 : 1) * (0.002 + 0.0015 * (1 - t));
    positions.push(r * Math.cos(theta), r * Math.sin(theta), z);
    const throat = Math.pow(1 - t, 2);
    const vein = Math.pow(0.5 + 0.5 * Math.cos(across * 3 * Math.PI), 10) * envelope * 0.024;
    const value = 0.96 - 0.14 * throat - vein + 0.025 * edge * edge;
    colors.push(value * (side ? 0.93 : 1), value * (1 - 0.10 * throat) * (side ? 0.95 : 1), value * (1 - 0.035 * throat) * (side ? 0.97 : 1));
  }
  const front: number[] = [];
  for (let col = 0; col < COLUMNS; col++) front.push(0, 1 + col, 2 + col);
  for (let row = 0; row < ROWS - 2; row++) for (let col = 0; col < COLUMNS; col++) {
    const a = 1 + row * (COLUMNS + 1) + col, b = a + COLUMNS + 1;
    front.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const last = 1 + (ROWS - 2) * (COLUMNS + 1);
  for (let col = 0; col < COLUMNS; col++) front.push(last + col, verticesPerSide - 1, last + col + 1);
  indices.push(...front);
  for (let index = 0; index < front.length; index += 3) {
    indices.push(front[index] + verticesPerSide, front[index + 2] + verticesPerSide, front[index + 1] + verticesPerSide);
  }
  const boundary = [0];
  for (let row = 0; row < ROWS - 1; row++) boundary.push(1 + row * (COLUMNS + 1));
  boundary.push(verticesPerSide - 1);
  for (let row = ROWS - 2; row >= 0; row--) boundary.push(1 + row * (COLUMNS + 1) + COLUMNS);
  for (let index = 0; index < boundary.length; index++) {
    const a = boundary[index], b = boundary[(index + 1) % boundary.length];
    indices.push(a, a + verticesPerSide, b, b, a + verticesPerSide, b + verticesPerSide);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createAuthoredFlowerCorollaGeometry(seed: number, form: AuthoredFlowerForm): THREE.BufferGeometry {
  const petals = Array.from({ length: authoredFlowerPetalCount(form) }, (_, index) => petal(seed, index, form));
  const result = mergeGeometries(petals)!;
  petals.forEach(part => part.dispose());
  result.name = `living-line/${form}-corolla`;
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

/** Filled attachment below the petal bases, with small sepals following the
 * underside. No exposed spokes extending through the front petal surface.
 */
export function createAuthoredFlowerCalyxGeometry(seed: number, form: AuthoredFlowerForm): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const cup = new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.047), new THREE.Vector2(0.027, -0.039),
    new THREE.Vector2(0.052, -0.012), new THREE.Vector2(0.065, 0.013),
    new THREE.Vector2(0.047, 0.024), new THREE.Vector2(0, 0.028),
  ], 16);
  cup.rotateX(Math.PI / 2); cup.deleteAttribute("uv"); parts.push(cup);
  const count = authoredFlowerPetalCount(form);
  for (let index = 0; index < count; index++) {
    const theta = (index + 0.5) * TAU / count;
    const reach = (form === "compact-cup" ? 0.151 : 0.136) + variation(seed, index + 80) * 0.008;
    const blade = new THREE.Shape();
    blade.moveTo(0.039, 0); blade.quadraticCurveTo(0.083, -0.028, reach, 0);
    blade.quadraticCurveTo(0.083, 0.028, 0.039, 0);
    const geometry = new THREE.ShapeGeometry(blade, 5); geometry.deleteAttribute("uv");
    const position = geometry.getAttribute("position");
    for (let vertex = 0; vertex < position.count; vertex++) {
      const x = position.getX(vertex), y = position.getY(vertex);
      position.setXYZ(vertex, x * Math.cos(theta) - y * Math.sin(theta), x * Math.sin(theta) + y * Math.cos(theta),
        -0.016 + 0.031 * Math.pow(x / reach, 1.8));
    }
    geometry.computeVertexNormals(); parts.push(geometry);
  }
  const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  result.name = `living-line/${form}-calyx`;
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

/** Quiet physical connections from the central disk to the anther ring. */
export function createAuthoredFlowerFilamentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 10; index++) {
    const theta = index * TAU / 10;
    const a = new THREE.Vector3(Math.cos(theta) * 0.044, Math.sin(theta) * 0.044, 0.046);
    const b = new THREE.Vector3(Math.cos(theta) * 0.073, Math.sin(theta) * 0.073, 0.066);
    const stalk = new THREE.CylinderGeometry(0.002, 0.003, a.distanceTo(b), 4, 1, false);
    stalk.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1)));
    parts.push(stalk);
  }
  const result = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
  result.name = "living-line/authored-flower-filaments";
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}
