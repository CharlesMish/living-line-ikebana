import * as THREE from "three";
import type { StudioCameraPose } from "./ThreeStudio.ts";

export type PhotoBackdrop = "paper" | "sage" | "dusk" | "transparent";
export type PhotoPerch = "ground" | "stone" | "bench";
export type PhotoFormat = "landscape" | "portrait" | "square";
export const PHOTO_SIZES: Record<PhotoFormat, { width: number; height: number }> = {
  landscape: { width: 1600, height: 1200 },
  portrait: { width: 1200, height: 1600 },
  square: { width: 1600, height: 1600 },
};
export const PHOTO_COLORS: Record<Exclude<PhotoBackdrop, "transparent">, { wall: number; floor: number }> = {
  paper: { wall: 0xeee9dd, floor: 0xe3dccf },
  sage: { wall: 0xcbd3c8, floor: 0xaab6a5 },
  dusk: { wall: 0x646d76, floor: 0x535e67 },
};

/** All perch tops meet the unchanged vessel bottom. Nothing botanical moves. */
export interface PerchSupport { contactY: number; footprintXZ: { minX: number; maxX: number; minZ: number; maxZ: number } }
export function photoSupportBounds(supports: readonly PerchSupport[]) {
  const minX = Math.min(...supports.map(s => s.footprintXZ.minX)), maxX = Math.max(...supports.map(s => s.footprintXZ.maxX));
  const minZ = Math.min(...supports.map(s => s.footprintXZ.minZ)), maxZ = Math.max(...supports.map(s => s.footprintXZ.maxZ));
  const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
  const radius = Math.max(3.15, ...supports.map(s => {
    const b = s.footprintXZ;
    return Math.hypot((b.minX + b.maxX) / 2 - x, (b.minZ + b.maxZ) / 2 - z) + Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + .3;
  }));
  return { x, z, radius, width: Math.max(7.6, maxX - minX + .7), depth: Math.max(5.8, maxZ - minZ + .7), topY: Math.min(...supports.map(s => s.contactY)) };
}
export function createPhotoPerch(perch: PhotoPerch, supports: readonly PerchSupport[] = [{ contactY: .04, footprintXZ: { minX: -2.64, maxX: 2.64, minZ: -2.64, maxZ: 2.64 } }]): { group: THREE.Group; floorY: number } {
  const group = new THREE.Group();
  const support = photoSupportBounds(supports);
  const material = new THREE.MeshStandardMaterial({ color: perch === "stone" ? 0xa5a092 : 0x75614d, roughness: 0.92 });
  const mesh = (geometry: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z);
    part.castShadow = true; part.receiveShadow = true; group.add(part);
  };
  if (perch === "stone") mesh(new THREE.CylinderGeometry(support.radius, support.radius + .03, .16, 80), support.x, support.topY - .08, support.z);
  if (perch === "bench") {
    mesh(new THREE.BoxGeometry(support.width, .18, support.depth), support.x, support.topY - .09, support.z);
    for (const x of [-1, 1]) for (const z of [-1, 1]) mesh(new THREE.BoxGeometry(.18, 1.25, .18), support.x + x * (support.width / 2 - .8), support.topY - .18 - .625, support.z + z * (support.depth / 2 - .8));
  }
  // A ground perch has no meshes; release its unused material immediately.
  if (perch === "ground") material.dispose();
  return { group, floorY: perch === "ground" ? -0.02 : perch === "stone" ? support.topY - .16 : support.topY - .18 - 1.25 };
}

/** Screen-space framing from a fixed pose; repeated updates never accumulate. */
export function framePhotoCamera(pose: StudioCameraPose, zoom: number, horizontal: number, vertical: number): StudioCameraPose {
  const target = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
  const delta = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z).sub(target);
  const forward = delta.clone().normalize().negate();
  const right = forward.clone().cross(new THREE.Vector3(pose.up.x, pose.up.y, pose.up.z)).normalize();
  const screenUp = right.clone().cross(forward).normalize();
  const shift = right.multiplyScalar(-horizontal).add(screenUp.multiplyScalar(-vertical));
  target.add(shift); const position = target.clone().add(delta.multiplyScalar(1 / zoom));
  return { position: { x: position.x, y: position.y, z: position.z }, target: { x: target.x, y: target.y, z: target.z }, up: { ...pose.up } };
}
