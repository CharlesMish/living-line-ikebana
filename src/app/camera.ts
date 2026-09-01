import { add, clamp, cloneVec3, length, scale, subtract, type Vec3 } from "../core/index.ts";
import type { CanonicalView } from "../input/index.ts";

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
}

export const cloneCameraPose = (pose: CameraPose): CameraPose => ({
  position: cloneVec3(pose.position),
  target: cloneVec3(pose.target),
  up: cloneVec3(pose.up),
});

export function canonicalCameraPose(view: CanonicalView): CameraPose {
  if (view === "above") {
    return {
      position: { x: 0.02, y: 15.4, z: 0.02 },
      target: { x: 0, y: 1.85, z: 0 },
      up: { x: 0, y: 0, z: -1 },
    };
  }
  if (view === "three-quarter") {
    return {
      position: { x: 9.72, y: 6.42, z: 11.1 },
      target: { x: 0, y: 2.4, z: 0 },
      up: { x: 0, y: 1, z: 0 },
    };
  }
  return {
    position: { x: 0, y: 3.7, z: 15 },
    target: { x: 0, y: 2.55, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  };
}

export function orbitCameraPose(
  acquired: CameraPose,
  deltaX: number,
  deltaY: number,
  zoomScale = 1,
): CameraPose {
  const offset = subtract(acquired.position, acquired.target);
  const originalRadius = Math.max(0.001, length(offset));
  const radius = clamp(originalRadius * zoomScale, 5.7, 15.5);
  const originalPhi = Math.acos(clamp(offset.y / originalRadius, -1, 1));
  const originalTheta = Math.atan2(offset.x, offset.z);
  const theta = originalTheta - deltaX * 0.006;
  const phi = clamp(originalPhi + deltaY * 0.0025, 0.002, 1.52);
  const sinPhi = Math.sin(phi);
  const nextOffset = {
    x: radius * sinPhi * Math.sin(theta),
    y: radius * Math.cos(phi),
    z: radius * sinPhi * Math.cos(theta),
  };
  return {
    position: add(acquired.target, nextOffset),
    target: cloneVec3(acquired.target),
    up: { x: 0, y: 1, z: 0 },
  };
}

export function dollyCameraPose(acquired: CameraPose, zoomScale: number): CameraPose {
  const offset = subtract(acquired.position, acquired.target);
  const radius = length(offset);
  if (radius <= 1e-8) return cloneCameraPose(acquired);
  return {
    position: add(acquired.target, scale(offset, clamp(radius * zoomScale, 5.7, 15.5) / radius)),
    target: cloneVec3(acquired.target),
    up: cloneVec3(acquired.up),
  };
}
