import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { BLOSSOM_SPRAY_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type Branch, type PlantGraph } from "./types.ts";

export const BLOSSOM_SPRAY_V2_VERSION = "blossom-spray-v2" as const;

/** A rising arm with a quiet outward bow. Equal segment lengths are authored
 * once; the ordinary solver owns subsequent edits. No new deformation law. */
function risingArm(base: Vec3, length: number, tangent: Vec3, side: Vec3): Vec3[] {
  const points = [base];
  for (let index = 0; index < 10; index += 1) {
    const t = (index + 0.5) / 10;
    const angle = 0.38 + 0.62 * Math.sin(Math.PI * t * 0.85);
    const direction = normalize(add(scale(tangent, Math.cos(angle)), scale(side, Math.sin(angle))));
    points.push(add(points[index]!, scale(direction, length / 10)));
  }
  return points;
}

/**
 * A thin green line with two or three separated flower groups. Each group is
 * one lateral. Each flower is one pedicel and one bloom on that lateral.
 * Cutting the pedicel removes that flower. Cutting the lateral removes its
 * descendant stalks and blooms through the ordinary distal plan. The other
 * groups and the stem stay the same material. Generic, not a species.
 * Randomness is consumed only during construction.
 */
export function createBlossomSprayV2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: BLOSSOM_SPRAY_V2_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:stem`,
    branches: new Map(),
    organs: new Map(),
  };

  const length = 4.35 + random.next() * 0.3;
  const azimuth = random.next() * Math.PI * 2;
  const groupCount = random.next() < 0.58 ? 3 : 2;
  const flowerCounts = allotFlowers(groupCount, random);
  const lean = 0.04 + random.next() * 0.03;
  const stem = addBranch(graph, {
    id: graph.rootBranchId,
    label: "spray stem",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      16,
      vec3(Math.cos(azimuth) * lean, 1, Math.sin(azimuth) * lean * 0.7),
      vec3(0.05 + random.next() * 0.03, -0.012, (random.next() - 0.5) * 0.05),
    ),
    radius: 0.026,
    stiffness: BLOSSOM_SPRAY_RESPONSE.stem,
  });

  const stations = groupCount === 3 ? [0.28, 0.52, 0.76] : [0.34, 0.68];
  flowerCounts.forEach((flowerCount, groupIndex) => {
    const fraction = Math.min(0.84, Math.max(0.24, stations[groupIndex]! + (random.next() - 0.5) * 0.016));
    const spin = azimuth + groupIndex * (Math.PI * 2 / groupCount) + (random.next() - 0.5) * 0.18;
    const lateralLength = lateralLengthFor(flowerCount) + random.next() * 0.06;
    const parentDistance = stem.activeLength * fraction;
    const anchor = sampleBranch(stem, parentDistance);
    const side = basisFor(anchor.tangent, spin);
    const lateral = addBranch(graph, {
      id: `${id}:group-${groupIndex + 1}`,
      label: "flower group",
      kind: "lateral",
      parentId: stem.id,
      parentDistance,
      points: risingArm(anchor.position, lateralLength, anchor.tangent, side),
      radius: 0.015,
      stiffness: BLOSSOM_SPRAY_RESPONSE.lateral,
    });

    const fractions = flowerFractions(flowerCount);
    for (let flowerIndex = 0; flowerIndex < flowerCount; flowerIndex += 1) {
      const stalkDistance = lateral.activeLength * fractions[flowerIndex]!;
      const stalkAnchor = sampleBranch(lateral, stalkDistance);
      const flank = flowerIndex % 2 === 0 ? 1 : -1;
      const stalkSpin = flank * (1.2 + random.next() * 0.12);
      const stalkDirection = directionFromParent(stalkAnchor.tangent, stalkSpin, 0.58, 0.75);
      const stalkSide = basisFor(stalkAnchor.tangent, stalkSpin);
      const pedicel = addBranch(graph, {
        id: `${id}:stalk-${groupIndex + 1}-${flowerIndex + 1}`,
        label: "flower stalk",
        kind: "pedicel",
        parentId: lateral.id,
        parentDistance: stalkDistance,
        points: makeChain(
          stalkAnchor.position,
          0.32 + random.next() * 0.12,
          4,
          stalkDirection,
          add(scale(stalkSide, 0.14), vec3(0, 0.04, 0)),
        ),
        radius: 0.011,
        stiffness: BLOSSOM_SPRAY_RESPONSE.stalk,
      });
      const organId = `${id}:bloom-${groupIndex + 1}-${flowerIndex + 1}`;
      graph.organs.set(organId, {
        id: organId,
        kind: "bloom",
        branchId: pedicel.id,
        distance: pedicel.activeLength,
        spin: (random.next() - 0.5) * 0.4,
        scale: (flowerIndex === flowerCount - 1 ? 0.82 : 0.94) + random.next() * 0.13,
        active: true,
      });
    }
  });

  return graph;
}

/** Four, five, or six flowers, with every group carrying at least one. */
function allotFlowers(groupCount: number, random: Mulberry32): number[] {
  const total = 4 + Math.floor(random.next() * 3);
  if (groupCount === 2) {
    if (total === 4) return [2, 2];
    if (total === 6) return [3, 3];
    return random.next() < 0.5 ? [3, 2] : [2, 3];
  }
  if (total === 4) {
    const heavy = Math.floor(random.next() * 3);
    return [0, 1, 2].map((index) => index === heavy ? 2 : 1);
  }
  if (total === 5) {
    const light = Math.floor(random.next() * 3);
    return [0, 1, 2].map((index) => index === light ? 1 : 2);
  }
  return [2, 2, 2];
}

function lateralLengthFor(flowerCount: number): number {
  if (flowerCount === 1) return 1.35;
  if (flowerCount === 2) return 2.15;
  return 2.85;
}

function flowerFractions(flowerCount: number): readonly number[] {
  if (flowerCount === 1) return [0.74];
  if (flowerCount === 2) return [0.3, 0.86];
  return [0.24, 0.54, 0.86];
}
