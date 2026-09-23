import * as THREE from "three";

/**
 * Presentation-only botanical surfaces for versioned material organs.
 *
 * Integration:
 * - Call once when creating an organ, with botanicalSeed(organ.id, graph.seed).
 * - Preserve the organ Group's material frame, spin, scale and hit proxy.
 * - Leaf: use the geometry directly, without the old sphere scale/y offset.
 *   `elliptic` and `lanceolate` stay the creased blade. `pinnate` is a costa
 *   plus separate pinnules, used by `fern-frond-v1`.
 *   Foliage polish is presentation-only. `pinnate` draw `tapered` is the
 *   accepted frond; `baseline` keeps the earlier comb and `quilled` is the
 *   four-pair alternative. `foliage-fan-v1` may pass fan profile `spray`
 *   (accepted), `separated`, or `shared` (the original elliptic). Other
 *   materials stay on `shared`. Query `pinnate` and `fanLeaf` select a draw
 *   for comparison. Neither changes a canonical graph.
 * - Petal: use directly, without the old sphere scale/radial offset; retain each
 *   petal's rotation.z = index * 2 PI / petalCount. Salt the seed by petal index.
 *   `cupped` keeps the flowering seven-petal cup; `open-face` is a shallower
 *   five-petal dish whose local +Z follows the supporting material frame.
 *   `tufted` is a shorter, rounder eight-petal cup for a flower-volume head.
 *   `bell` is one shell whose mouth continues local +Y, the supporting tangent.
 *   One bloom remains one organ; tufted petals may share a mesh inside that organ.
 *   A berry is a separate organ kind: one low-poly sphere, not a petal form.
 * - Cupped, open-face, and tufted surfaces face local +Z. The bell opens along
 *   local +Y so a downward neck presents the mouth. All require a DoubleSide
 *   material. Color values
 *   are restrained linear RGB multipliers; enable material.vertexColors.
 * - Calyx and leaf veins are optional subordinate detail, using their own green
 *   material. Keep those materials in bodyMaterials for prune/ghost opacity.
 * - Geometry has no graph, activeLength, camera, DOM or time dependencies. Never
 *   rebuild a leaf/petal seed from graph iteration order or the active inventory.
 * - Returned geometries are owned by the caller. Do not share them between
 *   independently disposed organ groups without a reference-counted cache.
 *
 * QA: compare a fixed organ's position/normal/color arrays across rebuild,
 * bend, pruning a different branch, and WebGL recovery. Check both faces, a
 * grazing-angle leaf and both bloom forms at phone size. Bounds stay close
 * to the old silhouettes; aesthetic detail must not change acquisition laws.
 */

const TAU = Math.PI * 2;

/** FNV-1a identity hash: the same organ and graph seed always have the same skin. */
export function botanicalSeed(organId: string, graphSeed = 0): number {
  let hash = (2166136261 ^ graphSeed) >>> 0;
  for (let index = 0; index < organId.length; index += 1) {
    hash = Math.imul(hash ^ organId.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

/** Independent channels avoid a sequential RNG coupling unrelated details. */
function variation(seed: number, channel: number): number {
  let value = (seed ^ Math.imul(channel + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

interface SurfaceSample {
  position: readonly [number, number, number];
  color: readonly [number, number, number];
}

/** A single tip at either end avoids collapsed-row/zero-area triangles. */
function bladeSurface(
  name: string,
  sample: (t: number, across: number) => SurfaceSample,
  rows = 14,
  columns = 8,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const add = (t: number, across: number) => {
    const value = sample(t, across);
    positions.push(...value.position);
    colors.push(...value.color);
    uvs.push((across + 1) / 2, t);
  };

  add(0, 0);
  for (let row = 1; row < rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      add(row / rows, (column / columns) * 2 - 1);
    }
  }
  const end = positions.length / 3;
  add(1, 0);

  for (let column = 0; column < columns; column += 1) {
    indices.push(0, 2 + column, 1 + column);
  }
  for (let row = 0; row < rows - 2; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = 1 + row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      indices.push(a, b, c, b, c + 1, c);
    }
  }
  const lastRow = 1 + (rows - 2) * (columns + 1);
  for (let column = 0; column < columns; column += 1) {
    indices.push(lastRow + column, lastRow + column + 1, end);
  }

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

export type LeafForm = "elliptic" | "lanceolate" | "pinnate";
export type BloomForm = "cupped" | "open-face" | "tufted" | "bell";

/** Parallel pinna draws. `baseline` is the comb this polish started from. */
export type PinnateDraw = "baseline" | "tapered" | "quilled";
/** Parallel elliptic draws for foliage-fan only. `shared` is every other elliptic leaf. */
export type FanLeafDraw = "shared" | "spray" | "separated";

export interface LeafDrawOptions {
  readonly pinnate?: PinnateDraw;
  readonly fanLeaf?: FanLeafDraw;
}

/** Shipped frond draw when the caller does not pass an override. */
export const ACCEPTED_PINNATE_DRAW: PinnateDraw = "tapered";

/** Rebuildable bloom parts. Cupped and open-face numbers match the prior path. */
export interface BloomSurfaceProfile {
  readonly petalCount: number;
  readonly centerRadius: number;
  readonly centerScaleZ: number;
  readonly centerZ: number;
  readonly centerColor: number;
  readonly antherRadius: number;
  readonly antherRing: number;
  readonly antherZ: number;
  readonly antherCount: number;
}

export function bloomSurfaceProfile(form: BloomForm): BloomSurfaceProfile {
  if (form === "bell") {
    throw new Error("bell is one volume along the supporting tangent, not a radial petal profile");
  }
  if (form === "open-face") {
    return {
      petalCount: 5, centerRadius: 0.11, centerScaleZ: 0.36, centerZ: 0.042, centerColor: 0xc49a58,
      antherRadius: 0.022, antherRing: 0.155, antherZ: 0.05, antherCount: 12,
    };
  }
  if (form === "tufted") {
    return {
      petalCount: 8, centerRadius: 0.06, centerScaleZ: 0.72, centerZ: 0.07, centerColor: 0x7a3e56,
      antherRadius: 0.012, antherRing: 0.055, antherZ: 0.1, antherCount: 8,
    };
  }
  return {
    petalCount: 7, centerRadius: 0.09, centerScaleZ: 0.52, centerZ: 0.07, centerColor: 0xb68840,
    antherRadius: 0.019, antherRing: 0.105, antherZ: 0.085, antherCount: 12,
  };
}

export function bloomPetalCount(form: BloomForm): number {
  return bloomSurfaceProfile(form).petalCount;
}

function leafSample(
  seed: number,
  t: number,
  across: number,
  form: "elliptic" | "lanceolate",
): SurfaceSample {
  const envelope = Math.sin(Math.PI * t);
  const lean = (variation(seed, 0) - 0.5) * 0.027;
  const uneven = (variation(seed, 1) - 0.5) * 0.13;
  const wave = variation(seed, 2) * TAU;
  const width = 0.156 * Math.pow(Math.max(0, envelope), 0.87)
    * (1 + across * uneven) * (1 - 0.19 * (t - 0.4));
  const x = width * across + lean * envelope;
  const y = -0.115 + 0.724 * t;
  const edgeRipple = 0.0045 * Math.sin(t * Math.PI * 5 + wave)
    * Math.pow(Math.abs(across), 3) * envelope;
  const z = 0.028 * envelope - 0.043 * Math.abs(across) * envelope
    - 0.027 * t * t * t + edgeRipple
    + (variation(seed, 3) - 0.5) * 0.026 * across * envelope;
  const ridge = Math.pow(1 - Math.abs(across), 6);
  const edge = Math.pow(Math.abs(across), 3);
  const value = 0.82 + ridge * 0.15 - edge * 0.06 + t * 0.055;
  return {
    position: form === "lanceolate"
      ? [x * 0.94 * (1.12 - 0.28 * t), (y + 0.115) * 1.38, z * 1.35 - 0.035 * t * t]
      : [x, y, z],
    color: [value * 0.95, Math.min(1, value * 1.035), value * 0.90],
  };
}

/**
 * Divided pinna. Local Y is the pinna midrib. The gaps are missing triangles,
 * not a texture. One organ, one mesh. Elliptic and lanceolate blades are unchanged.
 * `baseline` is the original three-pair comb. `tapered` and `quilled` keep that
 * envelope and only change the leaflet draw.
 */
const PINNATE_LENGTH = 1.12;
const PINNATE_COSTA_HALF = 0.016;

interface PinnuleLobe {
  readonly t: number;
  readonly reach: number;
  readonly span: number;
  readonly lean: number;
}

const TAPERED_LOBES: readonly PinnuleLobe[] = [
  { t: 0.17, reach: 0.26, span: 0.07, lean: 0.14 },
  { t: 0.5, reach: 0.48, span: 0.064, lean: 0.2 },
  { t: 0.78, reach: 0.18, span: 0.03, lean: 0.38 },
];

const QUILLED_LOBES: readonly PinnuleLobe[] = [
  { t: 0.15, reach: 0.26, span: 0.042, lean: 0.26 },
  { t: 0.36, reach: 0.36, span: 0.048, lean: 0.2 },
  { t: 0.56, reach: 0.32, span: 0.042, lean: 0.22 },
  { t: 0.77, reach: 0.18, span: 0.03, lean: 0.34 },
];

function pinnateCostaZ(t: number): number {
  return 0.04 * t - 0.06 * t * t;
}

function polishedCostaFrame(t: number, seed: number) {
  const clamped = Math.min(1, Math.max(0, t));
  // A tip hook, not a mid-pinna bow: the notch test watches local X near the middle.
  const hook = (variation(seed, 4) - 0.5) * 0.07;
  const x = hook * clamped * clamped;
  const y = PINNATE_LENGTH * clamped;
  const wave = variation(seed, 5) * TAU;
  const z = 0.03 * clamped - 0.055 * clamped * clamped
    + 0.018 * Math.sin(clamped * Math.PI * 1.5 + wave);
  const dx = hook * 2 * clamped;
  const dy = PINNATE_LENGTH;
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, z, tx: dx / length, ty: dy / length };
}

function createPinnatePinnaBaseline(seed = 0): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    rgb: readonly [number, number, number],
    u: number,
    v: number,
  ) => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    colors.push(rgb[0], rgb[1], rgb[2]);
    uvs.push(u, v);
    return index;
  };

  const costaRows = 12;
  const costaIds: number[] = [];
  for (let row = 0; row <= costaRows; row += 1) {
    const t = row / costaRows;
    const y = PINNATE_LENGTH * t;
    const z = pinnateCostaZ(t);
    const tone = 0.7 + 0.12 * t;
    costaIds.push(
      add(-PINNATE_COSTA_HALF, y, z, [tone * 0.86, tone * 0.98, tone * 0.78], 0.48, t),
      add(PINNATE_COSTA_HALF, y, z + 0.0015, [tone * 0.86, tone * 0.98, tone * 0.78], 0.52, t),
    );
  }
  for (let row = 0; row < costaRows; row += 1) {
    const a = costaIds[row * 2]!;
    const b = costaIds[row * 2 + 1]!;
    const c = costaIds[(row + 1) * 2]!;
    const d = costaIds[(row + 1) * 2 + 1]!;
    indices.push(a, c, b, b, c, d);
  }

  const lobeCount = 3;
  const alongSteps = 6;
  const acrossSteps = 4;
  for (let lobe = 0; lobe < lobeCount; lobe += 1) {
    const outline = Math.sin((Math.PI * (lobe + 1)) / (lobeCount + 1));
    const reach = 0.46 * (0.62 + 0.38 * outline);
    const yCenter = PINNATE_LENGTH * (0.22 + lobe * 0.28);
    const halfSpan = 0.1 * (0.78 + 0.22 * outline);
    for (const side of [-1, 1] as const) {
      const channel = 20 + lobe * 3 + (side > 0 ? 1 : 0);
      const reachJitter = 1 + (variation(seed, channel) - 0.5) * 0.08;
      const lift = (variation(seed, channel + 1) - 0.5) * 0.012;
      const ids: number[][] = [];
      for (let step = 0; step <= alongSteps; step += 1) {
        const u = step / alongSteps;
        const row: number[] = [];
        const belly = Math.sin(Math.PI * u);
        const attach = u < 0.08 ? u / 0.08 : 1;
        const span = halfSpan * (0.35 + 0.65 * Math.pow(belly, 0.75)) * attach;
        for (let across = 0; across <= acrossSteps; across += 1) {
          const v = across / acrossSteps;
          const signed = v * 2 - 1;
          const x = side * (PINNATE_COSTA_HALF * 0.4 + u * reach * reachJitter);
          const y = yCenter + signed * span;
          const along = Math.min(1, Math.max(0, y / PINNATE_LENGTH));
          const z = pinnateCostaZ(along) + 0.028 * u * belly - 0.04 * u * u + lift + signed * side * 0.008 * u;
          const light = 0.78 + 0.16 * u + 0.06 * belly - 0.05 * Math.abs(signed);
          row.push(add(
            x,
            y,
            z,
            [Math.min(1, light * 0.9), Math.min(1, light * 1.05), light * 0.84],
            0.5 + side * u * 0.5,
            along,
          ));
        }
        ids.push(row);
      }
      for (let step = 0; step < alongSteps; step += 1) {
        for (let across = 0; across < acrossSteps; across += 1) {
          const a = ids[step]![across]!;
          const b = ids[step]![across + 1]!;
          const c = ids[step + 1]![across]!;
          const d = ids[step + 1]![across + 1]!;
          if (side > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/pinnate-pinna";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPolishedPinna(seed: number, lobes: readonly PinnuleLobe[], curl: number, vary: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    rgb: readonly [number, number, number],
    u: number,
    v: number,
  ) => {
    const index = positions.length / 3;
    positions.push(x, y, z);
    colors.push(rgb[0], rgb[1], rgb[2]);
    uvs.push(u, v);
    return index;
  };

  const costaRows = 12;
  const costaIds: number[] = [];
  for (let row = 0; row <= costaRows; row += 1) {
    const t = row / costaRows;
    const frame = polishedCostaFrame(t, seed);
    const half = PINNATE_COSTA_HALF * (1.05 - 0.55 * t);
    const tone = 0.62 + 0.16 * t;
    const px = frame.ty;
    const py = -frame.tx;
    costaIds.push(
      add(frame.x - px * half, frame.y - py * half, frame.z, [tone * 0.78, tone * 0.95, tone * 0.7], 0.48, t),
      add(frame.x + px * half, frame.y + py * half, frame.z + 0.0015, [tone * 0.78, tone * 0.95, tone * 0.7], 0.52, t),
    );
  }
  for (let row = 0; row < costaRows; row += 1) {
    const a = costaIds[row * 2]!;
    const b = costaIds[row * 2 + 1]!;
    const c = costaIds[(row + 1) * 2]!;
    const d = costaIds[(row + 1) * 2 + 1]!;
    indices.push(a, c, b, b, c, d);
  }

  const alongSteps = 6;
  const acrossSteps = 4;
  for (let lobe = 0; lobe < lobes.length; lobe += 1) {
    const spec = lobes[lobe]!;
    for (const side of [-1, 1] as const) {
      const channel = 20 + lobe * 4 + (side > 0 ? 1 : 0);
      const reachScale = 1 + (variation(seed, channel) - 0.5) * vary;
      const lean = spec.lean + (variation(seed, channel + 1) - 0.5) * vary * 0.45;
      const lift = (variation(seed, channel + 2) - 0.5) * 0.012;
      const stagger = side * (variation(seed, channel + 3) - 0.5) * vary * 0.08;
      const frame = polishedCostaFrame(spec.t + stagger, seed);
      const px = side * frame.ty;
      const py = side * -frame.tx;
      const cosine = Math.cos(lean);
      const sine = Math.sin(lean);
      const axisX = px * cosine + frame.tx * sine;
      const axisY = py * cosine + frame.ty * sine;
      const wingX = px * -sine + frame.tx * cosine;
      const wingY = py * -sine + frame.ty * cosine;
      const ids: number[][] = [];
      for (let step = 0; step <= alongSteps; step += 1) {
        const u = step / alongSteps;
        const row: number[] = [];
        const belly = Math.sin(Math.PI * u);
        const neck = u < 0.14 ? u / 0.14 : 1;
        const point = Math.pow(Math.max(0, belly), 0.7) * (1 - 0.42 * u);
        const span = spec.span * point * neck;
        for (let across = 0; across <= acrossSteps; across += 1) {
          const v = across / acrossSteps;
          const signed = v * 2 - 1;
          const along = u * spec.reach * reachScale;
          const wing = signed * span;
          const x = frame.x + axisX * along + wingX * wing;
          const y = frame.y + axisY * along + wingY * wing;
          const z = frame.z
            + curl * (0.02 * u * u * belly - 0.028 * u * u)
            + lift
            + signed * 0.008 * u * curl;
          const light = 0.7 + 0.2 * u + 0.08 * belly - 0.1 * Math.abs(signed);
          row.push(add(
            x,
            y,
            z,
            [Math.min(1, light * 0.84), Math.min(1, light * 1.04), light * 0.76],
            0.5 + side * u * 0.5,
            Math.min(1, Math.max(0, y / PINNATE_LENGTH)),
          ));
        }
        ids.push(row);
      }
      for (let step = 0; step < alongSteps; step += 1) {
        for (let across = 0; across < acrossSteps; across += 1) {
          const a = ids[step]![across]!;
          const b = ids[step]![across + 1]!;
          const c = ids[step + 1]![across]!;
          const d = ids[step + 1]![across + 1]!;
          if (side > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/pinnate-pinna";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPinnatePinnaGeometry(seed = 0, draw: PinnateDraw = ACCEPTED_PINNATE_DRAW): THREE.BufferGeometry {
  if (draw === "baseline") return createPinnatePinnaBaseline(seed);
  if (draw === "quilled") return createPolishedPinna(seed, QUILLED_LOBES, 1.35, 0.1);
  return createPolishedPinna(seed, TAPERED_LOBES, 0.85, 0.24);
}

function createPinnateCostaBaseline(seed = 0): THREE.BufferGeometry {
  return bladeSurface("living-line/pinnate-costa", (t, across) => {
    const y = PINNATE_LENGTH * (0.02 + t * 0.96);
    const width = 0.0032 * Math.sin(Math.PI * t);
    const z = pinnateCostaZ(y / PINNATE_LENGTH) + 0.0024 + (variation(seed, 8) - 0.5) * 0.0008;
    return {
      position: [across * width, y, z],
      color: [0.86, 0.95, 0.74],
    };
  }, 12, 2);
}

function createPinnateCostaGeometry(seed = 0, draw: PinnateDraw = ACCEPTED_PINNATE_DRAW): THREE.BufferGeometry {
  if (draw === "baseline") return createPinnateCostaBaseline(seed);
  return bladeSurface("living-line/pinnate-costa", (t, across) => {
    const along = 0.02 + t * 0.96;
    const frame = polishedCostaFrame(along, seed);
    const width = 0.0034 * Math.sin(Math.PI * t) * (1.2 - 0.7 * along);
    const px = frame.ty;
    const py = -frame.tx;
    return {
      position: [frame.x + px * across * width, frame.y + py * across * width, frame.z + 0.003],
      color: [0.8, 0.93, 0.68],
    };
  }, 12, 2);
}

function fanLeafSample(
  seed: number,
  t: number,
  across: number,
  profile: Exclude<FanLeafDraw, "shared">,
): SurfaceSample {
  const envelope = Math.sin(Math.PI * t);
  const spray = profile === "spray";
  const lean = (variation(seed, 0) - 0.5) * (spray ? 0.04 : 0.06);
  const uneven = (variation(seed, 1) - 0.5) * (spray ? 0.16 : 0.22);
  const wave = variation(seed, 2) * TAU;
  const width = (spray ? 0.21 : 0.172) * Math.pow(Math.max(0, envelope), spray ? 0.92 : 1.08)
    * (1 + across * uneven) * (1 - (spray ? 0.3 : 0.4) * Math.max(0, t - 0.4));
  const x = width * across + lean * envelope;
  const y = -0.115 + 0.724 * t;
  const twist = (variation(seed, 3) - 0.5) * (spray ? 0.045 : 0.09);
  const z = (spray ? 0.044 : 0.036) * envelope
    - (spray ? 0.058 : 0.072) * Math.abs(across) * envelope
    - 0.018 * t * t * t
    + twist * t * across
    + 0.0035 * Math.sin(t * Math.PI * 3 + wave) * Math.pow(Math.abs(across), 2) * envelope;
  const ridge = Math.pow(1 - Math.abs(across), 5);
  const edge = Math.pow(Math.abs(across), 2.2);
  const value = 0.72 + ridge * 0.24 - edge * 0.12 + t * 0.035;
  return {
    position: [x, y, z],
    color: [value * 0.9, Math.min(1, value * 1.06), value * 0.8],
  };
}

function resolvedPinnate(draw?: LeafDrawOptions): PinnateDraw {
  return draw?.pinnate ?? ACCEPTED_PINNATE_DRAW;
}

function resolvedFanLeaf(form: LeafForm, draw?: LeafDrawOptions): FanLeafDraw {
  if (form !== "elliptic") return "shared";
  return draw?.fanLeaf ?? "shared";
}

/** 119 vertices, 208 triangles for elliptic and lanceolate. Local Y follows the leaf's long axis.
 * A pinnate pinna is a separate costa-and-pinnule mesh and does not reuse those counts.
 * Fan profiles reuse the elliptic grid so foliage-fan draw cost stays on the same mesh.
 */
export function createLeafGeometry(seed = 0, form: LeafForm = "elliptic", draw?: LeafDrawOptions): THREE.BufferGeometry {
  if (form === "pinnate") return createPinnatePinnaGeometry(seed, resolvedPinnate(draw));
  const profile = resolvedFanLeaf(form, draw);
  if (profile === "shared") {
    return bladeSurface("living-line/creased-leaf", (t, u) => leafSample(seed, t, u, form));
  }
  return bladeSurface("living-line/creased-leaf", (t, u) => fanLeafSample(seed, t, u, profile));
}

/**
 * Raised midrib as one tiny tapered ribbon; opt in when close-up reading needs
 * it. At its widest it is 0.0056 units, so it remains a vein rather than a stripe.
 */
export function createLeafVeinGeometry(seed = 0, form: LeafForm = "elliptic", draw?: LeafDrawOptions): THREE.BufferGeometry {
  if (form === "pinnate") return createPinnateCostaGeometry(seed, resolvedPinnate(draw));
  const profile = resolvedFanLeaf(form, draw);
  return bladeSurface("living-line/leaf-midrib", (t, across) => {
    const along = 0.025 + t * 0.94;
    const sample = profile === "shared"
      ? leafSample(seed, along, 0, form)
      : fanLeafSample(seed, along, 0, profile);
    const width = 0.0028 * Math.sin(Math.PI * t) * (1 - t * 0.55);
    return {
      position: [sample.position[0] + across * width, sample.position[1], sample.position[2] + 0.0016],
      color: [0.88, 0.95, 0.75],
    };
  }, 12, 2);
}

/**
 * 119 vertices, 208 triangles. Long axis is local +X, extending from the flower
 * center to radius ~0.555. Rotate in Z for each of the existing seven petals.
 * The center stays behind the raised outer rim, making a shallow open cup.
 */
export function createPetalGeometry(seed = 0): THREE.BufferGeometry {
  // bladeSurface expects across to be +X and length +Y for +Z winding.
  // Mapping across to -Y and length to +X preserves that winding.
  return bladeSurface("living-line/cupped-petal", (t, across) => {
    const envelope = Math.sin(Math.PI * t);
    const width = 0.17 * Math.pow(Math.max(0, envelope), 0.66)
      * (0.67 + 0.37 * t) * (1 + across * (variation(seed, 4) - 0.5) * 0.10);
    const x = 0.025 + t * (0.527 + (variation(seed, 5) - 0.5) * 0.018);
    const y = -across * width + (variation(seed, 6) - 0.5) * 0.026 * envelope;
    const z = 0.004 + 0.096 * t * t + 0.043 * across * across * envelope
      + 0.005 * Math.sin(t * Math.PI * 4 + variation(seed, 7) * TAU)
        * Math.pow(Math.abs(across), 3) * envelope
      - 0.017 * Math.pow(t, 7);
    // A warmer/darker throat and quieter light edge, modulated by surface form.
    const value = 0.76 + 0.21 * Math.sqrt(t) + 0.027 * across * across;
    return {
      position: [x, y, z],
      color: [Math.min(1, value * 1.02), value * (0.88 + 0.10 * t), value * (0.91 + 0.07 * t)],
    };
  });
}

/**
 * Shallower, broader petal for a readable single flower face. Local +Z remains
 * the supporting-frame normal; this is not a camera billboard or a rigid card.
 */
export function createOpenFacePetalGeometry(seed = 0): THREE.BufferGeometry {
  return bladeSurface("living-line/open-face-petal", (t, across) => {
    const envelope = Math.sin(Math.PI * t);
    const width = 0.24 * Math.pow(Math.max(0, envelope), 0.58)
      * (0.72 + 0.4 * t) * (1 + across * (variation(seed, 4) - 0.5) * 0.08);
    const x = 0.02 + t * (0.62 + (variation(seed, 5) - 0.5) * 0.016);
    const y = -across * width + (variation(seed, 6) - 0.5) * 0.02 * envelope;
    const z = 0.006 + 0.036 * t * t + 0.02 * across * across * envelope
      + 0.004 * Math.sin(t * Math.PI * 3.2 + variation(seed, 7) * TAU)
        * Math.pow(Math.abs(across), 2) * envelope
      - 0.01 * Math.pow(t, 5);
    const throat = 1 - Math.sqrt(t);
    const value = 0.78 + 0.2 * Math.sqrt(t) + 0.03 * across * across;
    return {
      position: [x, y, z],
      color: [
        Math.min(1, value * (1.04 - throat * 0.08)),
        value * (0.9 + 0.08 * t),
        value * (0.82 + 0.1 * t),
      ],
    };
  });
}

/**
 * Short rounded petal. Eight of these cup into one tuft. The tuft is still one
 * organ on one supporting branch; it is not a merged multi-branch mesh.
 */
export function createTuftedPetalGeometry(seed = 0): THREE.BufferGeometry {
  return bladeSurface("living-line/tufted-petal", (t, across) => {
    const envelope = Math.sin(Math.PI * t);
    const width = 0.2 * Math.pow(Math.max(0, envelope), 0.62)
      * (0.7 + 0.48 * t) * (1 + across * (variation(seed, 4) - 0.5) * 0.05);
    const x = 0.012 + t * (0.4 + (variation(seed, 5) - 0.5) * 0.012);
    const y = -across * width + (variation(seed, 6) - 0.5) * 0.012 * envelope;
    // Retain the tuft's domed mass, with a small raised-rim contribution to
    // soften its deepest folds. A fully open cup would turn the head into
    // overlapping discs rather than the existing rounded flower groups.
    const crown = Math.sin(Math.PI * Math.min(1, t * 1.05));
    const rimRise = Math.sin(Math.PI * 0.72 * t);
    const z = 0.016 + 0.168 * crown * (1 - 0.22 * t)
      + 0.0345 * rimRise + 0.0087 * t * t + 0.041 * across * across * envelope
      + 0.003 * Math.sin(t * Math.PI * 3 + variation(seed, 7) * TAU)
        * Math.pow(Math.abs(across), 2) * (0.7 + 0.3 * envelope);
    const value = 0.72 + 0.24 * Math.sqrt(t) + 0.02 * across * across;
    return {
      position: [x, y, z],
      color: [Math.min(1, value * 1.05), value * (0.8 + 0.1 * t), value * (0.9 + 0.05 * t)],
    };
  }, 10, 6);
}

export function createBloomPetalGeometry(seed = 0, form: BloomForm = "cupped"): THREE.BufferGeometry {
  if (form === "bell") {
    throw new Error("bell is one volume along the supporting tangent, not a radial petal");
  }
  if (form === "open-face") return createOpenFacePetalGeometry(seed);
  if (form === "tufted") return createTuftedPetalGeometry(seed);
  return createPetalGeometry(seed);
}

/**
 * One bell shell. Local +Y continues the supporting tangent, so the mouth
 * follows the neck instead of opening perpendicular to it. The back sits at
 * the attachment. Existing cupped, open-face, and tufted petals are untouched.
 */
export function createBellGeometry(seed = 0): THREE.BufferGeometry {
  const rings = 14;
  const columns = 32;
  const phase = variation(seed, 11) * TAU;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const push = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    colors.push(shade * 0.9, shade * 0.95, Math.min(1, shade * 1.04));
    return positions.length / 3 - 1;
  };
  const profile = (t: number, theta: number) => {
    const lobe = Math.cos(theta * 5 + phase);
    const swell = Math.sin(Math.min(1, t * 0.98) * Math.PI * 0.5);
    const flare = t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) * 0.07 : 0;
    const radius = (0.034 + 0.36 * swell + flare) * (1 + 0.045 * lobe * t * t);
    const y = t * 0.6 + 0.012 * lobe * t * t;
    return { radius, y };
  };

  const outer: number[][] = [];
  const inner: number[][] = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    outer[ring] = [];
    inner[ring] = [];
    for (let column = 0; column < columns; column += 1) {
      const theta = (column / columns) * TAU;
      const { radius, y } = profile(t, theta);
      const cosine = Math.cos(theta);
      const sine = Math.sin(theta);
      const shade = 0.42 + 0.58 * Math.pow(t, 0.85);
      outer[ring][column] = push(cosine * radius, y, sine * radius, shade);
      const innerRadius = Math.max(0.01, radius - 0.018);
      inner[ring][column] = push(cosine * innerRadius, y + 0.004, sine * innerRadius, shade * 0.62);
    }
  }

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };
  for (let ring = 0; ring < rings; ring += 1) {
    for (let column = 0; column < columns; column += 1) {
      const next = (column + 1) % columns;
      quad(outer[ring][column], outer[ring + 1][column], outer[ring + 1][next], outer[ring][next]);
      quad(inner[ring][column], inner[ring][next], inner[ring + 1][next], inner[ring + 1][column]);
    }
  }
  for (let column = 0; column < columns; column += 1) {
    const next = (column + 1) % columns;
    quad(outer[rings][column], outer[rings][next], inner[rings][next], inner[rings][column]);
  }
  const back = push(0, 0, 0, 0.36);
  for (let column = 0; column < columns; column += 1) {
    const next = (column + 1) % columns;
    indices.push(back, outer[0][next], outer[0][column]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/bell";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * One fruit. Local +Y continues the supporting tangent. An 8×6 sphere is 96
 * triangles. Cupped, open-face, tufted, and bell surfaces are untouched.
 */
export function createBerryGeometry(seed = 0, radius = 0.07): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius, 8, 6);
  geometry.name = "living-line/berry";
  const positions = geometry.getAttribute("position");
  const squash = 0.9 + variation(seed, 8) * 0.08;
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index) * squash;
    positions.setY(index, y);
    const cheek = 0.42 + 0.5 * ((y / radius) * 0.5 + 0.5);
    colors[index * 3] = Math.min(1, cheek * 1.05);
    colors[index * 3 + 1] = cheek * 0.62;
    colors[index * 3 + 2] = cheek * 0.7;
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Small pointed green sepals behind the bloom; one geometry for one draw call. */
export function createCalyxGeometry(seed = 0, form: BloomForm = "cupped"): THREE.BufferGeometry {
  const sepalCount = bloomPetalCount(form);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let sepal = 0; sepal < sepalCount; sepal += 1) {
    const angle = (sepal + 0.5) * TAU / sepalCount;
    const geometry = bladeSurface("sepal", (t, across) => {
      const width = 0.044 * Math.sin(Math.PI * t) * (1 - t * 0.4);
      const reach = form === "tufted" ? 0.11 : 0.23;
      const jitter = form === "tufted" ? 0.006 : 0.014;
      const x = 0.014 + t * (reach + variation(seed, sepal + 10) * jitter);
      const y = -across * width;
      return {
        position: [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), -0.032 + 0.009 * t - 0.012 * across * across],
        color: [0.83 + t * 0.08, 0.94, 0.78],
      };
    }, 6, 4);
    const offset = positions.length / 3;
    positions.push(...Array.from(geometry.getAttribute("position").array));
    normals.push(...Array.from(geometry.getAttribute("normal").array));
    colors.push(...Array.from(geometry.getAttribute("color").array));
    indices.push(...Array.from(geometry.index!.array, (index) => index + offset));
    geometry.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.name = "living-line/calyx";
  result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  result.setIndex(indices);
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
