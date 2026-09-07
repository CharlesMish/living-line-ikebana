import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { LEAFY_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const LEAFY_SHOOT_VERSION = "leafy-shoot-v1" as const;

/** A generic leafy cutting, not a claim to reproduce a named botanical species.
 * Seven alternating leaves with a clear basal grip and a small terminal leaf.
 * Randomness is consumed only during construction. All attachments persist.
 */
export function createLeafyShoot(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION, generatorVersion: LEAFY_SHOOT_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stem`,
    branches: new Map(), organs: new Map(),
  };
  const length = 4.55 + random.next() * 0.4;
  const azimuth = random.next() * Math.PI * 2;
  const stem = addBranch(graph, {
    id: graph.rootBranchId, label: "leafy stem", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, length, 16, vec3(0.06, 1, -0.025),
      vec3(0.24 + random.next() * 0.09, -0.025, -0.1)),
    radius: 0.057, stiffness: LEAFY_RESPONSE.stem,
  });
  for (let index = 0; index < 7; index += 1) {
    const fraction = 0.24 + index * 0.112 + (random.next() - 0.5) * 0.018;
    const distance = stem.activeLength * fraction;
    const anchor = sampleBranch(stem, distance);
    // Almost alternate, with a gentle spiral so the plant has depth from Above.
    const side = basisFor(anchor.tangent, azimuth + index * Math.PI * 0.89);
    const direction = normalize(add(scale(side, 0.88), scale(anchor.tangent, 0.48)));
    const stalk = addBranch(graph, {
      id: `${id}:petiole-${index + 1}`, label: "leaf stalk", kind: "petiole",
      parentId: stem.id, parentDistance: distance,
      points: makeChain(anchor.position, 0.23 + random.next() * 0.06, 3,
        direction, scale(anchor.tangent, -0.12)),
      radius: 0.016, stiffness: LEAFY_RESPONSE.stalk,
    });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, {
      id: organId, kind: "leaf", branchId: stalk.id, distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.65,
      scale: (index < 4 ? 1.04 : 1.04 - (index - 3) * 0.13) * (0.94 + random.next() * 0.12),
      active: true,
    });
  }
  return graph;
}
