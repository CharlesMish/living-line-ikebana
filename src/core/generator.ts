import { segmentLengths, sampleBranch } from "./arcLength.ts";
import { generatorReferenceNormal } from "./frames.ts";
import {
  X_AXIS,
  Y_AXIS,
  add,
  addScaled,
  cloneVec3,
  cross,
  normalize,
  scale,
  subtract,
  vec3,
} from "./math.ts";
import type { Vec3 } from "./math.ts";
import { Mulberry32 } from "./prng.ts";
import {
  GENERATOR_VERSION,
  SCHEMA_VERSION,
  type Branch,
  type BranchKind,
  type OrganKind,
  type PlantGraph,
} from "./types.ts";

const makeChain = (
  base: Vec3,
  length: number,
  segments: number,
  direction: Vec3,
  curve: Vec3,
): Vec3[] => {
  const points = [cloneVec3(base)];
  const step = length / segments;
  for (let index = 1; index <= segments; index += 1) {
    const t = (index - 0.5) / segments;
    const envelope = Math.sin(Math.PI * t) * 0.66 + t * t * 0.34;
    const tangent = normalize(addScaled(direction, curve, envelope));
    points.push(addScaled(points[index - 1], tangent, step));
  }
  return points;
};

interface BranchInput {
  id: string;
  label: string;
  kind: BranchKind;
  parentId: string | null;
  parentDistance: number;
  points: Vec3[];
  radius: number;
  stiffness: number;
}

const addBranch = (plant: PlantGraph, input: BranchInput): Branch => {
  const restLengths = segmentLengths(input.points);
  const firstTangent = normalize(subtract(input.points[1], input.points[0]), Y_AXIS);
  const branch: Branch = {
    ...input,
    restLengths,
    activeLength: restLengths.reduce((sum, value) => sum + value, 0),
    referenceNormal: generatorReferenceNormal(firstTangent),
    active: true,
  };
  plant.branches.set(branch.id, branch);
  return branch;
};

const basisFor = (tangentInput: Vec3, spin: number): Vec3 => {
  const tangent = normalize(tangentInput);
  const reference = Math.abs(tangent.y) < 0.9 ? Y_AXIS : X_AXIS;
  const side = normalize(cross(tangent, reference));
  const forward = normalize(cross(side, tangent));
  return normalize(add(scale(side, Math.cos(spin)), scale(forward, Math.sin(spin))));
};

export const createFloweringBranch = (id: string, seed: number, base: Vec3): PlantGraph => {
  const random = new Mulberry32(seed);
  const plant: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:trunk`,
    branches: new Map(),
    organs: new Map(),
  };

  const trunk = addBranch(plant, {
    id: `${id}:trunk`,
    label: "main branch",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(base, 6.15, 18, vec3(-0.1, 0.994, 0.035), vec3(-0.21, -0.01, 0.12)),
    radius: 0.105,
    stiffness: 0.72,
  });

  const addChild = (
    suffix: string,
    label: string,
    kind: BranchKind,
    parent: Branch,
    parentDistance: number,
    length: number,
    direction: Vec3,
    curve: Vec3,
    radius: number,
    stiffness: number,
    segments = 8,
  ): Branch => {
    const anchor = sampleBranch(parent, parentDistance);
    const side = basisFor(anchor.tangent, random.next() * Math.PI * 2);
    const worldDirection = normalize(add(
      add(scale(anchor.tangent, direction.y), scale(side, direction.x)),
      vec3(0, 0, direction.z),
    ));
    return addBranch(plant, {
      id: `${id}:${suffix}`,
      label,
      kind,
      parentId: parent.id,
      parentDistance,
      points: makeChain(anchor.position, length, segments, worldDirection, curve),
      radius,
      stiffness,
    });
  };

  const left = addChild(
    "lateral-a", "lower side branch", "lateral", trunk, 2.15, 2.35,
    vec3(-0.94, 0.48, 0.1), vec3(-0.15, 0.05, 0.12), 0.064, 0.52, 9,
  );
  const right = addChild(
    "lateral-b", "upper side branch", "lateral", trunk, 3.62, 2.2,
    vec3(0.92, 0.5, -0.08), vec3(0.12, 0.02, -0.12), 0.06, 0.5, 9,
  );
  const crown = addChild(
    "lateral-c", "crown twig", "twig", trunk, 4.78, 1.42,
    vec3(-0.62, 0.76, -0.12), vec3(-0.08, 0.02, 0.08), 0.044, 0.38, 7,
  );
  const leftTwig = addChild(
    "twig-a", "small twig", "twig", left, 1.15, 1.2,
    vec3(0.48, 0.84, 0.12), vec3(0.08, -0.02, 0.06), 0.038, 0.34, 6,
  );

  const addOrganBranch = (
    suffix: string,
    kind: "petiole" | "pedicel",
    parent: Branch,
    parentDistance: number,
    organKind: OrganKind,
    spin: number,
    organScale: number,
  ): void => {
    const length = kind === "pedicel" ? 0.46 : 0.34;
    const child = addChild(
      suffix,
      kind === "pedicel" ? "flower stalk" : "leaf stalk",
      kind,
      parent,
      parentDistance,
      length,
      vec3(Math.cos(spin) * 0.9, 0.38, Math.sin(spin) * 0.2),
      vec3(0, -0.05, 0),
      kind === "pedicel" ? 0.022 : 0.018,
      0.18,
      3,
    );
    plant.organs.set(`${id}:organ-${suffix}`, {
      id: `${id}:organ-${suffix}`,
      kind: organKind,
      branchId: child.id,
      distance: child.activeLength,
      spin,
      scale: organScale,
      active: true,
    });
  };

  addOrganBranch("leaf-1", "petiole", trunk, 1.42, "leaf", 0.25, 0.96);
  addOrganBranch("leaf-2", "petiole", trunk, 2.86, "leaf", 2.7, 1.08);
  addOrganBranch("leaf-3", "petiole", left, 0.7, "leaf", 0.4, 0.9);
  addOrganBranch("leaf-4", "petiole", left, 1.82, "leaf", 2.9, 1.02);
  addOrganBranch("leaf-5", "petiole", right, 0.62, "leaf", 0.1, 0.94);
  addOrganBranch("leaf-6", "petiole", right, 1.48, "leaf", 2.7, 1.0);
  addOrganBranch("leaf-7", "petiole", crown, 0.65, "leaf", 0.7, 0.86);
  addOrganBranch("bloom-1", "pedicel", leftTwig, 0.86, "bloom", 0.2, 1.0);
  addOrganBranch("bloom-2", "pedicel", right, 1.86, "bloom", 2.4, 0.86);
  addOrganBranch("bud-1", "pedicel", crown, 1.2, "bud", 1.4, 0.78);

  return plant;
};

export const successfulSeatIdentity = (ordinal: number): { id: string; seed: number } => {
  if (!Number.isInteger(ordinal) || ordinal < 1) throw new Error("Successful seat ordinal begins at 1");
  return { id: `plant-${ordinal}`, seed: (7301 + ordinal * 977) >>> 0 };
};

