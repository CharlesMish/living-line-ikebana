import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, cloneVec3, distance, lerp, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { ARCHING_TRAILER_V2_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const ARCHING_TRAILER_V2_VERSION = "arching-trailer-v2" as const;

const TRAIL_SEGMENTS = 24;
const CANE_LEAVES = 8;

/** Equal arc-length samples of one authored rest cubic (construction only). */
const sampleRestArc = (controls: readonly [Vec3, Vec3, Vec3, Vec3], segments: number): Vec3[] => {
  const denseCount = 640;
  const dense: Vec3[] = [];
  const [p0, p1, p2, p3] = controls;
  for (let index = 0; index <= denseCount; index += 1) {
    const t = index / denseCount;
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    dense.push(vec3(
      a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      a * p0.y + b * p1.y + c * p2.y + d * p3.y,
      a * p0.z + b * p1.z + c * p2.z + d * p3.z,
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
  return vec3(point.x * cosine - point.z * sine, point.y, point.x * sine + point.z * cosine);
};

/**
 * A longer, leafier trailing cane. From a centered seat it rises, crests well
 * above the water, clears the rim and drapes past the bowl's edge. Eight
 * alternating narrow leaves diminish toward the tip, and two short side shoots
 * give separate pruning choices. Generic, not a species.
 *
 * Additive to `arching-trailer-v1`, whose output is unchanged. Randomness is
 * consumed only during construction; the shared aim/bend/prune laws own edits.
 */
export function createArchingTrailerV2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: ARCHING_TRAILER_V2_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:trail`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  const azimuth = (random.next() - 0.5) * 0.62;
  const reach = 3.0 + random.next() * 0.16;
  const crest = 1.95 + random.next() * 0.2;
  const tipDrop = -0.22 + random.next() * 0.08;
  const depth = (random.next() - 0.5) * 0.22;
  const controls = [
    vec3(0, 0, 0),
    vec3(hand * 0.05, 2.0, depth * 0.2),
    vec3(hand * 2.1, crest, depth),
    vec3(hand * reach, tipDrop, depth * 1.3),
  ].map((point) => add(base, rotateY(point, azimuth))) as [Vec3, Vec3, Vec3, Vec3];

  const trail = addBranch(graph, {
    id: graph.rootBranchId,
    label: "trailing cane",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: sampleRestArc(controls, TRAIL_SEGMENTS),
    radius: 0.036,
    stiffness: ARCHING_TRAILER_V2_RESPONSE.cane,
  });

  const addLeaf = (
    parentId: string,
    parentDistance: number,
    index: string,
    spin: number,
    size: number,
    droop: number,
  ) => {
    const parent = graph.branches.get(parentId)!;
    const anchor = sampleBranch(parent, parentDistance);
    const side = basisFor(anchor.tangent, spin);
    // Rising leaves ride the cane; leaves on the falling limb hang a little.
    const direction = normalize(add(
      add(scale(side, 0.7), scale(anchor.tangent, 0.3)),
      vec3(0, 0.42 - droop * 0.6, 0),
    ));
    const stalk = addBranch(graph, {
      id: `${id}:petiole-${index}`,
      label: "leaf stalk",
      kind: "petiole",
      parentId,
      parentDistance,
      points: makeChain(anchor.position, 0.15 + random.next() * 0.04, 3, direction, scale(anchor.tangent, -0.06)),
      radius: 0.012,
      stiffness: ARCHING_TRAILER_V2_RESPONSE.stalk,
    });
    const organId = `${id}:leaf-${index}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.4,
      scale: size,
      active: true,
    });
  };

  // Alternating leaves along the cane, smaller toward the tip.
  for (let index = 0; index < CANE_LEAVES; index += 1) {
    const t = index / (CANE_LEAVES - 1);
    const fraction = 0.3 + t * 0.66 + (random.next() - 0.5) * 0.02;
    const spin = azimuth + (index % 2 === 0 ? 0 : Math.PI) + (random.next() - 0.5) * 0.36;
    const size = 0.96 - t * 0.36 + random.next() * 0.08;
    addLeaf(trail.id, trail.activeLength * fraction, `${index + 1}`, spin, size, Math.max(0, t - 0.3));
  }

  // Two short side shoots on opposite flanks, each ending in a leaf pair.
  for (let index = 0; index < 2; index += 1) {
    const fraction = (index === 0 ? 0.42 : 0.62) + (random.next() - 0.5) * 0.03;
    const parentDistance = trail.activeLength * fraction;
    const anchor = sampleBranch(trail, parentDistance);
    const flank = basisFor(anchor.tangent, azimuth + Math.PI * 0.5 + index * Math.PI);
    const direction = normalize(add(add(scale(flank, 0.78), scale(anchor.tangent, 0.42)), vec3(0, -0.12, 0)));
    const shoot = addBranch(graph, {
      id: `${id}:shoot-${index + 1}`,
      label: "side shoot",
      kind: "lateral",
      parentId: trail.id,
      parentDistance,
      points: makeChain(anchor.position, 0.52 + random.next() * 0.14, 5, direction, vec3(0, -0.18, 0)),
      radius: 0.02,
      stiffness: ARCHING_TRAILER_V2_RESPONSE.shoot,
    });
    const spin = azimuth + index * Math.PI;
    addLeaf(shoot.id, shoot.activeLength * 0.55, `s${index + 1}-a`, spin, 0.72 + random.next() * 0.08, 0.2);
    addLeaf(shoot.id, shoot.activeLength * 0.97, `s${index + 1}-b`, spin + Math.PI, 0.62 + random.next() * 0.08, 0.3);
  }

  return graph;
}
