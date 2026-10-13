import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { scale, vec3, type Vec3 } from "./math.ts";
import { LOBED_LEAF_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const LOBED_LEAF_VERSION = "lobed-leaf-v1" as const;

/** A sparse maple-inspired cutting, not a species simulation. Two opposite
 * leaf pairs share two real nodes, one on the wood and one on its subordinate
 * fork. Each simple lobed blade is one organ on one prunable petiole. There are
 * no lobe records or lobe handles. Construction consumes all randomness once.
 */
export function createLobedLeaf(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION, generatorVersion: LOBED_LEAF_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:wood`,
    branches: new Map(), organs: new Map(),
  };
  const hand = random.next() < 0.5 ? -1 : 1;
  const azimuth = random.next() * Math.PI * 2;
  const wood = addBranch(graph, {
    id: graph.rootBranchId, label: "lobed-leaf wood", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 3.65 + random.next() * 0.24, 14,
      vec3(hand * 0.13, 1, -0.045), vec3(hand * 0.08, -0.012, 0.07)),
    radius: 0.043, stiffness: LOBED_LEAF_RESPONSE.wood,
  });
  const forkDistance = wood.activeLength * 0.47;
  const forkAnchor = sampleBranch(wood, forkDistance);
  const fork = addBranch(graph, {
    id: `${id}:fork`, label: "leaf-bearing fork", kind: "lateral",
    parentId: wood.id, parentDistance: forkDistance,
    points: makeChain(forkAnchor.position, 1.45 + random.next() * 0.12, 7,
      vec3(-hand * 0.72, 0.82, 0.13), vec3(-hand * 0.08, 0.08, -0.04)),
    radius: 0.027, stiffness: LOBED_LEAF_RESPONSE.fork,
  });
  const nodes = [
    { parent: wood, fraction: 0.86, spin: azimuth, size: 1 },
    { parent: fork, fraction: 0.8, spin: azimuth + Math.PI * 0.46, size: 0.88 },
  ];
  nodes.forEach((node, nodeIndex) => {
    const distance = node.parent.activeLength * node.fraction;
    const anchor = sampleBranch(node.parent, distance);
    for (let side = 0; side < 2; side += 1) {
      const leafNumber = nodeIndex * 2 + side + 1;
      const direction = directionFromParent(anchor.tangent, node.spin + side * Math.PI, 0.96, 0.22);
      const petiole = addBranch(graph, {
        id: `${id}:petiole-${leafNumber}`, label: "lobed leaf stalk", kind: "petiole",
        parentId: node.parent.id, parentDistance: distance,
        points: makeChain(anchor.position, 0.22 + random.next() * 0.045, 3,
          direction, scale(anchor.tangent, -0.1)),
        radius: 0.011, stiffness: LOBED_LEAF_RESPONSE.stalk,
      });
      const organId = `${id}:leaf-${leafNumber}`;
      graph.organs.set(organId, {
        id: organId, kind: "leaf", branchId: petiole.id, distance: petiole.activeLength,
        spin: (side === 0 ? -0.22 : 0.22) + (random.next() - 0.5) * 0.32,
        scale: node.size * (0.92 + random.next() * 0.12), active: true,
      });
    }
  });
  return graph;
}
