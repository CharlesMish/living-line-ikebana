import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { LANTERN_SPRAY_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const LANTERN_SPRAY_VERSION = "lantern-spray-v1" as const;

/**
 * Authored Sandersonia / paper-lantern-inspired arching spray, not a cultivar
 * reconstruction. A rising stem and subordinate distal arch suspend five
 * inflated lantern bells on individual drooping pedicels, so pruning the upper
 * arch retains proximal lanterns and individual lanterns can be thinned cleanly.
 */
export function createLanternSpray(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: LANTERN_SPRAY_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? 1 : -1;
  const azimuth = (random.next() - 0.5) * 0.48;
  const depth = (random.next() - 0.5) * 0.12;
  const stemLength = 3.68 + random.next() * 0.22;

  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "arching lantern stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      stemLength,
      14,
      vec3(hand * (0.28 + random.next() * 0.08), 0.96, depth),
      vec3(hand * (0.44 + random.next() * 0.08), -0.22, -depth * 0.5),
    ),
    radius: 0.028,
    stiffness: LANTERN_SPRAY_RESPONSE.stem,
  });

  const archParentDistance = stem.activeLength * (0.53 + random.next() * 0.03);
  const archAnchor = sampleBranch(stem, archParentDistance);
  const archLength = 1.88 + random.next() * 0.16;
  const arch = addBranch(graph, {
    id: `${id}:arch`,
    label: "distal lantern arch",
    kind: "lateral",
    parentId: stem.id,
    parentDistance: archParentDistance,
    points: makeChain(
      archAnchor.position,
      archLength,
      9,
      vec3(hand * (0.78 + random.next() * 0.06), 0.34, depth * 0.8),
      vec3(hand * 0.28, -0.38, (random.next() - 0.5) * 0.08),
    ),
    radius: 0.019,
    stiffness: LANTERN_SPRAY_RESPONSE.arch,
  });

  const lanternStations: ReadonlyArray<{
    index: number;
    parent: Branch;
    fraction: number;
    length: number;
    scale: number;
    zOffset: number;
  }> = [
    { index: 1, parent: stem, fraction: 0.41, length: 0.39, scale: 1.06, zOffset: -0.09 },
    { index: 2, parent: stem, fraction: 0.68, length: 0.37, scale: 1.0, zOffset: 0.09 },
    { index: 3, parent: stem, fraction: 0.94, length: 0.35, scale: 0.92, zOffset: -0.07 },
    { index: 4, parent: arch, fraction: 0.48, length: 0.38, scale: 0.96, zOffset: 0.08 },
    { index: 5, parent: arch, fraction: 0.95, length: 0.34, scale: 0.86, zOffset: -0.06 },
  ];

  for (const spec of lanternStations) {
    const parentDistance = spec.parent.activeLength * spec.fraction;
    const anchor = sampleBranch(spec.parent, parentDistance);
    const stalkLength = spec.length + random.next() * 0.04;
    const stalk = addBranch(graph, {
      id: `${id}:lantern-stalk-${spec.index}`,
      label: "lantern bell stalk",
      kind: "pedicel",
      parentId: spec.parent.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        stalkLength,
        4,
        vec3(
          hand * (0.14 + (random.next() - 0.5) * 0.06),
          -0.96,
          spec.zOffset + (random.next() - 0.5) * 0.04,
        ),
        vec3(hand * 0.04, -0.14, 0),
      ),
      radius: 0.0085,
      stiffness: LANTERN_SPRAY_RESPONSE.stalk,
    });

    const organId = `${id}:lantern-${spec.index}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "bloom",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: azimuth + spec.index * 0.62 + (random.next() - 0.5) * 0.24,
      scale: spec.scale + (random.next() - 0.5) * 0.04,
      active: true,
    });
  }

  for (let index = 0; index < 2; index += 1) {
    const parentDistance = stem.activeLength * (0.20 + index * 0.11);
    const anchor = sampleBranch(stem, parentDistance);
    const side = index === 0 ? -hand : hand;
    const stalk = addBranch(graph, {
      id: `${id}:leaf-stalk-${index + 1}`,
      label: "lantern leaf stalk",
      kind: "petiole",
      parentId: stem.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        0.26 + random.next() * 0.03,
        3,
        directionFromParent(
          anchor.tangent,
          azimuth + (side > 0 ? 0.35 : Math.PI - 0.35),
          0.92,
          0.32,
        ),
        vec3(0, -0.04, 0),
      ),
      radius: 0.01,
      stiffness: LANTERN_SPRAY_RESPONSE.stalk,
    });

    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: side * 0.22 + (random.next() - 0.5) * 0.16,
      scale: 0.84 - index * 0.06 + random.next() * 0.04,
      active: true,
    });
  }

  return graph;
}
