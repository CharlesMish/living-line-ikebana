import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { INDIGO_SPIRE_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const INDIGO_SPIRE_VERSION = "indigo-spire-v1" as const;

/** A generic salvia-inspired flowering line. Four spaced whorls hold three
 * small two-lipped corollas each. The axis is prunable between whorls without
 * discarding every flower. Every floret owns an ordinary independent pedicel. */
export function createIndigoSpire(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = { schemaVersion: SCHEMA_VERSION, generatorVersion: INDIGO_SPIRE_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stem`, branches: new Map(), organs: new Map() };
  const azimuth = random.next() * Math.PI * 2;
  const stem = addBranch(graph, { id: graph.rootBranchId, label: "indigo flowering axis", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: makeChain(base, 3.4 + random.next() * 0.17, 16,
      vec3(Math.cos(azimuth) * 0.045, 1, Math.sin(azimuth) * 0.045), vec3(0.055, -0.006, (random.next() - 0.5) * 0.07)),
    radius: 0.029, stiffness: INDIGO_SPIRE_RESPONSE.stem });
  for (let tier = 0; tier < 4; tier++) {
    const parentDistance = stem.activeLength * [0.42, 0.60, 0.78, 0.95][tier]!;
    const at = sampleBranch(stem, parentDistance);
    for (let floret = 0; floret < 3; floret++) {
      const spin = azimuth + floret * Math.PI * 2 / 3 + tier * 0.74;
      const stalk = addBranch(graph, { id: `${id}:stalk-${tier + 1}-${floret + 1}`, label: "indigo floret stalk", kind: "pedicel",
        parentId: stem.id, parentDistance,
        points: makeChain(at.position, 0.19 + random.next() * 0.035, 3,
          directionFromParent(at.tangent, spin, 0.95, 0.22), vec3(0, -0.035, 0)),
        radius: 0.008, stiffness: INDIGO_SPIRE_RESPONSE.stalk });
      const organId = `${id}:bloom-${tier + 1}-${floret + 1}`;
      graph.organs.set(organId, { id: organId, kind: "bloom", branchId: stalk.id, distance: stalk.activeLength,
        spin: (random.next() - 0.5) * 0.2, scale: 1.04 - tier * 0.08 + random.next() * 0.04, active: true });
    }
  }
  for (let index = 0; index < 2; index++) {
    const parentDistance = stem.activeLength * 0.24;
    const at = sampleBranch(stem, parentDistance);
    const stalk = addBranch(graph, { id: `${id}:leaf-stalk-${index + 1}`, label: "leaf stalk", kind: "petiole",
      parentId: stem.id, parentDistance,
      points: makeChain(at.position, 0.16, 3, directionFromParent(at.tangent, azimuth + index * Math.PI, 0.9, 0.2), vec3(0, -0.035, 0)),
      radius: 0.01, stiffness: INDIGO_SPIRE_RESPONSE.stalk });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, { id: organId, kind: "leaf", branchId: stalk.id, distance: stalk.activeLength,
      spin: 0, scale: 0.49 + random.next() * 0.04, active: true });
  }
  return graph;
}
