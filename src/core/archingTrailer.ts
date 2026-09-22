import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, cloneVec3, distance, lerp, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { ARCHING_TRAILER_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const ARCHING_TRAILER_VERSION = "arching-trailer-v1" as const;

const TRAIL_SEGMENTS = 18;

/**
 * Equal arc-length samples of one authored rest cubic.
 * `makeChain`'s envelope peaks mid-stem and relaxes toward the original
 * direction at the tip, so it cannot hold a descending trail. This samples
 * the initial structure only. It is not a bend station, a physics step, or
 * a change to the shared solver.
 */
const sampleRestArc = (
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  segments: number,
): Vec3[] => {
  const denseCount = 480;
  const dense: Vec3[] = [];
  for (let index = 0; index <= denseCount; index += 1) {
    const t = index / denseCount;
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    const [p0, p1, p2, p3] = controls;
    dense.push(vec3(
      uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
      uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
      uu * u * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + tt * t * p3.z,
    ));
  }
  const cumulative = [0];
  for (let index = 1; index < dense.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(dense[index - 1], dense[index]));
  }
  const total = cumulative[cumulative.length - 1];
  const points = [cloneVec3(dense[0])];
  for (let segment = 1; segment <= segments; segment += 1) {
    const target = (total * segment) / segments;
    let index = 1;
    while (index < cumulative.length && cumulative[index] < target) index += 1;
    const span = cumulative[index] - cumulative[index - 1];
    const t = span <= 1e-8 ? 0 : (target - cumulative[index - 1]) / span;
    points.push(lerp(dense[index - 1], dense[index], t));
  }
  return points;
};

const rotateY = (point: Vec3, angle: number): Vec3 => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return vec3(
    point.x * cosine - point.z * sine,
    point.y,
    point.x * sine + point.z * cosine,
  );
};

/**
 * A slender cane whose rest pose already arches from a seated base, across
 * the open water, toward the bowl rim. Generic, not a species. Three small
 * leaves mark the descending limb. Randomness is consumed only during
 * construction. The shared aim/bend/prune laws still own every edit.
 */
export function createArchingTrailer(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: ARCHING_TRAILER_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:trail`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  const azimuth = (random.next() - 0.5) * 0.62;
  const reach = 2.28 + random.next() * 0.1;
  const crest = 0.74 + random.next() * 0.12;
  const tipDrop = 0.1 + random.next() * 0.06;
  const depth = (random.next() - 0.5) * 0.16;
  const controls = [
    vec3(0, 0, 0),
    vec3(hand * 0.055, 1.3, depth * 0.2),
    vec3(hand * 1.42, crest, depth),
    vec3(hand * reach, tipDrop, depth * 1.25),
  ].map((point) => add(base, rotateY(point, azimuth))) as [Vec3, Vec3, Vec3, Vec3];

  const trail = addBranch(graph, {
    id: graph.rootBranchId,
    label: "trailing cane",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: sampleRestArc(controls, TRAIL_SEGMENTS),
    radius: 0.031,
    stiffness: ARCHING_TRAILER_RESPONSE.cane,
  });

  for (let index = 0; index < 3; index += 1) {
    const fraction = 0.5 + index * 0.14 + (random.next() - 0.5) * 0.016;
    const parentDistance = trail.activeLength * fraction;
    const anchor = sampleBranch(trail, parentDistance);
    const spin = azimuth + index * Math.PI * 0.93 + (random.next() - 0.5) * 0.28;
    const side = basisFor(anchor.tangent, spin);
    // Sideways and slightly world-up, so the blade rides the cane instead of
    // continuing its descent into the water.
    const direction = normalize(add(
      add(scale(side, 0.72), scale(anchor.tangent, 0.16)),
      vec3(0, 0.55, 0),
    ));
    const stalk = addBranch(graph, {
      id: `${id}:petiole-${index + 1}`,
      label: "leaf stalk",
      kind: "petiole",
      parentId: trail.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        0.16 + random.next() * 0.04,
        3,
        direction,
        scale(anchor.tangent, -0.08),
      ),
      radius: 0.012,
      stiffness: ARCHING_TRAILER_RESPONSE.stalk,
    });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.4,
      scale: 0.42 + random.next() * 0.08,
      active: true,
    });
  }

  return graph;
}
