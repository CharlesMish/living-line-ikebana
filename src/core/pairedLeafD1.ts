/** Campaign 01 D1 paired-leaf study, ported from PR #62 commit 98588a60c0d3c62437bfd109a39776bc8aea49ed (paired leaf only; sparse cane intentionally excluded). */
import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const PAIRED_LEAF_D1_VERSION = "paired-leaf-d1-v1" as const;

function graphFor(id: string, seed: number): PlantGraph {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: PAIRED_LEAF_D1_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };
}

function addLeaf(
  graph: PlantGraph,
  parent: Branch,
  fraction: number,
  spin: number,
  scale: number,
  along: number,
  suffix: string,
  random: Mulberry32,
): void {
  const parentDistance = parent.activeLength * fraction;
  const anchor = sampleBranch(parent, parentDistance);
  const stalk = addBranch(graph, {
    id: `${graph.id}:petiole-${suffix}`,
    label: "leaf stalk",
    kind: "petiole",
    parentId: parent.id,
    parentDistance,
    points: makeChain(
      anchor.position,
      0.13 + random.next() * 0.025,
      3,
      directionFromParent(anchor.tangent, spin, 1, along),
      vec3(0, -0.06, 0),
    ),
    radius: 0.009,
    stiffness: 0.18,
  });
  const organId = `${graph.id}:leaf-${suffix}`;
  graph.organs.set(organId, {
    id: organId,
    kind: "leaf",
    branchId: stalk.id,
    distance: stalk.activeLength,
    spin: (random.next() - 0.5) * 0.22,
    scale,
    active: true,
  });
}

/**
 * Compact opposite-leaf cutting with four separated pairs.
 * Maintains PR62 pair rhythm while integrating the current production graph contract.
 */
export function createPairedLeafD1(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph = graphFor(id, seed);
  const plane = Math.PI / 2 + (random.next() - 0.5) * 0.5;
  const hand = random.next() < 0.5 ? -1 : 1;
  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "paired-leaf stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      3.2 + random.next() * 0.25,
      16,
      vec3(hand * 0.04, 1, 0.01),
      vec3(hand * 0.19, 0, 0.07),
    ),
    radius: 0.036,
    stiffness: 0.44,
  });
  for (let pair = 0; pair < 4; pair += 1) {
    const fraction = 0.31 + pair * 0.205;
    const spin = plane + pair * 0.32;
    const size = (0.99 - pair * 0.13) * (0.97 + random.next() * 0.06);
    for (let side = 0; side < 2; side += 1) {
      addLeaf(
        graph,
        stem,
        fraction,
        spin + side * Math.PI,
        size,
        0.24 + pair * 0.07,
        `${pair + 1}-${side + 1}`,
        random,
      );
    }
  }
  return graph;
}
