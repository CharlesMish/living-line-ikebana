/** Independent Sol6.1-requested study. Generic botanical cues, not species models. */
import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { CANDIDATE_CANE_RESPONSE, CANDIDATE_PAIRED_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const SPARSE_CANE_VERSION = "study-sol61-sparse-cane-v1";
export const PAIRED_LEAF_VERSION = "study-sol61-paired-leaf-v1";

function graphFor(id: string, seed: number, version: string): PlantGraph {
  return { schemaVersion: SCHEMA_VERSION, generatorVersion: version, id,
    seed: seed >>> 0, rootBranchId: `${id}:stem`, branches: new Map(), organs: new Map() };
}

function leaf(graph: PlantGraph, parent: Branch, fraction: number, spin: number,
  scale: number, along: number, suffix: string, random: Mulberry32) {
  const parentDistance = parent.activeLength * fraction;
  const anchor = sampleBranch(parent, parentDistance);
  const stalk = addBranch(graph, {
    id: `${graph.id}:petiole-${suffix}`, label: "leaf stalk", kind: "petiole",
    parentId: parent.id, parentDistance,
    points: makeChain(anchor.position, 0.13 + random.next() * 0.025, 3,
      directionFromParent(anchor.tangent, spin, 1, along), vec3(0, -0.06, 0)),
    radius: 0.009, stiffness: 0.18,
  });
  const id = `${graph.id}:leaf-${suffix}`;
  graph.organs.set(id, { id, kind: "leaf", branchId: stalk.id,
    distance: stalk.activeLength, spin: (random.next() - 0.5) * 0.22,
    scale, active: true });
}

/** Long quiet cane with two spaced branchlets. Leaves never cluster at the base.
 * Branchlets are shapeable structural twigs; each leaf has its own prunable stalk.
 * Small authored seed differences preserve the open, ascending silhouette.
 */
export function createSparseCane(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph = graphFor(id, seed, SPARSE_CANE_VERSION);
  const hand = random.next() < 0.5 ? -1 : 1;
  const plane = (random.next() - 0.5) * 0.65;
  const stem = addBranch(graph, {
    id: graph.rootBranchId, label: "sparse cane", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 5.25 + random.next() * 0.3, 20,
      vec3(hand * 0.065, 1, 0.02), vec3(hand * 0.15, 0, -0.045)),
    radius: 0.039, stiffness: CANDIDATE_CANE_RESPONSE.cane,
  });
  for (let index = 0; index < 2; index++) {
    const parentDistance = stem.activeLength * (0.46 + index * 0.29);
    const anchor = sampleBranch(stem, parentDistance);
    // basisFor near a vertical tangent starts toward Z; pi/2 brings the study
    // predominantly into the front plane, with restrained depth variation.
    const spin = Math.PI / 2 + plane + index * Math.PI;
    const twig = addBranch(graph, {
      id: `${id}:twig-${index + 1}`, label: "leafy branchlet", kind: "twig",
      parentId: stem.id, parentDistance,
      points: makeChain(anchor.position, 1.12 - index * 0.22 + random.next() * 0.08,
        7, directionFromParent(anchor.tangent, spin, 0.85, 0.6), vec3(0, 0.16, 0)),
      radius: 0.019, stiffness: CANDIDATE_CANE_RESPONSE.twig,
    });
    const count = index === 0 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      leaf(graph, twig, 0.25 + j * 0.3, spin + (j % 2 ? 0.8 : -0.8),
        (0.6 - j * 0.07) * (0.95 + random.next() * 0.1), 0.32,
        `${index + 1}-${j + 1}`, random);
    }
  }
  return graph;
}

/** Compact opposite-leaf cutting: four separated pairs, each rotated a little
 * around the stem. A short lower line leaves seating/water visible; tapering
 * crown leaves soften the terminal silhouette without adding a flower mass.
 */
export function createPairedLeaf(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph = graphFor(id, seed, PAIRED_LEAF_VERSION);
  const plane = Math.PI / 2 + (random.next() - 0.5) * 0.5;
  const hand = random.next() < 0.5 ? -1 : 1;
  const stem = addBranch(graph, {
    id: graph.rootBranchId, label: "paired-leaf stem", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 3.2 + random.next() * 0.25, 16,
      vec3(hand * 0.04, 1, 0.01), vec3(hand * 0.19, 0, 0.07)),
    radius: 0.036, stiffness: CANDIDATE_PAIRED_RESPONSE.stem,
  });
  for (let pair = 0; pair < 4; pair++) {
    const fraction = 0.31 + pair * 0.205;
    const spin = plane + pair * 0.32;
    const size = (0.99 - pair * 0.13) * (0.97 + random.next() * 0.06);
    for (let side = 0; side < 2; side++) {
      leaf(graph, stem, fraction, spin + side * Math.PI,
        size, 0.24 + pair * 0.07, `${pair + 1}-${side + 1}`, random);
    }
  }
  return graph;
}
