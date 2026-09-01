import { ATTACHMENT_TOLERANCE, sampleBranch } from "./arcLength.ts";
import { isSupportedGeneratorVersion } from "./materialCatalog.ts";
import { dot, length, subtract, distance } from "./math.ts";
import type { PlantGraph, ValidationIssue } from "./types.ts";

const issue = (issues: ValidationIssue[], path: string, message: string): void => {
  issues.push({ path, message });
};

export const validatePlantGraph = (graph: PlantGraph, tolerance = 1e-8): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const branchKinds = new Set(["trunk", "lateral", "twig", "petiole", "pedicel"]);
  const organKinds = new Set(["leaf", "bloom", "bud"]);
  if (graph.schemaVersion !== 1) issue(issues, "schemaVersion", "must be 1");
  if (!isSupportedGeneratorVersion(graph.generatorVersion)) {
    issue(issues, "generatorVersion", "must be a supported generator version");
  }
  if (!Number.isInteger(graph.seed) || graph.seed < 0 || graph.seed > 0xffffffff) {
    issue(issues, "seed", "must be a UInt32");
  }
  const root = graph.branches.get(graph.rootBranchId);
  if (!root) issue(issues, "rootBranchId", "must resolve to a branch");
  else {
    if (root.parentId !== null) issue(issues, "rootBranchId", "root branch must not have a parent");
    if (!root.active) issue(issues, "rootBranchId", "root branch must remain active");
  }

  for (const [key, branch] of graph.branches) {
    const path = `branches.${key}`;
    if (branch.id !== key) issue(issues, `${path}.id`, "must match its map key");
    if (!branchKinds.has(branch.kind)) issue(issues, `${path}.kind`, "is unsupported");
    if (branch.points.length !== branch.restLengths.length + 1) {
      issue(issues, `${path}.points`, "must have exactly one more point than rest lengths");
    }
    if (branch.points.length < 2) issue(issues, `${path}.points`, "must contain at least two material points");
    branch.restLengths.forEach((value, index) => {
      if (!(value > 0) || !Number.isFinite(value)) issue(issues, `${path}.restLengths.${index}`, "must be positive and finite");
      if (index + 1 < branch.points.length) {
        const actual = distance(branch.points[index], branch.points[index + 1]);
        if (Math.abs(actual - value) > tolerance * Math.max(1, value)) {
          issue(issues, `${path}.restLengths.${index}`, `does not match shaped segment (${actual})`);
        }
      }
    });
    const total = branch.restLengths.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - branch.activeLength) > tolerance * Math.max(1, total)) {
      issue(issues, `${path}.activeLength`, `must equal the rest-length sum (${total})`);
    }
    if (!(branch.stiffness >= 0 && branch.stiffness <= 1)) issue(issues, `${path}.stiffness`, "must be in [0, 1]");
    if (!(branch.radius > 0) || !Number.isFinite(branch.radius)) issue(issues, `${path}.radius`, "must be positive and finite");
    if (!Number.isFinite(branch.parentDistance)) issue(issues, `${path}.parentDistance`, "must be finite");
    branch.points.forEach((point, index) => {
      if (![point.x, point.y, point.z].every(Number.isFinite)) issue(issues, `${path}.points.${index}`, "must be finite");
    });
    if (branch.parentId !== null && !graph.branches.has(branch.parentId)) {
      issue(issues, `${path}.parentId`, "must resolve, including for inactive history");
    }
    if (branch.points.length >= 2) {
      const tangent = subtract(branch.points[1], branch.points[0]);
      const tangentLength = length(tangent);
      const normalLength = length(branch.referenceNormal);
      if (Math.abs(normalLength - 1) > tolerance) issue(issues, `${path}.referenceNormal`, "must be unit length");
      if (tangentLength > 0 && Math.abs(dot(tangent, branch.referenceNormal) / tangentLength) > tolerance) {
        issue(issues, `${path}.referenceNormal`, "must be perpendicular to the base tangent");
      }
    }

    if (branch.active && branch.parentId !== null) {
      const parent = graph.branches.get(branch.parentId);
      if (!parent?.active) {
        issue(issues, `${path}.parentId`, "active branch must have an active parent");
      } else {
        if (branch.parentDistance < -ATTACHMENT_TOLERANCE || branch.parentDistance > parent.activeLength + ATTACHMENT_TOLERANCE) {
          issue(issues, `${path}.parentDistance`, "active attachment lies outside active parent material");
        } else {
          const anchor = sampleBranch(parent, branch.parentDistance).position;
          if (distance(anchor, branch.points[0]) > tolerance) {
            issue(issues, `${path}.points.0`, "must coincide with the sampled parent attachment");
          }
        }
      }
    }
  }

  for (const [key, organ] of graph.organs) {
    const path = `organs.${key}`;
    if (organ.id !== key) issue(issues, `${path}.id`, "must match its map key");
    if (!organKinds.has(organ.kind)) issue(issues, `${path}.kind`, "is unsupported");
    if (![organ.distance, organ.spin, organ.scale].every(Number.isFinite)) issue(issues, path, "distance, spin, and scale must be finite");
    if (!(organ.scale > 0)) issue(issues, `${path}.scale`, "must be positive");
    const branch = graph.branches.get(organ.branchId);
    if (!branch) {
      issue(issues, `${path}.branchId`, "must resolve, including for inactive history");
      continue;
    }
    if (organ.active) {
      if (!branch.active) issue(issues, `${path}.branchId`, "active organ must have active support");
      if (organ.distance < -ATTACHMENT_TOLERANCE || organ.distance > branch.activeLength + ATTACHMENT_TOLERANCE) {
        issue(issues, `${path}.distance`, "active attachment lies outside active support material");
      }
    }
  }
  // Every record, including inactive identity history, remains part of the one
  // acyclic rooted topology. Active attachment bounds are checked above.
  for (const branch of graph.branches.values()) {
    const seen = new Set<string>();
    let cursor: typeof branch | undefined = branch;
    while (cursor && cursor.parentId !== null) {
      if (seen.has(cursor.id)) {
        issue(issues, `branches.${branch.id}.parentId`, "forms a parent cycle");
        break;
      }
      seen.add(cursor.id);
      cursor = graph.branches.get(cursor.parentId);
    }
    if (cursor && cursor.id !== graph.rootBranchId) {
      issue(issues, `branches.${branch.id}.parentId`, "does not resolve to the canonical root");
    }
  }
  return issues;
};

export const assertValidPlantGraph = (graph: PlantGraph, tolerance = 1e-8): void => {
  const issues = validatePlantGraph(graph, tolerance);
  if (issues.length) {
    throw new Error(`Invalid plant graph:\n${issues.map(({ path, message }) => `- ${path}: ${message}`).join("\n")}`);
  }
};
