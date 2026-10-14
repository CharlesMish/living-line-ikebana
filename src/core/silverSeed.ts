import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { SILVER_SEED_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const SILVER_SEED_VERSION = "silver-seed-v1" as const;

/** Dried Lunaria-inspired stock: six papery middle partitions, not green pods
 * or flowers. Three airy arms retain useful lower discs after an upper cut.
 * Each disc sits beyond its own accessible stalk. This is an authored generic
 * cutting, not a cultivar reconstruction or a falling-seed simulation. */
export function createSilverSeed(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = { schemaVersion: SCHEMA_VERSION, generatorVersion: SILVER_SEED_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stem`, branches: new Map(), organs: new Map() };
  const phase = (random.next() - .5) * .5;
  const stem = addBranch(graph, { id: graph.rootBranchId, label: "dry seed stem", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 2.92 + random.next() * .15, 14, vec3(.05 + random.next() * .06, 1, .03), vec3(.075, 0, -.025)),
    radius: .022, stiffness: SILVER_SEED_RESPONSE.stem });
  for (let armIndex = 0; armIndex < 3; armIndex++) {
    const parentDistance = stem.activeLength * [.31, .57, .81][armIndex]!;
    const anchor = sampleBranch(stem, parentDistance);
    // Predominantly a shallow fan with a changing near/far component, rather
    // than a spiral of coins around the stem or a dense berry cluster.
    const spin = [-Math.PI / 2, Math.PI / 2, -Math.PI / 2 + .4][armIndex]! + phase;
    const arm = addBranch(graph, { id: `${id}:arm-${armIndex + 1}`, label: "seed spray arm", kind: "lateral",
      parentId: stem.id, parentDistance,
      points: makeChain(anchor.position, [1.20, 1.02, .73][armIndex]! + random.next() * .07, 7,
        directionFromParent(anchor.tangent, spin, .86, .46), vec3(0, .21, 0)),
      radius: .0115, stiffness: SILVER_SEED_RESPONSE.arm });
    for (let discIndex = 0; discIndex < 2; discIndex++) {
      const distance = arm.activeLength * (discIndex === 0 ? .43 : 1);
      const at = sampleBranch(arm, distance);
      const stalk = addBranch(graph, { id: `${id}:disc-stalk-${armIndex + 1}-${discIndex + 1}`, label: "seed disc stalk", kind: "pedicel",
        parentId: arm.id, parentDistance: distance,
        points: makeChain(at.position, .26 + random.next() * .07, 4,
          vec3((armIndex % 2 === 0 ? -1 : 1) * (discIndex === 0 ? -.16 : .19), .97, (random.next() - .5) * .26), vec3(0, .035, 0)),
        radius: .006, stiffness: SILVER_SEED_RESPONSE.stalk });
      const organId = `${id}:disc-${armIndex + 1}-${discIndex + 1}`;
      graph.organs.set(organId, { id: organId, kind: "seedpod", branchId: stalk.id, distance: stalk.activeLength,
        spin: [-.34, .42, .17, -.56, .60, -.13][armIndex * 2 + discIndex]! + (random.next() - .5) * .14,
        scale: 1.03 - armIndex * .075 + (random.next() - .5) * .06, active: true });
    }
  }
  return graph;
}
