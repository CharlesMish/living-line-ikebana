import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { FLOWER_VOLUME_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const FLOWER_VOLUME_VERSION = "flower-volume-v1" as const;

/**
 * Five flower-bearing side groups. Enough to close into one head, few enough
 * that each group stays a readable prune target. Not a floret field.
 */
export const FLOWER_VOLUME_GROUP_COUNT = 5;

/**
 * A concentrated flower volume on one supporting stem. Each side group is a
 * persistent pedicel with one tufted bloom packed into the same head. Pruning
 * a group uses the existing distal plan and opens that part of the mass; the
 * other groups, leaves, and stem detail stay the same material. Generic, not
 * a species. Randomness is consumed only during construction.
 */
export function createFlowerVolume(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: FLOWER_VOLUME_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const length = 4.42 + random.next() * 0.18;
  const azimuth = random.next() * Math.PI * 2;
  const lean = 0.045 + random.next() * 0.04;
  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "flower stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      14,
      vec3(Math.cos(azimuth) * lean, 1, Math.sin(azimuth) * lean * 0.65),
      vec3(0.08 + random.next() * 0.05, -0.02, (random.next() - 0.5) * 0.08),
    ),
    radius: 0.041,
    stiffness: FLOWER_VOLUME_RESPONSE.stem,
  });

  const addStalk = (
    suffix: string,
    label: string,
    kind: "petiole" | "pedicel",
    parentDistance: number,
    stalkLength: number,
    spin: number,
    out: number,
    along: number,
    radius: number,
    stiffness: number,
  ): Branch => {
    const anchor = sampleBranch(stem, parentDistance);
    const direction = directionFromParent(anchor.tangent, spin, out, along);
    const side = basisFor(anchor.tangent, spin);
    return addBranch(graph, {
      id: `${id}:${suffix}`,
      label,
      kind,
      parentId: stem.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        stalkLength,
        4,
        direction,
        add(scale(side, kind === "pedicel" ? 0.06 : -0.04), vec3(0, kind === "pedicel" ? -0.045 : -0.08, 0)),
      ),
      radius,
      stiffness,
    });
  };

  const addLeaf = (index: number, fraction: number) => {
    const distance = stem.activeLength * (fraction + (random.next() - 0.5) * 0.016);
    const spin = azimuth + (index === 0 ? 0.45 : Math.PI * 0.93) + (random.next() - 0.5) * 0.28;
    const petiole = addStalk(
      `petiole-${index + 1}`,
      "leaf stalk",
      "petiole",
      distance,
      0.22 + random.next() * 0.04,
      spin,
      0.88,
      0.4,
      0.013,
      FLOWER_VOLUME_RESPONSE.stalk,
    );
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: petiole.id,
      distance: petiole.activeLength,
      spin: (random.next() - 0.5) * 0.36,
      scale: 0.58 + random.next() * 0.08,
      active: true,
    });
  };

  addLeaf(0, 0.24);
  addLeaf(1, 0.42);

  for (let index = 0; index < FLOWER_VOLUME_GROUP_COUNT; index += 1) {
    const crown = index === 0;
    const fraction = crown
      ? Math.min(0.992, 0.986 + (random.next() - 0.5) * 0.004)
      : Math.min(0.968, 0.932 + (index - 1) * 0.01 + (random.next() - 0.5) * 0.004);
    const spin = azimuth + index * (Math.PI * 2 / FLOWER_VOLUME_GROUP_COUNT) + (random.next() - 0.5) * 0.16;
    const pedicel = addStalk(
      `group-${index + 1}`,
      "flower group",
      "pedicel",
      stem.activeLength * fraction,
      (crown ? 0.18 : 0.3) + random.next() * 0.025,
      spin,
      crown ? 0.18 : 0.86,
      crown ? 0.98 : 0.48,
      0.016,
      FLOWER_VOLUME_RESPONSE.group,
    );
    const organId = `${id}:bloom-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "bloom",
      branchId: pedicel.id,
      distance: pedicel.activeLength,
      spin: (random.next() - 0.5) * 0.3,
      scale: (crown ? 0.98 : 1.04) + random.next() * 0.05,
      active: true,
    });
  }

  return graph;
}
