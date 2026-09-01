import { cloneVec3 } from "./math.ts";
import { isSupportedGeneratorVersion } from "./materialCatalog.ts";
import {
  SCHEMA_VERSION,
  type Branch,
  type CanonicalBranch,
  type CanonicalOrgan,
  type CanonicalPlantGraph,
  type Organ,
  type PlantGraph,
} from "./types.ts";

const canonicalBranch = (branch: Branch): CanonicalBranch => ({
  id: branch.id,
  label: branch.label,
  kind: branch.kind,
  parentId: branch.parentId,
  parentDistance: branch.parentDistance,
  points: branch.points.map(cloneVec3),
  restLengths: [...branch.restLengths],
  activeLength: branch.activeLength,
  radius: branch.radius,
  stiffness: branch.stiffness,
  referenceNormal: cloneVec3(branch.referenceNormal),
  active: branch.active,
});

const canonicalOrgan = (organ: Organ): CanonicalOrgan => ({
  id: organ.id,
  kind: organ.kind,
  branchId: organ.branchId,
  distance: organ.distance,
  spin: organ.spin,
  scale: organ.scale,
  active: organ.active,
});

export const toCanonicalPlantGraph = (graph: PlantGraph): CanonicalPlantGraph => {
  if (!isSupportedGeneratorVersion(graph.generatorVersion)) {
    throw new TypeError(`Unsupported generatorVersion ${graph.generatorVersion}`);
  }
  return {
    schemaVersion: graph.schemaVersion,
    generatorVersion: graph.generatorVersion,
    id: graph.id,
    seed: graph.seed >>> 0,
    rootBranchId: graph.rootBranchId,
    branches: [...graph.branches.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(canonicalBranch),
    organs: [...graph.organs.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(canonicalOrgan),
  };
};

export const serializePlantGraph = (graph: PlantGraph, space?: number): string =>
  JSON.stringify(toCanonicalPlantGraph(graph), null, space);

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value as Record<string, unknown>;
};

const asNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
};

const asString = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  return value;
};

const asBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean`);
  return value;
};

const branchKinds = new Set(["trunk", "lateral", "twig", "petiole", "pedicel"]);
const organKinds = new Set(["leaf", "bloom", "bud"]);

const decodeVec3 = (value: unknown, label: string) => {
  const record = asRecord(value, label);
  return {
    x: asNumber(record.x, `${label}.x`),
    y: asNumber(record.y, `${label}.y`),
    z: asNumber(record.z, `${label}.z`),
  };
};

const decodeBranch = (value: unknown, index: number): Branch => {
  const record = asRecord(value, `branches[${index}]`);
  const parentId = record.parentId;
  if (parentId !== null && typeof parentId !== "string") throw new TypeError(`branches[${index}].parentId must be string or null`);
  if (!Array.isArray(record.points) || !Array.isArray(record.restLengths)) {
    throw new TypeError(`branches[${index}] points/restLengths must be arrays`);
  }
  const kind = asString(record.kind, `branches[${index}].kind`) as Branch["kind"];
  if (!branchKinds.has(kind)) throw new TypeError(`branches[${index}].kind is unsupported`);
  return {
    id: asString(record.id, `branches[${index}].id`),
    label: asString(record.label, `branches[${index}].label`),
    kind,
    parentId,
    parentDistance: asNumber(record.parentDistance, `branches[${index}].parentDistance`),
    points: record.points.map((point, pointIndex) => decodeVec3(point, `branches[${index}].points[${pointIndex}]`)),
    restLengths: record.restLengths.map((length, lengthIndex) => asNumber(length, `branches[${index}].restLengths[${lengthIndex}]`)),
    activeLength: asNumber(record.activeLength, `branches[${index}].activeLength`),
    radius: asNumber(record.radius, `branches[${index}].radius`),
    stiffness: asNumber(record.stiffness, `branches[${index}].stiffness`),
    referenceNormal: decodeVec3(record.referenceNormal, `branches[${index}].referenceNormal`),
    active: asBoolean(record.active, `branches[${index}].active`),
  };
};

const decodeOrgan = (value: unknown, index: number): Organ => {
  const record = asRecord(value, `organs[${index}]`);
  const kind = asString(record.kind, `organs[${index}].kind`) as Organ["kind"];
  if (!organKinds.has(kind)) throw new TypeError(`organs[${index}].kind is unsupported`);
  return {
    id: asString(record.id, `organs[${index}].id`),
    kind,
    branchId: asString(record.branchId, `organs[${index}].branchId`),
    distance: asNumber(record.distance, `organs[${index}].distance`),
    spin: asNumber(record.spin, `organs[${index}].spin`),
    scale: asNumber(record.scale, `organs[${index}].scale`),
    active: asBoolean(record.active, `organs[${index}].active`),
  };
};

export const fromCanonicalPlantGraph = (value: unknown): PlantGraph => {
  const record = asRecord(value, "plant graph");
  if (record.schemaVersion !== SCHEMA_VERSION) throw new TypeError(`Unsupported schemaVersion ${String(record.schemaVersion)}`);
  const generatorVersion = asString(record.generatorVersion, "generatorVersion");
  if (!isSupportedGeneratorVersion(generatorVersion)) {
    throw new TypeError(`Unsupported generatorVersion ${generatorVersion}`);
  }
  if (!Array.isArray(record.branches) || !Array.isArray(record.organs)) {
    throw new TypeError("branches and organs must be arrays");
  }
  const branches = record.branches.map(decodeBranch);
  const organs = record.organs.map(decodeOrgan);
  if (new Set(branches.map(({ id }) => id)).size !== branches.length) throw new TypeError("branch IDs must be unique");
  if (new Set(organs.map(({ id }) => id)).size !== organs.length) throw new TypeError("organ IDs must be unique");
  return {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion,
    id: asString(record.id, "id"),
    seed: asNumber(record.seed, "seed") >>> 0,
    rootBranchId: asString(record.rootBranchId, "rootBranchId"),
    branches: new Map(branches.map((branch) => [branch.id, branch])),
    organs: new Map(organs.map((organ) => [organ.id, organ])),
  };
};

export const deserializePlantGraph = (input: string | unknown): PlantGraph =>
  fromCanonicalPlantGraph(typeof input === "string" ? JSON.parse(input) : input);
