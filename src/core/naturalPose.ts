import { legalBendStation, reconstructFromDirections, sampleBranch } from "./arcLength.ts";
import { clonePlantGraph } from "./clone.ts";
import { applyAimRotation, applyBendRotation } from "./edit.ts";
import { cross, normalize, projectPerpendicular, quaternionFromAxisAngle, rotateVector, scale, subtract, type Vec3 } from "./math.ts";
import { Mulberry32 } from "./prng.ts";
import type { Branch, BranchKind, OrganKind, PlantGraph } from "./types.ts";

/**
 * A cutting's natural pose: the small irregularities a living stem has before
 * anyone touches it. Generators author each material's design; this adds a
 * seeded, per-cutting departure from that design: a slight sway in the stem,
 * side shoots that leave at not-quite-mirrored angles, stalks that hold their
 * leaves and flowers a little differently, and organs that roll and size
 * unevenly.
 *
 * It is built from the shared edit primitives, applied to the generator's
 * stock: a rigid Aim of a side branch about its own base, and the Bend
 * curvature law on stems that can bend. Short stalks (petiole, pedicel), which
 * play only aims, also take a slight fixed curve of the kind generators author
 * with a chain bend: the first segment keeps its direction, so the stalk still
 * leaves its parent as aimed. Topology, identities, rest lengths, organ
 * stations, radii and stiffness are exactly the generator's. Only branch
 * points, reference normals, and organ roll and size differ.
 *
 * Deterministic by graph id, seed and branch or organ id. It never reads a
 * clock or shared random state, so preview, commit and replay agree.
 */

export interface NaturalPoseProfile {
  /** Scales stem sway (Bend) on trunk, lateral and twig. */
  readonly sway: number;
  /** Scales how far side branches leave their authored angle (Aim). */
  readonly spread: number;
  /** Scales how far leaf and flower stalks leave their authored angle (Aim). */
  readonly stalk: number;
  /** Scales the slight curve of leaf and flower stalks. */
  readonly curve: number;
  /** Scales organ roll about the stalk. */
  readonly roll: number;
  /** Scales organ size variety. */
  readonly size: number;
}

const DEFAULT_PROFILE: NaturalPoseProfile = Object.freeze({ sway: 1, spread: 1, stalk: 1, curve: 1, roll: 1, size: 1 });

/**
 * Keyed by durable generator version. Hanging heads keep closer to plumb; a
 * few authored poses (a held round blade, a single culm) take less or more.
 */
const PROFILES: Readonly<Record<string, Partial<NaturalPoseProfile>>> = Object.freeze({
  "lantern-spray-v1": { stalk: 0.45, curve: 0.5 },
  "nodding-flower-v1": { stalk: 0.4, spread: 0.6, curve: 0.3 },
  "nodding-flower-v2": { stalk: 0.4, spread: 0.6, curve: 0.3 },
  "parasol-leaf-v1": { stalk: 0.7, roll: 0.5 },
  "reed-v1": { sway: 1.25 },
  "broad-blade-v1": { sway: 0.8 },
  "fern-frond-v1": { stalk: 1.4, roll: 0.8 },
  "fern-frond-v2": { stalk: 1.4, roll: 0.8 },
});

export function naturalPoseProfile(generatorVersion: string): NaturalPoseProfile {
  return { ...DEFAULT_PROFILE, ...PROFILES[generatorVersion] };
}

/** Largest Aim departure in radians at strength 1. */
const AIM_LIMIT: Readonly<Record<BranchKind, number>> = Object.freeze({
  trunk: 0, lateral: 0.11, twig: 0.13, petiole: 0.2, pedicel: 0.16,
});

/** Largest total turn of a stalk's tip from its base direction, in radians at strength 1. */
const STALK_CURVE_LIMIT = 0.42;

/** Largest roll about the stalk, in radians at strength 1. */
const ROLL_LIMIT: Readonly<Record<OrganKind, number>> = Object.freeze({
  leaf: 0.24, bloom: 0.3, bud: 0.3, berry: 0.5, seedpod: 0.26,
});

const SIZE_LIMIT = 0.07;

function hash(text: string, seed: number): number {
  let value = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

const signed = (random: Mulberry32) => random.next() * 2 - 1;

/** A uniformly distributed unit vector. */
function randomUnit(random: Mulberry32): Vec3 {
  const y = signed(random);
  const angle = random.next() * Math.PI * 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  return { x: ring * Math.cos(angle), y, z: ring * Math.sin(angle) };
}

/** A unit vector perpendicular to `tangent`, at a random angle around it. */
function randomPerpendicular(tangent: Vec3, random: Mulberry32): Vec3 {
  const helper = Math.abs(tangent.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize(cross(tangent, helper));
  const v = normalize(cross(tangent, u));
  const angle = random.next() * Math.PI * 2;
  return normalize({
    x: u.x * Math.cos(angle) + v.x * Math.sin(angle),
    y: u.y * Math.cos(angle) + v.y * Math.sin(angle),
    z: u.z * Math.cos(angle) + v.z * Math.sin(angle),
  });
}

/** Parents before children, in the generator's own sibling order. */
function parentFirst(graph: PlantGraph): Branch[] {
  const children = new Map<string, Branch[]>();
  for (const branch of graph.branches.values()) {
    if (!branch.parentId) continue;
    (children.get(branch.parentId) ?? children.set(branch.parentId, []).get(branch.parentId)!).push(branch);
  }
  const ordered: Branch[] = [];
  const root = graph.branches.get(graph.rootBranchId);
  const pending = root ? [root] : [];
  while (pending.length) {
    const branch = pending.shift()!;
    ordered.push(branch);
    pending.push(...(children.get(branch.id) ?? []));
  }
  return ordered;
}

/**
 * Returns the stock graph in its natural pose. `strength` scales every
 * departure together; 0 returns an unchanged copy of the stock.
 */
export function settleNaturalPose(stock: PlantGraph, strength = 1): PlantGraph {
  let graph = clonePlantGraph(stock);
  if (!(strength > 0) || !Number.isFinite(strength)) return graph;
  const profile = naturalPoseProfile(stock.generatorVersion);

  for (const { id } of parentFirst(stock)) {
    const random = new Mulberry32(hash(`pose:${id}`, stock.seed));
    const branch = graph.branches.get(id)!;
    if (!branch.active) continue;
    const stalk = branch.kind === "petiole" || branch.kind === "pedicel";

    if (branch.parentId) {
      const amount = AIM_LIMIT[branch.kind] * (stalk ? profile.stalk : profile.spread) * strength;
      const angle = amount * signed(random);
      const axis = randomUnit(random);
      if (Math.abs(angle) > 1e-6) graph = applyAimRotation(graph, id, quaternionFromAxisAngle(axis, angle));
    }

    // A stalk without side shoots curves a little along its length. The first
    // segment keeps its direction, so the frame it leaves its parent with holds.
    if (stalk && branch.restLengths.length >= 2 && ![...stock.branches.values()].some((child) => child.parentId === id)) {
      const current = graph.branches.get(id)!;
      const total = STALK_CURVE_LIMIT * profile.curve * strength * (0.25 + 0.75 * random.next());
      const first = normalize(subtract(current.points[1], current.points[0]));
      const axis = randomPerpendicular(first, random);
      const last = current.restLengths.length - 1;
      const directions = current.restLengths.map((_, index) => {
        const direction = normalize(subtract(current.points[index + 1], current.points[index]));
        return rotateVector(direction, quaternionFromAxisAngle(axis, total * (index / last)));
      });
      current.points = reconstructFromDirections(current.points[0], directions, current.restLengths);
    }

    // Two broad bends, the upper one usually answering the lower: a sway, not an arc.
    const flex = 1 - branch.stiffness;
    const reach = (0.06 + 0.24 * flex) * profile.sway * strength;
    const stations = [0.38 + 0.3 * random.next(), 0.72 + 0.18 * random.next()];
    let firstAxis: Vec3 | null = null;
    for (let index = 0; index < stations.length; index += 1) {
      const current = graph.branches.get(id)!;
      const station = legalBendStation(current, current.activeLength * stations[index]);
      const magnitude = reach * (0.45 + 0.55 * random.next()) * (index === 0 ? 1 : 0.7);
      if (station === null) continue;
      const sample = sampleBranch(current, station);
      let axis = randomPerpendicular(sample.tangent, random);
      if (firstAxis && index === 1) {
        // Lean the second bend back against the first, with some freedom left.
        axis = normalize(projectPerpendicular({
          x: -firstAxis.x * 0.7 + axis.x * 0.6,
          y: -firstAxis.y * 0.7 + axis.y * 0.6,
          z: -firstAxis.z * 0.7 + axis.z * 0.6,
        }, sample.tangent), axis);
      }
      firstAxis ??= axis;
      graph = applyBendRotation(graph, { branchId: id, stationDistance: station, target: sample.position }, scale(axis, magnitude));
    }
  }

  for (const organ of graph.organs.values()) {
    const random = new Mulberry32(hash(`pose:${organ.id}`, stock.seed));
    organ.spin += ROLL_LIMIT[organ.kind] * profile.roll * strength * signed(random);
    organ.scale *= 1 + SIZE_LIMIT * profile.size * strength * signed(random);
  }
  return graph;
}
