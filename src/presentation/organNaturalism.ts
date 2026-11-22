import * as THREE from "three";
import type { LeafForm } from "./botanicalGeometry.ts";

/**
 * Presentation-only "natural" surface pass, applied to an organ's finished
 * local geometries before any exact hit copy is made.
 *
 * The authored geometry modules keep their accepted base shapes and their own
 * tests. This pass bends those shapes the way living material sits: a blade
 * arches and recurves, cups or flattens, twists a little, ripples at the
 * margin and curves sideways; one leaf of a pair is never the other's copy.
 * Everything is a pure function of the organ seed and local coordinates, so a
 * leaf keeps its exact shape through bends, cuts elsewhere, rebuilds and WebGL
 * recovery. Companion meshes (veins, ribs, rims) receive the same field and
 * stay on their surface. `?surface=baseline` skips the pass for comparison.
 */

export type SurfaceDraw = "natural" | "baseline";
export const ACCEPTED_SURFACE_DRAW: SurfaceDraw = "natural";

function channel(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 101, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
const signed = (seed: number, index: number) => channel(seed, index) * 2 - 1;
const TAU = Math.PI * 2;

/** Blade field in blade units: `along` 0 at the base to 1 at the tip, `across` -1..1. */
export interface BladeWarp {
  /** Tip recurve (negative bends away from the upper face), times length. */
  readonly arch: number;
  /** Across-blade curvature: positive cups the halves up. */
  readonly cup: number;
  readonly twist: number;
  /** Margin undulation amplitude, times length. */
  readonly ripple: number;
  readonly rippleCount: number;
  readonly ripplePhase: number;
  /** Sideways (in-plane) curve of the midrib, times length. */
  readonly sweep: number;
  /**
   * How far each half folds up from the midrib (rise per half-width at the
   * margin). The two halves are never the same, so a blade is a lopsided V or
   * a lopsided roof, not a plate.
   */
  readonly foldLeft: number;
  readonly foldRight: number;
  /** How far each margin turns back down beyond the fold. */
  readonly reflexLeft: number;
  readonly reflexRight: number;
  /** Divided blades: how much the fold differs from leaflet to leaflet. */
  readonly leafletVary: number;
  readonly leafletPhaseLeft: number;
  readonly leafletPhaseRight: number;
}

export function bladeWarp(seed: number, strength = 1, divided = false): BladeWarp {
  // Most blades fold up a little; some lie nearly flat, a few roof downward.
  const fold = (-0.12 + 0.6 * channel(seed, 9)) * (divided ? 1.5 : 1);
  const lopsided = 0.65 * signed(seed, 10);
  return {
    foldLeft: (fold * (1 + lopsided) + 0.07 * signed(seed, 11)) * strength,
    foldRight: (fold * (1 - lopsided) + 0.07 * signed(seed, 12)) * strength,
    reflexLeft: 0.16 * channel(seed, 13) * strength,
    reflexRight: 0.16 * channel(seed, 14) * strength,
    leafletVary: divided ? 0.75 : 0,
    leafletPhaseLeft: channel(seed, 15) * TAU,
    leafletPhaseRight: channel(seed, 16) * TAU,
    arch: (-0.05 - 0.12 * channel(seed, 1) + 0.06 * Math.max(0, signed(seed, 2) - 0.6)) * strength,
    cup: (-0.04 + 0.16 * channel(seed, 3)) * strength,
    twist: 0.15 * signed(seed, 4) * strength,
    ripple: (0.01 + 0.02 * channel(seed, 5)) * strength,
    rippleCount: 3 + Math.floor(channel(seed, 6) * 4),
    ripplePhase: channel(seed, 7) * TAU,
    sweep: 0.09 * signed(seed, 8) * strength,
  };
}

interface BladeFrame {
  /** Long-axis extent in local Y, base to tip. */
  readonly y0: number;
  readonly y1: number;
  /** Half width used to normalise `across`. */
  readonly halfWidth: number;
}

type Field = (x: number, y: number, z: number) => readonly [number, number, number];

/**
 * Bends a point about a midrib of curvature `k` starting at `y0`: `offset` is
 * the point's distance from the midrib in the bending plane. Arc length is
 * kept, so a recurved tip comes back toward the base instead of overshooting.
 */
function bend(y: number, offset: number, y0: number, k: number): readonly [number, number] {
  const s = y - y0;
  if (Math.abs(k) < 1e-6 || s <= 0) return [y, offset];
  const angle = k * s;
  return [y0 + Math.sin(angle) / k - offset * Math.sin(angle), (1 - Math.cos(angle)) / k + offset * Math.cos(angle)];
}

/** Long-axis blades (elliptic, lanceolate, fan, pinnate pinnae): +Y along, +Z the upper face. */
function bladeField(frame: BladeFrame, warp: BladeWarp): Field {
  const length = frame.y1 - frame.y0;
  // Tip displacement of a bend is about k L² / 2; express both as curvature.
  const archK = (2 * warp.arch) / length;
  const sweepK = (2 * warp.sweep) / length;
  return (x, y, z) => {
    const along = Math.min(1, Math.max(0, (y - frame.y0) / length));
    const across = Math.max(-1.4, Math.min(1.4, x / frame.halfWidth));
    const belly = Math.pow(Math.sin(Math.PI * Math.min(1, along)), 0.6);
    const margin = Math.pow(Math.min(1, Math.abs(across)), 2.4);
    // Each half folds about the midrib by its own amount, and its margin turns back.
    const left = across < 0;
    const reach = Math.min(1, Math.abs(across));
    const leaflet = 1 + warp.leafletVary * Math.sin(11 * along + (left ? warp.leafletPhaseLeft : warp.leafletPhaseRight));
    const fold = frame.halfWidth * belly * (
      (left ? warp.foldLeft : warp.foldRight) * leaflet * reach
      - (left ? warp.reflexLeft : warp.reflexRight) * reach * reach * reach
    );
    // Surface form across the blade first, then the midrib's two bends.
    const lift = z + fold + length * (
      warp.cup * across * across * belly * 0.5
      + warp.twist * across * along * 0.5
      + warp.ripple * margin * Math.sin(warp.rippleCount * Math.PI * along + warp.ripplePhase) * belly
    );
    const [sy, sx] = bend(y, x, frame.y0, sweepK);
    const [ay, az] = bend(sy, lift, frame.y0, archK);
    return [sx - x, ay - y, az - z];
  };
}

/** Main vein directions of the lobed lamina, in radians from +Y (see lobedLeafGeometry). */
const LOBE_VEINS = [-108, -49, 0, 49, 108].map((degrees) => (degrees * Math.PI) / 180);
const LOBE_HALF_GAP = (27 * Math.PI) / 180;

/** Radial laminae (lobed): origin at the petiole tip, +Y along, +Z the upper face. */
function radialField(radius: number, seed: number): Field {
  const droop = 0.08 + 0.08 * channel(seed, 20);
  const lobe1 = 0.09 * signed(seed, 21), lobe2 = 0.05 * signed(seed, 22);
  const phase1 = channel(seed, 23) * TAU, phase2 = channel(seed, 24) * TAU;
  const cup = -0.03 + 0.09 * channel(seed, 25);
  const twist = 0.08 * signed(seed, 26);
  // Pleats: each main vein is a ridge and each sinus a valley, by its own depth.
  const pleats = LOBE_VEINS.map((_, index) => 0.05 + 0.09 * channel(seed, 27 + index));
  return (x, y) => {
    const r = Math.hypot(x, y) / radius;
    const angle = Math.atan2(x, y);
    let nearest = 0, gap = Infinity;
    for (let index = 0; index < LOBE_VEINS.length; index += 1) {
      const distance = Math.abs(angle - LOBE_VEINS[index]);
      if (distance < gap) { gap = distance; nearest = index; }
    }
    const valley = Math.min(1, gap / LOBE_HALF_GAP);
    const pleat = -pleats[nearest] * r * valley * valley * (3 - 2 * valley);
    // Each lobe sits at its own height: the outer lobes droop, some lift.
    const dz = radius * (
      -droop * r * r * (0.4 + 0.6 * Math.abs(Math.sin(angle)))
      + r * r * (lobe1 * Math.sin(2.5 * angle + phase1) + lobe2 * Math.sin(5 * angle + phase2))
      + cup * (x / radius) * (x / radius)
      + twist * (x / radius) * Math.max(0, y / radius)
      + pleat
    );
    return [0, 0, dz];
  };
}

/** Round peltate blade (parasol): lies across X/Z, +Y the upper face. */
function parasolField(radius: number, seed: number): Field {
  const sagAngle = channel(seed, 30) * TAU;
  const sag = 0.1 + 0.1 * channel(seed, 31);
  const quilt = 0.012 + 0.008 * channel(seed, 32);
  const ribs = 13 + Math.floor(channel(seed, 33) * 3);
  const flutter = 0.03 + 0.03 * channel(seed, 34);
  const flutterPhase = channel(seed, 35) * TAU;
  return (x, _y, z) => {
    const rho = Math.min(1.2, Math.hypot(x, z) / radius);
    const angle = Math.atan2(z, x);
    // One side settles under its own weight; panels between ribs pucker a little.
    const side = Math.max(0, Math.cos(angle - sagAngle));
    const dy = radius * (
      -sag * rho * rho * side * side
      + quilt * rho * (1 - rho * 0.6) * (0.5 - 0.5 * Math.cos(ribs * angle))
      + flutter * Math.pow(rho, 3) * Math.sin(4 * angle + flutterPhase)
    );
    return [0, dy, 0];
  };
}

/** Dry silver partition: +Z normal, long axis +Y from 0 to ~0.64. */
function seedDiscField(seed: number): Field {
  const twist = 0.3 * signed(seed, 40);
  const curl = 0.15 * signed(seed, 41);
  const lean = 0.1 * signed(seed, 42);
  const swell = 0.9 + 0.2 * channel(seed, 43);
  const skew = 0.06 * signed(seed, 44);
  const stretch = 0.97 + 0.06 * channel(seed, 45);
  return (x, y) => {
    const v = y / 0.64;
    const u = x / 0.27;
    // Slightly irregular outline and size, a gentle twist from the stalk, and a lean.
    const nx = x * swell * (1 + skew * (v - 0.5));
    const dz = 0.64 * (twist * u * v * 0.5 + curl * (u * u - 0.33) * v * 0.35 + lean * v * v * 0.4);
    return [nx - x, y * (stretch - 1), dz];
  };
}

/**
 * The organ's sphere acquisition proxy: the same polygonal sphere the studio
 * raycasts (10 × 8 segments), so containment is checked against its real faces.
 */
export interface SurfaceBound {
  readonly center: THREE.Vector3;
  readonly radius: number;
  /**
   * The checked geometry's own rotation about +Z inside the organ. The faceted
   * proxy is not symmetric about Z, so its faces are turned into that frame.
   */
  readonly turnZ?: number;
}

function proxyPlanes(bound: SurfaceBound): THREE.Plane[] {
  const sphere = new THREE.SphereGeometry(bound.radius, 10, 8);
  const position = sphere.getAttribute("position"), index = sphere.index!;
  const planes: THREE.Plane[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i));
    b.fromBufferAttribute(position, index.getX(i + 1));
    c.fromBufferAttribute(position, index.getX(i + 2));
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-20) continue;
    normal.normalize();
    if (normal.dot(a) < 0) normal.negate();
    const point = a.clone().add(bound.center);
    if (bound.turnZ) {
      const back = new THREE.Matrix4().makeRotationZ(-bound.turnZ);
      normal.applyMatrix4(back);
      point.applyMatrix4(back);
    }
    planes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point));
  }
  sphere.dispose();
  return planes;
}

/**
 * Applies a field to every geometry in place. With a bound, the whole field is
 * scaled down uniformly until every vertex that started inside the proxy stays
 * inside it. A vertex the authored shape already rests on a proxy face only
 * slides along that face. So a curl never carries visible surface out of
 * acquisition.
 */
function applyField(geometries: readonly THREE.BufferGeometry[], field: Field, bound?: SurfaceBound): number {
  const displaced = geometries.map((geometry) => {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const offsets = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const [dx, dy, dz] = field(position.getX(index), position.getY(index), position.getZ(index));
      offsets[index * 3] = dx; offsets[index * 3 + 1] = dy; offsets[index * 3 + 2] = dz;
    }
    return { position, offsets };
  });
  let scale = 1;
  if (bound) {
    const planes = proxyPlanes(bound);
    const margin = 1e-4;
    const p = new THREE.Vector3(), d = new THREE.Vector3();
    for (const { position, offsets } of displaced) {
      for (let index = 0; index < position.count; index += 1) {
        p.fromBufferAttribute(position, index);
        d.set(offsets[index * 3], offsets[index * 3 + 1], offsets[index * 3 + 2]);
        // A vertex the authored shape already rests on (or past) a face may
        // slide along that face but never move further out through it.
        let adjusted = false;
        for (const plane of planes) {
          if (-plane.distanceToPoint(p) - margin >= 0) continue;
          const toward = plane.normal.dot(d);
          if (toward > 0) { d.addScaledVector(plane.normal, -toward); adjusted = true; }
        }
        if (adjusted) { offsets[index * 3] = d.x; offsets[index * 3 + 1] = d.y; offsets[index * 3 + 2] = d.z; }
        for (const plane of planes) {
          const inside = -plane.distanceToPoint(p) - margin;
          const toward = plane.normal.dot(d);
          if (inside < 0 || toward <= 0) continue; // Resting on this face, or moving inward.
          scale = Math.min(scale, inside / toward);
        }
      }
    }
  }
  for (const { position, offsets } of displaced) {
    for (let index = 0; index < position.count; index += 1) {
      position.setXYZ(index,
        position.getX(index) + offsets[index * 3] * scale,
        position.getY(index) + offsets[index * 3 + 1] * scale,
        position.getZ(index) + offsets[index * 3 + 2] * scale);
    }
    position.needsUpdate = true;
  }
  for (const geometry of geometries) {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return scale;
}

/**
 * Bends a leaf's lamina and its companion meshes together, in place.
 * The first geometry is the lamina; later ones (veins, ribs) follow it.
 */
/** Returns how much of the natural field survived the bound (1 = all of it). */
export function naturalizeLeaf(geometries: readonly THREE.BufferGeometry[], seed: number, form: LeafForm, bound?: SurfaceBound): number {
  const [lamina] = geometries;
  if (!lamina) return 0;
  lamina.computeBoundingBox();
  const box = lamina.boundingBox!;
  const field = form === "parasol" ? parasolField(Math.max(box.max.x, -box.min.x, 1e-3), seed)
    : form === "lobed" ? radialField(Math.max(box.max.y, 1e-3), seed)
    : bladeField({
      y0: box.min.y, y1: Math.max(box.max.y, box.min.y + 1e-3),
      halfWidth: Math.max(box.max.x, -box.min.x, 1e-3),
    }, bladeWarp(seed, form === "pinnate" ? 0.55 : 1, form === "pinnate"));
  const kept = applyField(geometries, field, bound);
  tintLeaf(lamina, seed);
  return kept;
}

/** Bends a seed disc and its rim together, in place. Its proxy is the exact surface. */
export function naturalizeSeedDisc(geometries: readonly THREE.BufferGeometry[], seed: number): void {
  applyField(geometries, seedDiscField(seed));
}

/**
 * A flower that faces +Z with its petals spread in X/Y. No corolla is a
 * surface of revolution: some petals reflex and others reach forward, the
 * whole face tips slightly, and petals differ a little in length. Low angular
 * harmonics keep every petal smooth and joined; the centre barely moves, so
 * calyx, eye and anthers stay seated.
 */
function corollaField(radius: number, seed: number): Field {
  const lift = [1, 2, 3].map((harmonic) => ({
    harmonic,
    amount: [0.1, 0.085, 0.07][harmonic - 1] * signed(seed, 100 + harmonic),
    phase: channel(seed, 110 + harmonic) * TAU,
  }));
  const open = 0.1 * signed(seed, 120);
  const reach = [1, 2].map((harmonic) => ({
    harmonic,
    amount: 0.05 * signed(seed, 121 + harmonic),
    phase: channel(seed, 125 + harmonic) * TAU,
  }));
  return (x, y) => {
    const r = Math.min(1.3, Math.hypot(x, y) / radius);
    if (r < 1e-6) return [0, 0, 0];
    const angle = Math.atan2(y, x);
    let dz = open;
    for (const term of lift) dz += term.amount * Math.sin(term.harmonic * angle + term.phase);
    let stretch = 0;
    for (const term of reach) stretch += term.amount * Math.sin(term.harmonic * angle + term.phase);
    const grow = stretch * r; // nothing at the centre, full at the petal tips
    return [x * grow, y * grow, radius * dz * r * r];
  };
}

export interface CorollaPart {
  readonly geometry: THREE.BufferGeometry;
  /** The mesh's rotation about +Z inside the bloom (separate petals). */
  readonly angle: number;
}

/**
 * Shapes a +Z-facing corolla in place. Each part is bounded on its own by the
 * bloom's acquisition sphere, exactly as leaves are.
 */
export function naturalizeCorolla(parts: readonly CorollaPart[], seed: number, bound?: SurfaceBound): void {
  let radius = 0;
  for (const { geometry } of parts) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) radius = Math.max(radius, Math.hypot(position.getX(index), position.getY(index)));
  }
  if (!(radius > 1e-4)) return;
  const field = corollaField(radius, seed);
  for (const { geometry, angle } of parts) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // The part's local frame is the bloom frame turned by `angle` about +Z.
    const local: Field = (x, y, z) => {
      const [dx, dy, dz] = field(x * cos - y * sin, x * sin + y * cos, z);
      return [dx * cos + dy * sin, -dx * sin + dy * cos, dz];
    };
    applyField([geometry], local, bound ? { ...bound, turnZ: angle } : undefined);
  }
}

/**
 * Repeated flowers are not one colour: a restrained per-head value and warmth
 * shift on vertex colours only. Geometry, head transforms and acquisition are
 * untouched; material colour roles and botanical tones still apply on top.
 */
export function tintBloom(geometry: THREE.BufferGeometry, seed: number): void {
  const color = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!color) return;
  const value = 1 + 0.07 * signed(seed, 90);
  const warm = 0.035 * signed(seed, 91);
  for (let index = 0; index < color.count; index += 1) {
    color.setXYZ(index,
      color.getX(index) * value * (1 + warm),
      color.getY(index) * value,
      color.getZ(index) * value * (1 - warm));
  }
  color.needsUpdate = true;
}

/**
 * Leaves of one plant are not one colour: some a little older and deeper,
 * some younger and brighter, a few with a warmer edge. Restrained vertex-colour
 * multipliers only; the material colour role and botanical tones are unchanged.
 */
export function tintLeaf(geometry: THREE.BufferGeometry, seed: number): void {
  const color = geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!color) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const age = signed(seed, 60);
  const value = 1 + 0.08 * age;
  const warm = channel(seed, 61) > 0.7 ? 0.06 + 0.07 * channel(seed, 62) : 0;
  const span = Math.max(box.max.y - box.min.y, box.max.x - box.min.x, 1e-3);
  for (let index = 0; index < color.count; index += 1) {
    const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
    // A warmer margin and tip on the older leaves; a faint soft patch on all.
    const edge = Math.min(1, Math.hypot(x - (box.max.x + box.min.x) / 2, y - box.min.y) / span);
    const patch = 0.025 * Math.sin(x * 9.1 + channel(seed, 63) * TAU) * Math.sin((y + z) * 7.3 + channel(seed, 64) * TAU);
    const r = color.getX(index) * value * (1 + warm * edge * edge * 1.4 + patch);
    const g = color.getY(index) * value * (1 + warm * edge * edge * 0.4 + patch);
    const b = color.getZ(index) * value * (1 - warm * edge * edge * 0.6 + patch);
    color.setXYZ(index, r, g, b);
  }
  color.needsUpdate = true;
}
