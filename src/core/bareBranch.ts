import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { BARE_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type BranchKind, type PlantGraph } from "./types.ts";

export const BARE_BRANCH_VERSION = "bare-branch-v1" as const;

/**
 * Sparse woody cutting: one readable primary line, two or three answering forks,
 * and one restrained distal spur. No leaves or flowers. Randomness is consumed
 * only during construction. A generic authored line, not a species simulation.
 */
export function createBareBranch(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: BARE_BRANCH_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:trunk`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? 1 : -1;
  const azimuth = random.next() * Math.PI * 2;
  const trunkLength = 5.42 + random.next() * 0.28;
  const trunkLean = 0.16 + random.next() * 0.07;
  const trunkDepth = (random.next() - 0.5) * 0.1;
  const trunk = addBranch(graph, {
    id: graph.rootBranchId,
    label: "main line",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      trunkLength,
      16,
      vec3(hand * trunkLean * 0.42, 1, trunkDepth),
      vec3(hand * (0.16 + random.next() * 0.08), -0.03 + (random.next() - 0.5) * 0.02, (random.next() - 0.5) * 0.1),
    ),
    radius: 0.078,
    stiffness: BARE_RESPONSE.trunk,
  });

  const addFork = (
    suffix: string,
    label: string,
    kind: BranchKind,
    parent: Branch,
    fraction: number,
    length: number,
    segments: number,
    spin: number,
    out: number,
    along: number,
    curveOut: number,
    radius: number,
    stiffness: number,
  ): Branch => {
    const parentDistance = parent.activeLength * fraction;
    const anchor = sampleBranch(parent, parentDistance);
    const direction = directionFromParent(anchor.tangent, spin, out, along);
    const side = basisFor(anchor.tangent, spin);
    return addBranch(graph, {
      id: `${id}:${suffix}`,
      label,
      kind,
      parentId: parent.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        length,
        segments,
        direction,
        add(scale(side, curveOut), vec3(0, -0.05, 0)),
      ),
      radius,
      stiffness,
    });
  };

  const answering = addFork(
    "answering",
    "answering fork",
    "lateral",
    trunk,
    0.305 + random.next() * 0.03,
    1.88 + random.next() * 0.2,
    8,
    azimuth,
    0.92,
    0.34 + random.next() * 0.08,
    0.1 + random.next() * 0.08,
    0.044,
    BARE_RESPONSE.answering,
  );
  addFork(
    "counter",
    "counter fork",
    "lateral",
    trunk,
    0.545 + random.next() * 0.03,
    1.3 + random.next() * 0.16,
    7,
    azimuth + Math.PI + (random.next() - 0.5) * 0.22,
    0.78,
    0.58 + random.next() * 0.08,
    0.08,
    0.036,
    BARE_RESPONSE.counter,
  );
  addFork(
    "distal",
    "distal fork",
    "twig",
    trunk,
    0.745 + random.next() * 0.03,
    1.0 + random.next() * 0.12,
    6,
    azimuth + (random.next() - 0.5) * 0.35,
    0.7,
    0.68 + random.next() * 0.08,
    0.06,
    0.028,
    BARE_RESPONSE.distal,
  );
  addFork(
    "spur",
    "restrained spur",
    "twig",
    answering,
    0.48 + random.next() * 0.12,
    0.58 + random.next() * 0.1,
    5,
    azimuth + Math.PI * 0.38 * (random.next() < 0.5 ? 1 : -1),
    0.82,
    0.5 + random.next() * 0.1,
    0.05,
    0.02,
    BARE_RESPONSE.spur,
  );

  return graph;
}
