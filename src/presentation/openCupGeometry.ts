import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Single flower's authored presentation. No generator, camera or edit state.
 * Five individually curved petals make an open cup; this is deliberately not
 * Compact flower's dense, eight-petal tuft. Local +Z remains its facing axis.
 */
const TAU = Math.PI * 2;
const PETALS = 5;

function variation(seed: number, channel: number): number {
  let value = (seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Closed, very thin petal: both faces have their own normals and coloration.
 * Sharing edge positions closes the surface without an artificial white rim.
 */
function petal(seed: number, petalIndex: number): THREE.BufferGeometry {
  const rows = 11, columns = 8;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const angle = petalIndex * TAU / PETALS + (variation(seed, 10 + petalIndex) - 0.5) * 0.055;
  const length = 0.555 + (variation(seed, 20 + petalIndex) - 0.5) * 0.035;
  const lean = (variation(seed, 30 + petalIndex) - 0.5) * 0.035;
  const cupping = 0.18 + (variation(seed, 40 + petalIndex) - 0.5) * 0.026;
  const phase = variation(seed, 50 + petalIndex) * TAU;
  const samples: Array<[number, number]> = [[0, 0]];
  for (let row = 1; row < rows; row++) for (let col = 0; col <= columns; col++) {
    samples.push([row / rows, col / columns * 2 - 1]);
  }
  samples.push([1, 0]);
  const count = samples.length;
  for (let side = 0; side < 2; side++) for (const [t, across] of samples) {
    const envelope = Math.sin(Math.PI * t);
    const width = 0.286 * Math.pow(Math.max(0, envelope), 0.48) * (0.82 + 0.18 * t);
    const x = 0.035 + length * t;
    const y = across * width + lean * envelope;
    const edge = Math.pow(Math.abs(across), 3);
    const z = 0.012 + cupping * Math.pow(t, 1.2) - 0.09 * Math.pow(t, 7)
      + 0.027 * across * across * envelope
      + 0.006 * Math.sin(t * Math.PI * 3.4 + phase) * edge * envelope
      + (side ? -1 : 1) * (0.0025 + 0.003 * (1 - t));
    positions.push(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z);
    const throat = Math.pow(1 - t, 2.2);
    const vein = Math.pow(0.5 + 0.5 * Math.cos(across * 4 * Math.PI), 9) * envelope * 0.027;
    const value = 0.95 - 0.14 * throat - vein + 0.035 * edge;
    colors.push(value * (side ? 0.93 : 1), value * (1 - 0.17 * throat) * (side ? 0.94 : 1), value * (1 - 0.24 * throat) * (side ? 0.96 : 1));
  }
  const front: number[] = [];
  for (let col = 0; col < columns; col++) front.push(0, 1 + col, 2 + col);
  for (let row = 0; row < rows - 2; row++) for (let col = 0; col < columns; col++) {
    const a = 1 + row * (columns + 1) + col, b = a + columns + 1;
    front.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const last = 1 + (rows - 2) * (columns + 1);
  for (let col = 0; col < columns; col++) front.push(last + col, count - 1, last + col + 1);
  indices.push(...front);
  for (let index = 0; index < front.length; index += 3) indices.push(front[index] + count, front[index + 2] + count, front[index + 1] + count);
  const boundary = [0];
  for (let row = 0; row < rows - 1; row++) boundary.push(1 + row * (columns + 1));
  boundary.push(count - 1);
  for (let row = rows - 2; row >= 0; row--) boundary.push(1 + row * (columns + 1) + columns);
  for (let index = 0; index < boundary.length; index++) {
    const a = boundary[index], b = boundary[(index + 1) % boundary.length];
    indices.push(a, a + count, b, b, a + count, b + count);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createOpenCupCorollaGeometry(seed = 0): THREE.BufferGeometry {
  const petals = Array.from({ length: PETALS }, (_, index) => petal(seed, index));
  const geometry = mergeGeometries(petals)!;
  petals.forEach(part => part.dispose());
  geometry.name = "living-line/open-cup-corolla";
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** A filled rear receptacle covers the actual attachment, with five quiet
 * sepals following the petal backs. It is subordinate green, not another bloom.
 */
export function createOpenCupCalyxGeometry(seed = 0): THREE.BufferGeometry {
  const cup = new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.073), new THREE.Vector2(0.036, -0.065),
    new THREE.Vector2(0.095, -0.027), new THREE.Vector2(0.118, 0.006),
    new THREE.Vector2(0.084, 0.028), new THREE.Vector2(0, 0.032),
  ], 20);
  cup.rotateX(Math.PI / 2);
  cup.deleteAttribute("uv");
  const parts: THREE.BufferGeometry[] = [cup];
  for (let index = 0; index < PETALS; index++) {
    const angle = (index + 0.5) * TAU / PETALS;
    const reach = 0.235 + variation(seed, index + 80) * 0.018;
    const shape = new THREE.Shape();
    shape.moveTo(0.045, 0); shape.quadraticCurveTo(0.12, 0.045, reach, 0);
    shape.quadraticCurveTo(0.12, -0.045, 0.045, 0);
    const blade = new THREE.ShapeGeometry(shape, 5);
    blade.deleteAttribute("uv");
    const pos = blade.getAttribute("position");
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v);
      pos.setXYZ(v, x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), -0.027 + 0.024 * Math.pow(x / reach, 1.7));
    }
    blade.computeVertexNormals(); parts.push(blade);
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  geometry.name = "living-line/open-cup-calyx";
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

/** Connect the anthers to the throat, rather than leaving a floating dot ring. */
export function createOpenCupFilamentGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 18; index++) {
    const angle = index * TAU / 18;
    const start = new THREE.Vector3(Math.cos(angle) * 0.077, Math.sin(angle) * 0.077, 0.064);
    const end = new THREE.Vector3(Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0.095);
    const stem = new THREE.CylinderGeometry(0.003, 0.004, start.distanceTo(end), 5, 1, false);
    stem.applyMatrix4(new THREE.Matrix4().compose(start.clone().add(end).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize()), new THREE.Vector3(1, 1, 1)));
    parts.push(stem);
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  geometry.name = "living-line/open-cup-filaments";
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
