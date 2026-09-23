import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { BERRY_TWIG_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const BERRY_TWIG_VERSION = "berry-twig-v1" as const;

/**
 * A restrained woody twig with two or three short side clusters. Each cluster
 * is one lateral. Each berry is one short pedicel and one berry organ at that
 * pedicel's tip. Cutting the pedicel removes that berry. Cutting the lateral
 * removes its descendant stems and berries through the ordinary distal plan.
 * The other clusters and the wood stay the same material. Generic, not a species.
 * Randomness is consumed only during construction.
 */
export function createBerryTwig(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: BERRY_TWIG_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:wood`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? 1 : -1;
  const azimuth = random.next() * Math.PI * 2;
  const length = 4.55 + random.next() * 0.32;
  const lean = 0.1 + random.next() * 0.05;
  const clusterCount = random.next() < 0.62 ? 3 : 2;
  const berryCounts = allotBerries(clusterCount, random);
  const wood = addBranch(graph, {
    id: graph.rootBranchId,
    label: "woody twig",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      16,
      vec3(hand * lean * 0.55, 1, (random.next() - 0.5) * 0.08),
      vec3(hand * (0.08 + random.next() * 0.04), -0.02, (random.next() - 0.5) * 0.06),
    ),
    radius: 0.052,
    stiffness: BERRY_TWIG_RESPONSE.wood,
  });

  const stations = clusterCount === 3 ? [0.26, 0.5, 0.74] : [0.36, 0.7];
  berryCounts.forEach((berryCount, clusterIndex) => {
    const fraction = Math.min(0.82, Math.max(0.22, stations[clusterIndex]! + (random.next() - 0.5) * 0.02));
    const spin = azimuth + clusterIndex * (Math.PI * 2 / clusterCount) + (random.next() - 0.5) * 0.22;
    const lateralLength = (berryCount === 4 ? 0.92 : 0.74) + random.next() * 0.06;
    const parentDistance = wood.activeLength * fraction;
    const anchor = sampleBranch(wood, parentDistance);
    const direction = directionFromParent(anchor.tangent, spin, 0.9, 0.38);
    const side = basisFor(anchor.tangent, spin);
    const lateral = addBranch(graph, {
      id: `${id}:cluster-${clusterIndex + 1}`,
      label: "berry cluster",
      kind: "lateral",
      parentId: wood.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        lateralLength,
        6,
        direction,
        add(scale(side, 0.04), vec3(0, -0.05, 0)),
      ),
      radius: 0.022,
      stiffness: BERRY_TWIG_RESPONSE.cluster,
    });

    const fractions = berryFractions(berryCount);
    for (let berryIndex = 0; berryIndex < berryCount; berryIndex += 1) {
      const stemDistance = lateral.activeLength * fractions[berryIndex]!;
      const stemAnchor = sampleBranch(lateral, stemDistance);
      const berrySpin = spin + (berryIndex / berryCount) * Math.PI * 2 + (random.next() - 0.5) * 0.28;
      const stemDirection = directionFromParent(stemAnchor.tangent, berrySpin, 0.97, 0.16);
      const stemSide = basisFor(stemAnchor.tangent, berrySpin);
      const pedicel = addBranch(graph, {
        id: `${id}:stem-${clusterIndex + 1}-${berryIndex + 1}`,
        label: "berry stem",
        kind: "pedicel",
        parentId: lateral.id,
        parentDistance: stemDistance,
        points: makeChain(
          stemAnchor.position,
          0.18 + random.next() * 0.05,
          3,
          stemDirection,
          add(scale(stemSide, 0.02), vec3(0, -0.03, 0)),
        ),
        radius: 0.009,
        stiffness: BERRY_TWIG_RESPONSE.stem,
      });
      const organId = `${id}:berry-${clusterIndex + 1}-${berryIndex + 1}`;
      graph.organs.set(organId, {
        id: organId,
        kind: "berry",
        branchId: pedicel.id,
        distance: pedicel.activeLength,
        spin: (random.next() - 0.5) * 0.5,
        scale: 0.9 + random.next() * 0.16,
        active: true,
      });
    }
  });

  return graph;
}

/** Three or four berries on every cluster. Two clusters stay at six or seven; three stay at nine or ten. */
function allotBerries(clusterCount: number, random: Mulberry32): number[] {
  if (clusterCount === 2) {
    const roll = random.next();
    if (roll < 0.4) return [3, 3];
    return roll < 0.7 ? [4, 3] : [3, 4];
  }
  const heavy = random.next() < 0.55 ? Math.floor(random.next() * 3) : -1;
  return [0, 1, 2].map((index) => index === heavy ? 4 : 3);
}

function berryFractions(berryCount: number): readonly number[] {
  if (berryCount === 4) return [0.4, 0.58, 0.76, 0.94];
  return [0.48, 0.72, 0.94];
}
