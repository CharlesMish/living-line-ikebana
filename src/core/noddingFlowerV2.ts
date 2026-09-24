import { sampleBranch } from "./arcLength.ts";
import { addBranch, makeChain } from "./generatorSupport.ts";
import { add, cloneVec3, distance, lerp, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { NODDING_FLOWER_V2_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const NODDING_FLOWER_V2_VERSION = "nodding-flower-v2" as const;

const NECK_SEGMENTS = 9;

/**
 * Equal arc-length samples of one authored rest cubic.
 * `makeChain` relaxes toward its starting direction, so it cannot hold a neck
 * that arrives pointing downward. This samples the initial structure only.
 * It is not a bend station, a physics step, or a change to the shared solver.
 */
const sampleAuthoredArc = (
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

/**
 * One bell on a continuous, two-section flowering stem and a short terminal
 * pedicel. The upper stem is a manipulable continuation (graph kind lateral),
 * not an exception making every petiole/pedicel bendable. Its authored response
 * resists over-folding. These graph kinds describe craft parts, not taxonomy.
 * Generic, not a species. Randomness is consumed only during construction.
 */
export function createNoddingFlowerV2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: NODDING_FLOWER_V2_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  const azimuth = (random.next() - 0.5) * 0.55;
  const length = 2.28 + random.next() * 0.16;
  const neckDrop = 0.72 + random.next() * 0.1;
  const leafJitter = (random.next() - 0.5) * 0.03;
  const leafScale = 0.5 + random.next() * 0.06;
  const bloomScale = 1.06 + random.next() * 0.1;
  const bloomSpin = (random.next() - 0.5) * 0.45;
  // Show the arch in Front as well as in three-quarter, instead of routinely
  // hiding its entire curve behind the supporting stem.
  const yaw = azimuth + hand * 0.7;
  const outward = vec3(Math.sin(yaw), 0, Math.cos(yaw));

  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "supporting stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      12,
      normalize(vec3(outward.x * 0.06, 1, outward.z * 0.05)),
      vec3(outward.x * 0.05, -0.02, outward.z * 0.03),
    ),
    radius: 0.031,
    stiffness: NODDING_FLOWER_V2_RESPONSE.stem,
  });

  const leafDistance = stem.activeLength * (0.34 + leafJitter);
  const leafAnchor = sampleBranch(stem, leafDistance);
  const leafSide = normalize(vec3(-outward.z * hand, 0, outward.x * hand));
  const petiole = addBranch(graph, {
    id: `${id}:petiole`,
    label: "leaf stalk",
    kind: "petiole",
    parentId: stem.id,
    parentDistance: leafDistance,
    points: makeChain(
      leafAnchor.position,
      0.22,
      3,
      normalize(add(scale(leafSide, 0.86), scale(leafAnchor.tangent, 0.42))),
      scale(leafAnchor.tangent, -0.08),
    ),
    radius: 0.012,
    stiffness: NODDING_FLOWER_V2_RESPONSE.stalk,
  });
  graph.organs.set(`${id}:leaf`, {
    id: `${id}:leaf`,
    kind: "leaf",
    branchId: petiole.id,
    distance: petiole.activeLength,
    spin: hand * 0.35,
    scale: leafScale,
    active: true,
  });

  const neckDistance = stem.activeLength;
  const neckAnchor = sampleBranch(stem, neckDistance);
  const rise = scale(neckAnchor.tangent, 0.52);
  const crest = add(
    neckAnchor.position,
    add(scale(neckAnchor.tangent, 0.2), scale(outward, 0.58)),
  );
  crest.y = neckAnchor.position.y + 0.16;
  const drop = normalize(vec3(outward.x * 0.42, -0.78, outward.z * 1.05));
  const tip = add(crest, scale(drop, neckDrop));
  const neck = addBranch(graph, {
    id: `${id}:neck`,
    label: "arching upper stem",
    kind: "lateral",
    parentId: stem.id,
    parentDistance: neckDistance,
    points: sampleAuthoredArc([
      neckAnchor.position,
      add(neckAnchor.position, rise),
      crest,
      tip,
    ], NECK_SEGMENTS),
    radius: 0.022,
    stiffness: NODDING_FLOWER_V2_RESPONSE.upperStem,
  });
  const terminal = sampleBranch(neck, neck.activeLength);
  const pedicel = addBranch(graph, {
    id: `${id}:flower-stalk`, label: "flower stalk", kind: "pedicel",
    parentId: neck.id, parentDistance: neck.activeLength,
    points: makeChain(terminal.position, 0.09, 2, terminal.tangent, vec3()),
    radius: 0.013, stiffness: NODDING_FLOWER_V2_RESPONSE.stalk,
  });
  graph.organs.set(`${id}:bloom`, {
    id: `${id}:bloom`,
    kind: "bloom",
    branchId: pedicel.id,
    distance: pedicel.activeLength,
    spin: bloomSpin,
    scale: bloomScale,
    active: true,
  });

  return graph;
}
