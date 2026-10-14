import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { VIOLET_SPRIG_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const VIOLET_SPRIG_VERSION = "violet-sprig-v1" as const;

/** A low, open, wiry cutting inspired by cranesbill flower habit, not a species
 * reconstruction. Three short arms carry two small saucers each. Cutting back
 * between arm stations keeps the lower flowers; every flower has its own stalk. */
export function createVioletSprig(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = { schemaVersion: SCHEMA_VERSION, generatorVersion: VIOLET_SPRIG_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stem`, branches: new Map(), organs: new Map() };
  const azimuth = random.next() * Math.PI * 2;
  const stem = addBranch(graph, { id: graph.rootBranchId, label: "violet sprig stem", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 2.35 + random.next() * 0.16, 12,
      vec3(Math.cos(azimuth) * 0.1, 1, Math.sin(azimuth) * 0.1),
      vec3(0.09, -0.02, (random.next() - 0.5) * 0.1)),
    radius: 0.024, stiffness: VIOLET_SPRIG_RESPONSE.stem });
  for (let armIndex = 0; armIndex < 3; armIndex++) {
    const parentDistance = stem.activeLength * [0.36, 0.63, 0.91][armIndex]!;
    const anchor = sampleBranch(stem, parentDistance);
    const spin = azimuth + armIndex * 2.35 + (random.next() - 0.5) * 0.12;
    const side = basisFor(anchor.tangent, spin);
    const arm = addBranch(graph, { id: `${id}:arm-${armIndex + 1}`, label: "violet flower arm", kind: "lateral",
      parentId: stem.id, parentDistance,
      points: makeChain(anchor.position, [0.86, 0.74, 0.53][armIndex]! + random.next() * 0.06, 7,
        directionFromParent(anchor.tangent, spin, 0.92, 0.35), add(scale(side, 0.08), scale(anchor.tangent, 0.25))),
      radius: 0.013, stiffness: VIOLET_SPRIG_RESPONSE.arm });
    for (let flowerIndex = 0; flowerIndex < 2; flowerIndex++) {
      const distance = arm.activeLength * (flowerIndex === 0 ? 0.48 : 1);
      const at = sampleBranch(arm, distance);
      const stalk = addBranch(graph, { id: `${id}:stalk-${armIndex + 1}-${flowerIndex + 1}`, label: "violet flower stalk", kind: "pedicel",
        parentId: arm.id, parentDistance: distance,
        points: makeChain(at.position, 0.3 + random.next() * 0.08, 4,
          directionFromParent(at.tangent, flowerIndex * Math.PI + 0.65, 0.55, 0.85), vec3(0, 0.09, 0)),
        radius: 0.0085, stiffness: VIOLET_SPRIG_RESPONSE.stalk });
      const organId = `${id}:bloom-${armIndex + 1}-${flowerIndex + 1}`;
      graph.organs.set(organId, { id: organId, kind: "bloom", branchId: stalk.id, distance: stalk.activeLength,
        spin: (random.next() - 0.5) * 0.4, scale: 0.94 + random.next() * 0.1, active: true });
    }
  }
  for (let index = 0; index < 2; index++) {
    const parentDistance = stem.activeLength * (0.18 + index * 0.24);
    const at = sampleBranch(stem, parentDistance);
    const stalk = addBranch(graph, { id: `${id}:leaf-stalk-${index + 1}`, label: "leaf stalk", kind: "petiole",
      parentId: stem.id, parentDistance,
      points: makeChain(at.position, 0.22, 3, directionFromParent(at.tangent, azimuth + index * Math.PI, 0.9, 0.28), vec3(0, -0.03, 0)),
      radius: 0.01, stiffness: VIOLET_SPRIG_RESPONSE.stalk });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, { id: organId, kind: "leaf", branchId: stalk.id, distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.2, scale: 0.30 + random.next() * 0.04, active: true });
  }
  return graph;
}
