import type { Vec3 } from "./math.ts";

export const SCHEMA_VERSION = 1 as const;
export const GENERATOR_VERSION = "one-branch-v1" as const;

export type BranchKind = "trunk" | "lateral" | "twig" | "petiole" | "pedicel";
export type OrganKind = "leaf" | "bloom" | "bud";

export interface Branch {
  id: string;
  label: string;
  kind: BranchKind;
  parentId: string | null;
  parentDistance: number;
  points: Vec3[];
  restLengths: number[];
  activeLength: number;
  radius: number;
  stiffness: number;
  referenceNormal: Vec3;
  active: boolean;
}

export interface Organ {
  id: string;
  kind: OrganKind;
  branchId: string;
  distance: number;
  spin: number;
  scale: number;
  active: boolean;
}

export interface PlantGraph {
  schemaVersion: typeof SCHEMA_VERSION;
  generatorVersion: typeof GENERATOR_VERSION;
  id: string;
  seed: number;
  rootBranchId: string;
  branches: Map<string, Branch>;
  organs: Map<string, Organ>;
}

export interface CanonicalBranch extends Omit<Branch, "points" | "referenceNormal"> {
  points: Vec3[];
  referenceNormal: Vec3;
}

export interface CanonicalOrgan extends Organ {}

export interface CanonicalPlantGraph {
  schemaVersion: typeof SCHEMA_VERSION;
  generatorVersion: typeof GENERATOR_VERSION;
  id: string;
  seed: number;
  rootBranchId: string;
  branches: CanonicalBranch[];
  organs: CanonicalOrgan[];
}

export interface BranchSample {
  position: Vec3;
  tangent: Vec3;
  segmentIndex: number;
  segmentT: number;
  distance: number;
}

export interface MaterialFrame extends BranchSample {
  normal: Vec3;
  binormal: Vec3;
}

export interface CutPlan {
  branchId: string;
  distance: number;
  removedBranchIds: string[];
  removedOrganIds: string[];
}

export interface BendRequest {
  branchId: string;
  stationDistance: number;
  target: Vec3;
}

export interface ValidationIssue {
  path: string;
  message: string;
}
