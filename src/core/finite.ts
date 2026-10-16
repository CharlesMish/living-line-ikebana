import type { Quat, Vec3 } from "./math.ts";

/** Constant-cost guards at edit boundaries; never traverse a plant on pointer move. */
export const finiteVec3 = (value: Vec3): boolean => value != null
  && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

export const finiteQuat = (value: Quat): boolean => finiteVec3(value) && Number.isFinite(value.w);

// Numerical envelope, not a vessel/gesture limit. Normal targets are single-
// digit coordinates (even existing saturation probes use only hundreds).
// Reject astronomical inputs before squared lengths, cross products or camera
// matrices can overflow. Ordinary finite prune distances still clamp normally.
export const EDIT_COORDINATE_LIMIT = 1_000_000;
export const safeEditVec3 = (value: Vec3): boolean => finiteVec3(value)
  && Math.abs(value.x) <= EDIT_COORDINATE_LIMIT
  && Math.abs(value.y) <= EDIT_COORDINATE_LIMIT
  && Math.abs(value.z) <= EDIT_COORDINATE_LIMIT;
export const safeEditQuat = (value: Quat): boolean => finiteQuat(value)
  && safeEditVec3(value) && Math.abs(value.w) <= EDIT_COORDINATE_LIMIT;
