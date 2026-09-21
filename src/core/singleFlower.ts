import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { SINGLE_FLOWER_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type BranchKind, type PlantGraph } from "./types.ts";

export const SINGLE_FLOWER_VERSION = "single-flower-v1" as const;

/**
 * One terminal bloom on a slender supporting stem. Generic, not a species.
 * Two modest leaves give scale and a keep-or-cut choice. The bloom's persistent
 * spin and pedicel attachment set a facing direction; aiming the stem turns it.
 * Randomness is consumed only during construction. All attachments persist.
 */
export function createSingleFlower(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: SINGLE_FLOWER_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const length = 5.22 + random.next() * 0.26;
  const lean = 0.07 + random.next() * 0.05;
  const azimuth = random.next() * Math.PI * 2;
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
      vec3(Math.cos(azimuth) * lean * 0.18, 1, Math.sin(azimuth) * lean * 0.12),
      vec3(0.14 + random.next() * 0.07, -0.018, -0.05 + (random.next() - 0.5) * 0.07),
    ),
    radius: 0.034,
    stiffness: SINGLE_FLOWER_RESPONSE.stem,
  });

  const addStalk = (
    suffix: string,
    label: string,
    kind: Extract<BranchKind, "petiole" | "pedicel">,
    parentDistance: number,
    stalkLength: number,
    spin: number,
    segments: number,
    radius: number,
    along: number,
    out: number,
  ): Branch => {
    const anchor = sampleBranch(stem, parentDistance);
    const side = basisFor(anchor.tangent, spin);
    const direction = normalize(add(scale(side, out), scale(anchor.tangent, along)));
    return addBranch(graph, {
      id: `${id}:${suffix}`,
      label,
      kind,
      parentId: stem.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        stalkLength,
        segments,
        direction,
        scale(anchor.tangent, kind === "pedicel" ? -0.07 : -0.11),
      ),
      radius,
      stiffness: SINGLE_FLOWER_RESPONSE.stalk,
    });
  };

  const leaf1Distance = stem.activeLength * (0.24 + (random.next() - 0.5) * 0.028);
  const leaf1Spin = azimuth + 0.32 + (random.next() - 0.5) * 0.38;
  const petiole1 = addStalk(
    "petiole-1",
    "leaf stalk",
    "petiole",
    leaf1Distance,
    0.27 + random.next() * 0.05,
    leaf1Spin,
    3,
    0.014,
    0.5,
    0.84,
  );
  graph.organs.set(`${id}:leaf-1`, {
    id: `${id}:leaf-1`,
    kind: "leaf",
    branchId: petiole1.id,
    distance: petiole1.activeLength,
    spin: (random.next() - 0.5) * 0.48,
    scale: 0.72 + random.next() * 0.08,
    active: true,
  });

  const leaf2Distance = stem.activeLength * (0.49 + (random.next() - 0.5) * 0.028);
  const leaf2Spin = leaf1Spin + Math.PI * 0.93 + (random.next() - 0.5) * 0.22;
  const petiole2 = addStalk(
    "petiole-2",
    "leaf stalk",
    "petiole",
    leaf2Distance,
    0.25 + random.next() * 0.045,
    leaf2Spin,
    3,
    0.013,
    0.48,
    0.86,
  );
  graph.organs.set(`${id}:leaf-2`, {
    id: `${id}:leaf-2`,
    kind: "leaf",
    branchId: petiole2.id,
    distance: petiole2.activeLength,
    spin: (random.next() - 0.5) * 0.42,
    scale: 0.66 + random.next() * 0.08,
    active: true,
  });

  const bloomDistance = stem.activeLength * (0.934 + (random.next() - 0.5) * 0.01);
  const bloomSpin = azimuth + 1.05 + (random.next() - 0.5) * 0.55;
  const pedicel = addStalk(
    "pedicel",
    "flower stalk",
    "pedicel",
    bloomDistance,
    0.56 + random.next() * 0.07,
    bloomSpin,
    4,
    0.015,
    0.4,
    0.91,
  );
  graph.organs.set(`${id}:bloom`, {
    id: `${id}:bloom`,
    kind: "bloom",
    branchId: pedicel.id,
    distance: pedicel.activeLength,
    spin: (random.next() - 0.5) * 0.5,
    scale: 1.22 + random.next() * 0.12,
    active: true,
  });

  return graph;
}
