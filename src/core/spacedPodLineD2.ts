import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, directionFromParent, makeChain } from "./generatorSupport.ts";
import { add, scale, vec3, type Vec3 } from "./math.ts";
import { BERRY_TWIG_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const SPACED_POD_LINE_D2_VERSION = "spaced-pod-line-d2-v1" as const;

/**
 * Spaced pod line: one open woody axis with three separated accent clusters.
 * Each accent is one short lateral carrying one or two berry stalks.
 * Generic structural study, not a species model.
 */
export function createSpacedPodLineD2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: SPACED_POD_LINE_D2_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:axis`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? 1 : -1;
  const azimuth = random.next() * Math.PI * 2;
  const axisLength = 5.02 + random.next() * 0.36;
  const axis = addBranch(graph, {
    id: graph.rootBranchId,
    label: "spaced pod axis",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      axisLength,
      18,
      vec3(hand * (0.082 + random.next() * 0.028), 1, (random.next() - 0.5) * 0.06),
      vec3(hand * (0.052 + random.next() * 0.03), -0.016, (random.next() - 0.5) * 0.045),
    ),
    radius: 0.049,
    stiffness: BERRY_TWIG_RESPONSE.wood,
  });

  const stations = [0.24, 0.53, 0.82];
  const clusterBerryCounts = chooseBerryCounts(random);
  for (let clusterIndex = 0; clusterIndex < stations.length; clusterIndex += 1) {
    const fraction = Math.min(0.87, Math.max(0.2, stations[clusterIndex]! + (random.next() - 0.5) * 0.018));
    const parentDistance = axis.activeLength * fraction;
    const spin = azimuth + clusterIndex * 2.04 + (random.next() - 0.5) * 0.2;
    const anchor = sampleBranch(axis, parentDistance);
    const direction = directionFromParent(anchor.tangent, spin, 0.86, 0.34);
    const side = basisFor(anchor.tangent, spin);
    const berryCount = clusterBerryCounts[clusterIndex]!;
    const lateralLength = 0.42 + berryCount * 0.075 + random.next() * 0.04;
    const lateral = addBranch(graph, {
      id: `${id}:accent-${clusterIndex + 1}`,
      label: "pod accent branch",
      kind: "lateral",
      parentId: axis.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        lateralLength,
        5,
        direction,
        add(scale(side, 0.03), vec3(0, -0.045, 0)),
      ),
      radius: 0.019,
      stiffness: BERRY_TWIG_RESPONSE.cluster,
    });
    const fractions = berryFractions(berryCount);
    for (let berryIndex = 0; berryIndex < berryCount; berryIndex += 1) {
      const stalkDistance = lateral.activeLength * fractions[berryIndex]!;
      const stalkAnchor = sampleBranch(lateral, stalkDistance);
      const berrySpin = spin + (berryIndex / Math.max(1, berryCount)) * Math.PI * 2 + (random.next() - 0.5) * 0.25;
      const stalkDirection = directionFromParent(stalkAnchor.tangent, berrySpin, 0.97, 0.12);
      const stalkSide = basisFor(stalkAnchor.tangent, berrySpin);
      const pedicel = addBranch(graph, {
        id: `${id}:stalk-${clusterIndex + 1}-${berryIndex + 1}`,
        label: "berry stalk",
        kind: "pedicel",
        parentId: lateral.id,
        parentDistance: stalkDistance,
        points: makeChain(
          stalkAnchor.position,
          0.145 + random.next() * 0.03,
          3,
          stalkDirection,
          add(scale(stalkSide, 0.018), vec3(0, -0.026, 0)),
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
        spin: (random.next() - 0.5) * 0.44,
        scale: 0.88 + random.next() * 0.14,
        active: true,
      });
    }
  }
  return graph;
}

function chooseBerryCounts(random: Mulberry32): readonly [number, number, number] {
  const heavy = Math.floor(random.next() * 3);
  const bonus = random.next() < 0.35 ? Math.floor(random.next() * 3) : -1;
  return [0, 1, 2].map((index) => {
    if (index === heavy || index === bonus) return 2;
    return 1;
  }) as [number, number, number];
}

function berryFractions(count: number): readonly number[] {
  if (count >= 2) return [0.63, 0.93];
  return [0.9];
}
