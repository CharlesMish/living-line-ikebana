import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { FERN_FROND_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const FERN_FROND_V2_VERSION = "fern-frond-v2" as const;

// Opposing feathers are slightly staggered, then increasingly close toward the
// tip. These authored proportions define the silhouette; jitter is secondary.
const PINNA_STATIONS = [0.29, 0.33, 0.46, 0.495, 0.625, 0.655, 0.765, 0.795, 0.885, 0.915];
const PINNA_SCALES = [0.76, 0.81, 0.94, 0.88, 0.77, 0.73, 0.56, 0.51, 0.31, 0.27];

/**
 * A fine fern-like frond. Ten staggered pinnae taper toward a curved tip.
 * Each pinna is one stalk and one divided leaflet, so a cut removes that
 * feather rather than a swarm of pinnules. Generic study, not a named species.
 * Randomness is consumed only during construction. Aim, bend, and prune stay
 * shared. The rachis is the only bendable branch.
 */
export function createFernFrondV2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: FERN_FROND_V2_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:rachis`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  // Aim has no axial roll. Keep the feather's plane near the front view.
  const azimuth = (random.next() - 0.5) * 0.5;
  const length = 3.65 + random.next() * 0.22;
  const rachis = addBranch(graph, {
    id: graph.rootBranchId,
    label: "frond rachis",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      16,
      vec3(hand * 0.04, 1, 0.015),
      vec3(hand * 0.3, -0.05, 0.09),
    ),
    radius: 0.027,
    stiffness: FERN_FROND_RESPONSE.rachis,
  });

  for (let index = 0; index < PINNA_STATIONS.length; index += 1) {
    const fraction = PINNA_STATIONS[index]! + (random.next() - 0.5) * 0.01;
    const parentDistance = rachis.activeLength * fraction;
    const anchor = sampleBranch(rachis, parentDistance);
    const sideSign = index % 2 === 0 ? 1 : -1;
    const spin = azimuth + sideSign * (Math.PI / 2 + 0.1 + random.next() * 0.12);
    const side = basisFor(anchor.tangent, spin);
    const direction = normalize(add(
      add(scale(side, 0.92), scale(anchor.tangent, 0.18 + fraction * 0.48)),
      vec3(0, 0.06, 0),
    ));
    const stalk = addBranch(graph, {
      id: `${id}:pinna-${index + 1}`,
      label: "pinna stalk",
      kind: "petiole",
      parentId: rachis.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        0.065 + PINNA_SCALES[index]! * 0.055,
        3,
        direction,
        scale(anchor.tangent, -0.04),
      ),
      radius: 0.01,
      stiffness: FERN_FROND_RESPONSE.stalk,
    });
    const organId = `${id}:pinna-blade-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.22,
      scale: PINNA_SCALES[index]! * (0.96 + random.next() * 0.08),
      active: true,
    });
  }

  return graph;
}
