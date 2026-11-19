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

/**
 * Optional visible-stem skin. Radius and tone are functions of stock material
 * distance (see stemShape.ts), so bending never changes them and a cut never
 * re-tapers the stock that remains. Topology is unchanged: the same rings,
 * facets and caps as a uniform tube.
 */
export interface TubeSkin {
  /** Stock material distance of each point from the branch's own base. */
  readonly distances: readonly number[];
  radius(distance: number, angle: number): number;
  tone(distance: number): readonly [number, number, number];
  /** Far end: a fresh pale cut face, the plant's own closed end, or a growing point. */
  readonly endCap: "cut" | "closed" | "point";
  /** For a growing point: how far the cap reaches past the last ring, in ring radii. */
  readonly tipReach?: number;
}

function tubeData(
  points: readonly Vec3[],
  baseRadius: number,
  referenceNormal: Vec3,
  radialSegments = DEFAULT_RADIAL_SEGMENTS,
  capEnds = false,
  skin?: TubeSkin,
) {
  const tangents = pointTangents(points);
  const normalsAtPoints = transportedNormals(tangents, referenceNormal);
  const vertexCount = points.length * radialSegments + (capEnds ? 2 * (radialSegments + 1) : 0);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  let offset = 0;
  // Ring centres stay exactly on the graph's points; a skin changes only radius and tone.
  const centers = points.map((plainPoint) => toThree(plainPoint));
  points.forEach((_plainPoint, pointIndex) => {
    const point = centers[pointIndex];
    const tangent = tangents[pointIndex];
    const normal = normalsAtPoints[pointIndex];
    const binormal = tangent.clone().cross(normal).normalize();
    // Branch.radius is the only persisted radial material property. Without a
    // skin the tube stays uniform. A skin tapers by stock distance, so a prune
    // preview or commit never re-tapers untouched proximal stock.
    const distance = skin?.distances[pointIndex] ?? 0;
    const tint = skin?.tone(distance);

    for (let radial = 0; radial < radialSegments; radial += 1) {
      const angle = (radial / radialSegments) * Math.PI * 2;
      const surfaceNormal = normal.clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(binormal, Math.sin(angle))
        .normalize();
      const radius = skin ? Math.max(1e-4, skin.radius(distance, angle)) : baseRadius;
      const vertex = point.clone().addScaledVector(surfaceNormal, radius);
      // Longitudinal tone stays in the material frame; neither pruning nor a
      // changed number of points re-scales or re-seeds the remaining surface.
      const tone = 0.94 + 0.06 * Math.cos(angle * 3);
      colors.set(tint
        ? [tone * tint[0], tone * 0.99 * tint[1], tone * 0.96 * tint[2]]
        : [tone, tone * 0.99, tone * 0.96], offset);
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

  const indexCount = Math.max(0, points.length - 1) * radialSegments * 6 + (capEnds ? radialSegments * 6 : 0);
  const IndexArray = vertexCount > 65_535 ? Uint32Array : Uint16Array;
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
      indices[indexOffset++] = b;
      indices[indexOffset++] = c;
      indices[indexOffset++] = b;
      indices[indexOffset++] = d;
      indices[indexOffset++] = c;
    }
  }

  if (capEnds) {
    for (let end = 0; end < 2; end += 1) {
      const pointIndex = end === 0 ? 0 : points.length - 1;
      const center = points.length * radialSegments + end * (radialSegments + 1);
      const point = centers[pointIndex];
      const normal = tangents[pointIndex].clone().multiplyScalar(end === 0 ? -1 : 1);
      // The base and any cut show a pale fresh face. An uncut end keeps its own
      // stem colour, and a growing point closes slightly beyond the last ring.
      const own = end === 1 && skin && skin.endCap !== "cut";
      const ringColor = own ? colors.subarray(pointIndex * radialSegments * 3, pointIndex * radialSegments * 3 + 3) : null;
      let reach = 0;
      if (own && skin.endCap === "point") {
        for (let radial = 0; radial < radialSegments; radial += 1) {
          const source = (pointIndex * radialSegments + radial) * 3;
          reach += Math.hypot(positions[source] - point.x, positions[source + 1] - point.y, positions[source + 2] - point.z);
        }
        reach = (reach / radialSegments) * (skin.tipReach ?? 1.2);
      }
      positions.set([point.x + normal.x * reach, point.y + normal.y * reach, point.z + normal.z * reach], center * 3);
      normals.set(normal.toArray(), center * 3);
      colors.set(ringColor ? [ringColor[0] * 1.04, ringColor[1] * 1.04, ringColor[2] * 1.02] : [1.6, 1.38, 1.12], center * 3);
      for (let radial = 0; radial < radialSegments; radial += 1) {
        const vertex = center + 1 + radial;
        const source = (pointIndex * radialSegments + radial) * 3;
        positions.set(positions.subarray(source, source + 3), vertex * 3);
        normals.set(normal.toArray(), vertex * 3);
        colors.set(ringColor ? [ringColor[0], ringColor[1], ringColor[2]] : [1.25, 1.12, 0.95], vertex * 3);
        const next = center + 1 + (radial + 1) % radialSegments;
        indices[indexOffset++] = center;
        indices[indexOffset++] = end === 0 ? next : vertex;
        indices[indexOffset++] = end === 0 ? vertex : next;
      }
    }
  }

  return { positions, normals, colors, indices };
}

function updateAttribute(
  geometry: THREE.BufferGeometry,
  name: "position" | "normal" | "color",
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
  capEnds = false,
  skin?: TubeSkin,
) {
  const safePoints = points.length >= 2 ? points : [points[0], points[0]].filter(Boolean) as Vec3[];
  const fittedSkin = skin && skin.distances.length === safePoints.length ? skin : undefined;
  const data = safePoints.length < 2
    ? { positions: new Float32Array(), normals: new Float32Array(), colors: new Float32Array(), indices: new Uint16Array() }
    : tubeData(safePoints, baseRadius, referenceNormal, radialSegments, capEnds, fittedSkin);
  const existingIndex = geometry.getIndex();
  const attributesFit = ["position", "normal", "color"].every(name => {
    const attribute = geometry.getAttribute(name);
    return attribute instanceof THREE.BufferAttribute && attribute.array.length === data.positions.length;
  });
  const indexFits = existingIndex?.array.length === data.indices.length
    && existingIndex.array.constructor === data.indices.constructor;
  const topology = `${safePoints.length}:${radialSegments}:${capEnds}`;
  // A disposed BufferGeometry can be reused. Free every prior GPU binding
  // before replacing any arrays, as in the broad-blade geometry path.
  if ((!attributesFit || !indexFits) && (Object.keys(geometry.attributes).length || existingIndex)) geometry.dispose();
  updateAttribute(geometry, "position", data.positions);
  updateAttribute(geometry, "normal", data.normals);
  updateAttribute(geometry, "color", data.colors);
  if (!indexFits) {
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  } else if (geometry.userData.tubeTopology !== topology) {
    // Equal lengths need not imply equal topology (e.g. changed facet count).
    existingIndex!.array.set(data.indices);
    existingIndex!.needsUpdate = true;
  }
  geometry.userData.tubeTopology = topology;
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
  const existing = geometry.getAttribute("position");
  if (existing && (!(existing instanceof THREE.BufferAttribute) || existing.array.length !== positions.length)) geometry.dispose();
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
  // Stock distance of every returned point, for skins on either side of the cut.
  const proximalDistances: number[] = [0];
  const distalDistances: number[] = [];
  let cursor = 0;

  for (let index = 0; index < branch.restLengths.length; index += 1) {
    const segmentLength = branch.restLengths[index];
    const segmentEnd = cursor + segmentLength;
    const start = branch.points[index];
    const end = branch.points[index + 1];

    if (segmentEnd < distance - EPSILON) {
      proximal.push({ ...end });
      proximalDistances.push(segmentEnd);
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
      proximalDistances.push(distance);
    }
    distal.push(cutPoint);
    distalDistances.push(distance);
    if (t < 1 - EPSILON) { distal.push({ ...end }); distalDistances.push(segmentEnd); }
    let tailDistance = segmentEnd;
    for (let tail = index + 2; tail < branch.points.length; tail += 1) {
      tailDistance += branch.restLengths[tail - 1];
      distal.push({ ...branch.points[tail] });
      distalDistances.push(tailDistance);
    }
    break;
  }

  return { proximal, distal, proximalDistances, distalDistances };
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
