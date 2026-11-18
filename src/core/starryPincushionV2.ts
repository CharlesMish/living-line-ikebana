import { sampleBranch } from "./arcLength.ts";
import { addBranch, directionFromParent, makeChain } from "./generatorSupport.ts";
import { addScaled, vec3, type Vec3 } from "./math.ts";
import { STARRY_PINCUSHION_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const STARRY_PINCUSHION_V2_VERSION = "starry-pincushion-v2" as const;

/** A wiry, bowed axis with two side sprays and one flowering continuation.
 * Sample tangents in the growing plane at equal stock-length intervals. */
function bowedAxis(base: Vec3, length: number, azimuth: number, sweep: number): Vec3[] {
  const points = [{ ...base }];
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16;
    const tilt = -0.18 + sweep * u * u;
    const side = Math.sin(tilt);
    points.push(addScaled(points[i], vec3(Math.cos(azimuth) * side, Math.cos(tilt), Math.sin(azimuth) * side), length / 16));
  }
  return points;
}

export function createStarryPincushionV2(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = { schemaVersion: SCHEMA_VERSION, generatorVersion: STARRY_PINCUSHION_V2_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stem`, branches: new Map(), organs: new Map() };
  const azimuth = random.next() * Math.PI * 2;
  const stem = addBranch(graph, { id: graph.rootBranchId, label: "starry pincushion stem", kind: "trunk",
    parentId: null, parentDistance: 0,
    points: bowedAxis(base, 2.65 + random.next() * .18, azimuth, .75 + random.next() * .24),
    radius: .021, stiffness: STARRY_PINCUSHION_RESPONSE.stem });
  for (let index = 0; index < 3; index++) {
    const terminal = index === 2;
    const parentDistance = stem.activeLength * (terminal ? 1 : [.38, .65][index]! + (random.next() - .5) * .045);
    const at = sampleBranch(stem, parentDistance);
    const spin = azimuth + index * 2.40 + (random.next() - .5) * .12;
    const arm = addBranch(graph, { id: `${id}:arm-${index + 1}`, label: "starry flowering arm", kind: "lateral",
      parentId: stem.id, parentDistance,
      points: makeChain(at.position, [.95, .79, .51][index]! + random.next() * .06, 7,
        terminal ? at.tangent : directionFromParent(at.tangent, spin, .94, .36),
        vec3(0, terminal ? .36 : .66, 0)),
      radius: .012, stiffness: STARRY_PINCUSHION_RESPONSE.arm });
    const end = sampleBranch(arm, arm.activeLength);
    const stalk = addBranch(graph, { id: `${id}:head-stalk-${index + 1}`, label: "starry head stalk", kind: "pedicel",
      parentId: arm.id, parentDistance: arm.activeLength,
      points: makeChain(end.position, .18 + random.next() * .035, 3, end.tangent, vec3(0, .08, 0)),
      radius: .009, stiffness: STARRY_PINCUSHION_RESPONSE.stalk });
    const organId = `${id}:head-${index + 1}`;
    graph.organs.set(organId, { id: organId, kind: "bloom", branchId: stalk.id, distance: stalk.activeLength,
      spin: (random.next() - .5) * .38, scale: 1 + random.next() * .09, active: true });
  }
  for (let index = 0; index < 2; index++) {
    const parentDistance = stem.activeLength * (.19 + index * .26);
    const at = sampleBranch(stem, parentDistance);
    const stalk = addBranch(graph, { id: `${id}:leaf-stalk-${index + 1}`, label: "divided leaf stalk", kind: "petiole",
      parentId: stem.id, parentDistance,
      points: makeChain(at.position, .23, 3, directionFromParent(at.tangent, azimuth + index * Math.PI, .94, .24), vec3(0, -.03, 0)),
      radius: .009, stiffness: STARRY_PINCUSHION_RESPONSE.stalk });
    const organId = `${id}:leaf-${index + 1}`;
    graph.organs.set(organId, { id: organId, kind: "leaf", branchId: stalk.id, distance: stalk.activeLength,
      spin: (random.next() - .5) * .18, scale: .31 + random.next() * .025, active: true });
  }
  return graph;
}
