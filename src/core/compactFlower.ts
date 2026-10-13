import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { COMPACT_FLOWER_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const COMPACT_FLOWER_VERSION = "compact-flower-v1" as const;

/**
 * One small rounded flower, not a crown assembled from several bloom organs.
 * The terminal pedicel gives the head its own Aim pivot; two modest lower
 * leaves can be kept or cut independently. Generic stock, not a named species.
 * All seed variation is consumed here, never during shaping or rendering.
 */
export function createCompactFlower(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: COMPACT_FLOWER_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const azimuth = random.next() * Math.PI * 2;
  const lean = 0.055 + random.next() * 0.025;
  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "compact flower stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base, 3.25 + random.next() * 0.17, 12,
      vec3(Math.cos(azimuth) * lean, 1, Math.sin(azimuth) * lean),
      vec3(0.085 + random.next() * 0.025, -0.015, (random.next() - 0.5) * 0.05),
    ),
    radius: 0.031,
    stiffness: COMPACT_FLOWER_RESPONSE.stem,
  });

  for (let index = 0; index < 2; index += 1) {
    const parentDistance = stem.activeLength * (0.28 + index * 0.24 + (random.next() - 0.5) * 0.018);
    const anchor = sampleBranch(stem, parentDistance);
    const spin = azimuth + 0.3 + index * Math.PI * 0.91 + (random.next() - 0.5) * 0.2;
    const petiole = addBranch(graph, {
      id: `${id}:petiole-${index + 1}`,
      label: "leaf stalk",
      kind: "petiole",
      parentId: stem.id,
      parentDistance,
      points: makeChain(
        anchor.position, 0.19 + random.next() * 0.035, 3,
        directionFromParent(anchor.tangent, spin, 0.88, 0.4),
        add(scale(basisFor(anchor.tangent, spin), -0.035), vec3(0, -0.06, 0)),
      ),
      radius: 0.011,
      stiffness: COMPACT_FLOWER_RESPONSE.stalk,
    });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: petiole.id,
      distance: petiole.activeLength,
      spin: (random.next() - 0.5) * 0.32,
      scale: 0.49 + random.next() * 0.065,
      active: true,
    });
  }

  // Exact terminal attachment avoids a spare stem end poking through the head.
  // Enough stalk remains outside the bloom for an ordinary aim/prune target.
  const tip = sampleBranch(stem, stem.activeLength);
  const flowerSpin = azimuth + 1.0 + (random.next() - 0.5) * 0.24;
  const pedicel = addBranch(graph, {
    id: `${id}:pedicel`,
    label: "compact flower stalk",
    kind: "pedicel",
    parentId: stem.id,
    parentDistance: stem.activeLength,
    points: makeChain(
      tip.position, 0.4 + random.next() * 0.035, 4,
      directionFromParent(tip.tangent, flowerSpin, 0.74, 0.67),
      scale(tip.tangent, -0.06),
    ),
    radius: 0.014,
    stiffness: COMPACT_FLOWER_RESPONSE.stalk,
  });
  const bloomId = `${id}:bloom`;
  graph.organs.set(bloomId, {
    id: bloomId,
    kind: "bloom",
    branchId: pedicel.id,
    distance: pedicel.activeLength,
    spin: (random.next() - 0.5) * 0.36,
    scale: 0.97 + random.next() * 0.055,
    active: true,
  });
  return graph;
}
