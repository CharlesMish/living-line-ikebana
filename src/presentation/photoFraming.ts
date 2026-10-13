import * as THREE from "three";
import type { StudioCameraPose } from "./ThreeStudio.ts";

/** Photograph offsets only. No Step Back limits or saved camera shape change. */
export const PHOTO_FRAMING_CONTROLS = [
  { id: "zoom", label: "Closer", min: .55, max: 2.8, step: .01, neutral: 1 },
  { id: "horizontal", label: "Across", min: -4.8, max: 4.8, step: .02, neutral: 0 },
  { id: "vertical", label: "Height", min: -4.8, max: 4.8, step: .02, neutral: 0 },
  { id: "yaw", label: "Turn", min: -60, max: 60, step: 1, neutral: 0 },
  { id: "pitch", label: "Elevation", min: -30, max: 30, step: 1, neutral: 0 },
  { id: "roll", label: "Tilt", min: -12, max: 12, step: .5, neutral: 0 },
] as const;
export type PhotoFraming = { [K in typeof PHOTO_FRAMING_CONTROLS[number]["id"]]: number };
export const NEUTRAL_PHOTO_FRAMING: Readonly<PhotoFraming> = Object.freeze({ zoom: 1, horizontal: 0, vertical: 0, yaw: 0, pitch: 0, roll: 0 });
// The highest stage floor is the ground plane at −.02. Keep a small clearance
// above it, including when a saved low frame is used as a new zoom reference.
const PHOTO_CAMERA_MIN_HEIGHT = .12;

export function validatePhotoFraming(value: PhotoFraming): PhotoFraming {
  for (const { id, min, max } of PHOTO_FRAMING_CONTROLS) {
    if (!Number.isFinite(value[id]) || value[id] < min || value[id] > max) throw new Error("Invalid photograph framing.");
  }
  return { zoom: value.zoom, horizontal: value.horizontal, vertical: value.vertical, yaw: value.yaw, pitch: value.pitch, roll: value.roll };
}

/** Recomputed from the chosen reference every time, never from a prior slider
 * result. Angle changes orbit that reference's target; pan remains screen-relative
 * after the angle/tilt. Existing CameraPose.up carries roll, including through
 * Garden and reload. No separate roll recipe can accidentally apply it twice. */
export function framePhotoCamera(pose: StudioCameraPose, zoom: number, horizontal: number, vertical: number, yaw = 0, pitch = 0, roll = 0): StudioCameraPose {
  validatePhotoFraming({ zoom, horizontal, vertical, yaw, pitch, roll });
  if (![pose.position, pose.target, pose.up].every(vector => [vector.x, vector.y, vector.z].every(Number.isFinite))) throw new Error("Invalid photograph reference view.");
  const target = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
  const delta = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z).sub(target);
  const up = new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z);
  if (delta.lengthSq() < 1e-12 || delta.clone().cross(up).lengthSq() < 1e-12) throw new Error("Invalid photograph reference view.");
  if (zoom === 1 && !horizontal && !vertical && !yaw && !pitch && !roll) return { position: {...pose.position}, target: {...pose.target}, up: {...pose.up} };
  if (yaw) {
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yaw));
    delta.applyQuaternion(rotation); up.applyQuaternion(rotation);
  }
  if (pitch) {
    const elevation = Math.asin(THREE.MathUtils.clamp(delta.y / delta.length(), -1, 1));
    // A changed elevation stays above the bowl. The untouched reference remains
    // exact, including the existing Above preset and an owner's authored view.
    const next = THREE.MathUtils.clamp(elevation + THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(3), THREE.MathUtils.degToRad(87));
    const right = new THREE.Vector3(0, 1, 0).cross(delta);
    if (right.lengthSq() < 1e-12) right.copy(delta).negate().cross(up);
    const rotation = new THREE.Quaternion().setFromAxisAngle(right.normalize(), elevation - next);
    delta.applyQuaternion(rotation); up.applyQuaternion(rotation);
  }
  const forward = delta.clone().normalize().negate();
  if (roll) up.applyAxisAngle(forward, THREE.MathUtils.degToRad(roll));
  const right = forward.clone().cross(up).normalize();
  const screenUp = right.clone().cross(forward).normalize();
  const shift = right.multiplyScalar(-horizontal).add(screenUp.multiplyScalar(-vertical));
  const offset = delta.multiplyScalar(1 / zoom);
  // An inherited below-stage pose is not silently repaired on opening. Changed
  // framing may raise it, but must not drive it lower. A normal reference retains
  // the stage clearance even if zooming toward a previously panned, low target.
  const minimumHeight = Math.min(PHOTO_CAMERA_MIN_HEIGHT, pose.position.y);
  const lift = Math.max(0, minimumHeight - (target.y + offset.y));
  target.y += lift;
  const unpannedY = target.y + offset.y;
  if (shift.y < 0 && unpannedY + shift.y < minimumHeight) {
    // Stop on the requested screen-space pan ray; never rotate, shorten the
    // camera radius, or clamp position without also translating its target.
    shift.multiplyScalar(Math.max(0, (unpannedY - minimumHeight) / -shift.y));
  }
  if (zoom === 1 && !yaw && !pitch && !roll && !lift && shift.lengthSq() === 0) return { position: {...pose.position}, target: {...pose.target}, up: {...pose.up} };
  target.add(shift); const position = target.clone().add(offset);
  return { position: { x: position.x, y: position.y, z: position.z }, target: { x: target.x, y: target.y, z: target.z }, up: { x: up.x, y: up.y, z: up.z } };
}
