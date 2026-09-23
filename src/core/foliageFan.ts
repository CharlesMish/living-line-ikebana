import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { FOLIAGE_FAN_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const FOLIAGE_FAN_VERSION = "foliage-fan-v1" as const;

/**
 * A branching green spray. One stem, three lateral arms, and eight small
 * curved leaves on those arms. The leaves together make the spread; none of
 * them is a broad deformable blade. Generic, not a species. Randomness is
 * consumed only during construction. Aim, bend, and prune stay shared.
 */
export function createFoliageFan(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: FOLIAGE_FAN_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  // Keep the fan's side-to-side spread readable from Front. Aim has no axial
  // roll, so a fully random azimuth could freeze a cutting edge-on.
  const azimuth = (random.next() - 0.5) * 1.1;
  const stemLength = 2.52 + random.next() * 0.22;
  const lean = 0.06 + random.next() * 0.05;
  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "fan stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      stemLength,
      12,
      vec3(hand * lean, 1, (random.next() - 0.5) * 0.05),
      vec3(hand * 0.08, -0.02, (random.next() - 0.5) * 0.06),
    ),
    radius: 0.046,
    stiffness: FOLIAGE_FAN_RESPONSE.stem,
  });

  const addArm = (
    suffix: string,
    label: string,
    fraction: number,
    length: number,
    spin: number,
    out: number,
    along: number,
    curveOut: number,
    radius: number,
  ): Branch => {
    const parentDistance = stem.activeLength * fraction;
    const anchor = sampleBranch(stem, parentDistance);
    const direction = directionFromParent(anchor.tangent, spin, out, along);
    const side = basisFor(anchor.tangent, spin);
    return addBranch(graph, {
      id: `${id}:${suffix}`,
      label,
      kind: "lateral",
      parentId: stem.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        length,
        6,
        direction,
        add(scale(side, curveOut), vec3(0, 0.05, 0)),
      ),
      radius,
      stiffness: FOLIAGE_FAN_RESPONSE.arm,
    });
  };

  const opening = addArm(
    "arm-opening",
    "opening arm",
    0.46 + random.next() * 0.02,
    1.58 + random.next() * 0.16,
    azimuth - hand * 1.05,
    0.94,
    0.3,
    0.18,
    0.028,
  );
  const answering = addArm(
    "arm-answering",
    "answering arm",
    0.58 + random.next() * 0.02,
    1.32 + random.next() * 0.14,
    azimuth + hand * 1.05,
    0.9,
    0.34,
    0.14,
    0.026,
  );
  const crown = addArm(
    "arm-crown",
    "crown arm",
    0.76 + random.next() * 0.015,
    0.98 + random.next() * 0.1,
    azimuth + hand * 0.12,
    0.42,
    0.84,
    0.08,
    0.022,
  );

  const addLeaves = (
    arm: Branch,
    suffix: string,
    count: number,
    start: number,
    step: number,
  ): void => {
    for (let index = 0; index < count; index += 1) {
      const fraction = start + index * step + (random.next() - 0.5) * 0.016;
      const parentDistance = arm.activeLength * fraction;
      const anchor = sampleBranch(arm, parentDistance);
      const spin = azimuth + (index % 2 === 0 ? 0.62 : -1.05) + (random.next() - 0.5) * 0.28;
      const side = basisFor(anchor.tangent, spin);
      const direction = normalize(add(
        add(scale(side, 0.8), scale(anchor.tangent, 0.18)),
        vec3(0, 0.46, 0),
      ));
      const stalk = addBranch(graph, {
        id: `${id}:petiole-${suffix}-${index + 1}`,
        label: "leaf stalk",
        kind: "petiole",
        parentId: arm.id,
        parentDistance,
        points: makeChain(
          anchor.position,
          0.2 + random.next() * 0.06,
          3,
          direction,
          scale(anchor.tangent, -0.06),
        ),
        radius: 0.013,
        stiffness: FOLIAGE_FAN_RESPONSE.stalk,
      });
      const organId = `${id}:leaf-${suffix}-${index + 1}`;
      graph.organs.set(organId, {
        id: organId,
        kind: "leaf",
        branchId: stalk.id,
        distance: stalk.activeLength,
        spin: (random.next() - 0.5) * 0.5,
        scale: 0.62 + random.next() * 0.14,
        active: true,
      });
    }
  };

  addLeaves(opening, "opening", 3, 0.34, 0.2);
  addLeaves(answering, "answering", 3, 0.36, 0.2);
  addLeaves(crown, "crown", 2, 0.42, 0.26);
  return graph;
}
