export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const ZERO: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });
export const X_AXIS: Readonly<Vec3> = Object.freeze({ x: 1, y: 0, z: 0 });
export const Y_AXIS: Readonly<Vec3> = Object.freeze({ x: 0, y: 1, z: 0 });
export const Z_AXIS: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 1 });
export const IDENTITY_QUAT: Readonly<Quat> = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const cloneVec3 = (value: Vec3): Vec3 => ({ x: value.x, y: value.y, z: value.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (value: Vec3, amount: number): Vec3 => ({
  x: value.x * amount,
  y: value.y * amount,
  z: value.z * amount,
});
export const addScaled = (a: Vec3, b: Vec3, amount: number): Vec3 => ({
  x: a.x + b.x * amount,
  y: a.y + b.y * amount,
  z: a.z + b.z * amount,
});
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const lengthSquared = (value: Vec3): number => dot(value, value);
export const length = (value: Vec3): number => Math.sqrt(lengthSquared(value));
export const distanceSquared = (a: Vec3, b: Vec3): number => lengthSquared(subtract(a, b));
export const distance = (a: Vec3, b: Vec3): number => Math.sqrt(distanceSquared(a, b));
export const normalize = (value: Vec3, fallback: Vec3 = X_AXIS): Vec3 => {
  const magnitude = length(value);
  if (magnitude <= Number.EPSILON) return cloneVec3(fallback);
  return scale(value, 1 / magnitude);
};
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));
export const clampLength = (value: Vec3, maximum: number): Vec3 => {
  const magnitude = length(value);
  return magnitude > maximum && magnitude > 0 ? scale(value, maximum / magnitude) : cloneVec3(value);
};
export const angleBetween = (a: Vec3, b: Vec3): number => {
  const denominator = Math.sqrt(lengthSquared(a) * lengthSquared(b));
  if (denominator === 0) return Math.PI / 2;
  return Math.acos(clamp(dot(a, b) / denominator, -1, 1));
};
export const projectPerpendicular = (value: Vec3, axis: Vec3): Vec3 => {
  const unitAxis = normalize(axis);
  return addScaled(value, unitAxis, -dot(value, unitAxis));
};

export const quaternionFromAxisAngle = (axis: Vec3, angle: number): Quat => {
  const unitAxis = normalize(axis);
  const half = angle * 0.5;
  const sine = Math.sin(half);
  return { x: unitAxis.x * sine, y: unitAxis.y * sine, z: unitAxis.z * sine, w: Math.cos(half) };
};

export const normalizeQuat = (value: Quat): Quat => {
  const magnitude = Math.hypot(value.x, value.y, value.z, value.w);
  if (magnitude <= Number.EPSILON) return { ...IDENTITY_QUAT };
  return { x: value.x / magnitude, y: value.y / magnitude, z: value.z / magnitude, w: value.w / magnitude };
};

export const rotateVector = (value: Vec3, quaternion: Quat): Vec3 => {
  const q = normalizeQuat(quaternion);
  const ix = q.w * value.x + q.y * value.z - q.z * value.y;
  const iy = q.w * value.y + q.z * value.x - q.x * value.z;
  const iz = q.w * value.z + q.x * value.y - q.y * value.x;
  const iw = -q.x * value.x - q.y * value.y - q.z * value.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
};

const deterministicPerpendicular = (direction: Vec3): Vec3 => {
  const unit = normalize(direction);
  const reference = Math.abs(unit.y) < 0.9 ? Y_AXIS : X_AXIS;
  return normalize(cross(unit, reference));
};

export const quaternionBetween = (from: Vec3, to: Vec3, antiparallelAxis?: Vec3): Quat => {
  const start = normalize(from);
  const end = normalize(to);
  const cosine = clamp(dot(start, end), -1, 1);
  if (cosine > 1 - 1e-14) return { ...IDENTITY_QUAT };
  if (cosine < -1 + 1e-12) {
    const requestedAxis = antiparallelAxis ? projectPerpendicular(antiparallelAxis, start) : ZERO;
    const axis = lengthSquared(requestedAxis) > 1e-20
      ? normalize(requestedAxis)
      : deterministicPerpendicular(start);
    return quaternionFromAxisAngle(axis, Math.PI);
  }
  return normalizeQuat({ ...cross(start, end), w: 1 + cosine });
};

export const rotateAround = (point: Vec3, anchor: Vec3, quaternion: Quat): Vec3 =>
  add(rotateVector(subtract(point, anchor), quaternion), anchor);

export const almostEqual = (a: number, b: number, tolerance = 1e-8): boolean =>
  Math.abs(a - b) <= tolerance;
export const vecAlmostEqual = (a: Vec3, b: Vec3, tolerance = 1e-8): boolean =>
  distance(a, b) <= tolerance;

