import * as THREE from "three";

import type { Vec3 } from "../core/math.ts";
import type { Branch } from "../core/types.ts";

const EPSILON = 1e-8;
const DEFAULT_RADIAL_SEGMENTS = 7;

export const toThree = (value: Vec3): THREE.Vector3 =>
  new THREE.Vector3(value.x, value.y, value.z);

export const toVec3 = (value: THREE.Vector3): Vec3 => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

function deterministicNormal(tangent: THREE.Vector3) {
  const reference = Math.abs(tangent.y) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const normal = tangent.clone().cross(reference);
  if (normal.lengthSq() <= EPSILON) normal.set(0, 0, 1);
  return normal.normalize();
}

function pointTangents(points: readonly Vec3[]) {
  return points.map((_, index) => {
    const previous = toThree(points[Math.max(0, index - 1)]);
    const next = toThree(points[Math.min(points.length - 1, index + 1)]);
    const tangent = next.sub(previous);
    if (tangent.lengthSq() <= EPSILON) {
      const a = toThree(points[Math.max(0, Math.min(index, points.length - 2))]);
      const b = toThree(points[Math.max(1, Math.min(index + 1, points.length - 1))]);
      tangent.copy(b.sub(a));
    }
    return tangent.lengthSq() > EPSILON ? tangent.normalize() : new THREE.Vector3(0, 1, 0);
  });
}

function transportedNormals(
  tangents: readonly THREE.Vector3[],
  referenceNormal: Vec3,
) {
  const firstTangent = tangents[0];
  let normal = toThree(referenceNormal)
    .addScaledVector(firstTangent, -toThree(referenceNormal).dot(firstTangent));
  if (normal.lengthSq() <= EPSILON) normal = deterministicNormal(firstTangent);
  else normal.normalize();

  const result = [normal.clone()];
  for (let index = 1; index < tangents.length; index += 1) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      tangents[index - 1],
      tangents[index],
    );
    normal.applyQuaternion(rotation);
    normal.addScaledVector(tangents[index], -normal.dot(tangents[index]));
    if (normal.lengthSq() <= EPSILON) normal = deterministicNormal(tangents[index]);
    else normal.normalize();
    result.push(normal.clone());
  }
  return result;
}

function tubeData(
  points: readonly Vec3[],
  baseRadius: number,
  referenceNormal: Vec3,
  radialSegments = DEFAULT_RADIAL_SEGMENTS,
) {
  const tangents = pointTangents(points);
  const normalsAtPoints = transportedNormals(tangents, referenceNormal);
  const positions = new Float32Array(points.length * radialSegments * 3);
  const normals = new Float32Array(points.length * radialSegments * 3);

  let offset = 0;
  points.forEach((plainPoint, pointIndex) => {
    const point = toThree(plainPoint);
    const tangent = tangents[pointIndex];
    const normal = normalsAtPoints[pointIndex];
    const binormal = tangent.clone().cross(normal).normalize();
    // Branch.radius is the only persisted radial material property. Keeping it
    // constant avoids a prune preview/commit re-tapering untouched proximal
    // stock merely because the active point count changed.
    const radius = baseRadius;

    for (let radial = 0; radial < radialSegments; radial += 1) {
      const angle = (radial / radialSegments) * Math.PI * 2;
      const surfaceNormal = normal.clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(binormal, Math.sin(angle))
        .normalize();
      const vertex = point.clone().addScaledVector(surfaceNormal, radius);
      positions[offset] = vertex.x;
      normals[offset] = surfaceNormal.x;
      offset += 1;
      positions[offset] = vertex.y;
      normals[offset] = surfaceNormal.y;
      offset += 1;
      positions[offset] = vertex.z;
      normals[offset] = surfaceNormal.z;
      offset += 1;
    }
  });

  const indexCount = Math.max(0, points.length - 1) * radialSegments * 6;
  const IndexArray = points.length * radialSegments > 65_535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(indexCount);
  let indexOffset = 0;
  for (let row = 0; row < points.length - 1; row += 1) {
    for (let column = 0; column < radialSegments; column += 1) {
      const next = (column + 1) % radialSegments;
      const a = row * radialSegments + column;
      const b = row * radialSegments + next;
      const c = (row + 1) * radialSegments + column;
      const d = (row + 1) * radialSegments + next;
      indices[indexOffset++] = a;
      indices[indexOffset++] = c;
      indices[indexOffset++] = b;
      indices[indexOffset++] = b;
      indices[indexOffset++] = c;
      indices[indexOffset++] = d;
    }
  }

  return { positions, normals, indices };
}

function updateAttribute(
  geometry: THREE.BufferGeometry,
  name: "position" | "normal",
  values: Float32Array,
) {
  const existing = geometry.getAttribute(name);
  if (existing instanceof THREE.BufferAttribute && existing.array.length === values.length) {
    (existing.array as Float32Array).set(values);
    existing.needsUpdate = true;
    return;
  }
  geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
}

export function updateTubeGeometry(
  geometry: THREE.BufferGeometry,
  points: readonly Vec3[],
  baseRadius: number,
  referenceNormal: Vec3,
  radialSegments = DEFAULT_RADIAL_SEGMENTS,
) {
  const safePoints = points.length >= 2 ? points : [points[0], points[0]].filter(Boolean) as Vec3[];
  if (safePoints.length < 2) {
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute([], 3));
    geometry.setIndex([]);
    geometry.boundingSphere = new THREE.Sphere();
    return geometry;
  }

  const data = tubeData(safePoints, baseRadius, referenceNormal, radialSegments);
  updateAttribute(geometry, "position", data.positions);
  updateAttribute(geometry, "normal", data.normals);
  const existingIndex = geometry.getIndex();
  if (!existingIndex || existingIndex.array.length !== data.indices.length) {
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  }
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function updateLineGeometry(
  geometry: THREE.BufferGeometry,
  points: readonly Vec3[],
) {
  const positions = new Float32Array(points.length * 3);
  points.forEach((point, index) => {
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  });
  updateAttribute(geometry, "position", positions);
  geometry.computeBoundingSphere();
  return geometry;
}

function lerpPoint(start: Vec3, end: Vec3, t: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

/**
 * Presentation-only split used by prune preview. It does not alter the branch or
 * classify descendants; the authoritative CutPlan remains in the core.
 */
export function splitBranchAtMaterialDistance(branch: Branch, requestedDistance: number) {
  const distance = THREE.MathUtils.clamp(requestedDistance, 0, branch.activeLength);
  const proximal: Vec3[] = [{ ...branch.points[0] }];
  const distal: Vec3[] = [];
  let cursor = 0;

  for (let index = 0; index < branch.restLengths.length; index += 1) {
    const segmentLength = branch.restLengths[index];
    const segmentEnd = cursor + segmentLength;
    const start = branch.points[index];
    const end = branch.points[index + 1];

    if (segmentEnd < distance - EPSILON) {
      proximal.push({ ...end });
      cursor = segmentEnd;
      continue;
    }

    const t = segmentLength <= EPSILON
      ? 0
      : THREE.MathUtils.clamp((distance - cursor) / segmentLength, 0, 1);
    const cutPoint = lerpPoint(start, end, t);
    const prior = proximal[proximal.length - 1];
    if (Math.hypot(prior.x - cutPoint.x, prior.y - cutPoint.y, prior.z - cutPoint.z) > EPSILON) {
      proximal.push(cutPoint);
    }
    distal.push(cutPoint);
    if (t < 1 - EPSILON) distal.push({ ...end });
    for (let tail = index + 2; tail < branch.points.length; tail += 1) {
      distal.push({ ...branch.points[tail] });
    }
    break;
  }

  return { proximal, distal };
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
