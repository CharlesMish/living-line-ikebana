import * as THREE from "three";
import { createPerchSurface } from "./perchSurfaces.ts";
import { timberGeometry, honedStoneGeometry, plasterGeometry } from "./perchGeometry.ts";

export const PHOTO_BACKDROPS = [
  { id: "paper", label: "Warm paper" },
  { id: "sage", label: "Sage wall" },
  { id: "dusk", label: "Dusk wall" },
  { id: "mist", label: "Mist wall" },
  { id: "clay", label: "Clay wall" },
  { id: "ink", label: "Ink wall" },
  { id: "hills", label: "Mist hills" },
  { id: "garden", label: "Garden shade" },
  { id: "transparent", label: "Transparent" },
] as const;
export type PhotoBackdrop = typeof PHOTO_BACKDROPS[number]["id"];
export type PhotoPerch = "ground" | "stone" | "bench" | "plinth";
export const PHOTO_PERCHES: readonly { id: PhotoPerch; label: string }[] = [
  { id: "ground", label: "Ground" },
  { id: "stone", label: "Low stone" },
  { id: "bench", label: "Small bench" },
  { id: "plinth", label: "Plaster plinth" },
];
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
  mist: { wall: 0xb8c7d0, floor: 0x9eafb9 },
  clay: { wall: 0xc1a398, floor: 0xac8f83 },
  ink: { wall: 0x414f59, floor: 0x35444e },
  hills: { wall: 0xced7c9, floor: 0xb8c2b4 },
  garden: { wall: 0xcfd6c3, floor: 0xb5bcad },
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
  group.name = `photo-perch-${perch}`;
  const support = photoSupportBounds(supports);
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, material); part.position.set(x, y, z);
    part.name = name;
    part.castShadow = true; part.receiveShadow = true; group.add(part);
  };
  if (perch === "ground") return { group, floorY: -.02 };
  if (perch === "stone") {
    const height = .22;
    mesh("honed-stone", honedStoneGeometry(support.radius + .03, height), createPerchSurface("stone"), support.x, support.topY - height / 2, support.z);
    return { group, floorY: support.topY - height };
  }
  if (perch === "bench") {
    const wood = createPerchSurface("wood"), end = createPerchSurface("endgrain");
    const thickness = .22, legHeight = 1.22, boardGap = .012;
    const boardDepth = (support.depth - boardGap * 2) / 3;
    for (let index = 0; index < 3; index++) {
      mesh(`bench-board-${index}`, timberGeometry(support.width, thickness, boardDepth, "x", index * .31, true), [wood, end],
        support.x, support.topY - thickness / 2, support.z + (index - 1) * (boardDepth + boardGap));
    }
    const insetX = support.width / 2 - .7, insetZ = support.depth / 2 - .65;
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      mesh(`bench-leg-${x}-${z}`, timberGeometry(.25, legHeight, .25, "y", x * .4 + z * .17), wood,
        support.x + x * insetX, support.topY - thickness - legHeight / 2, support.z + z * insetZ);
    }
    // Aprons meet the inside leg faces, as real joinery would. The quiet reveal
    // under the eased top adds a contact shadow without painted fake shadows.
    for (const sign of [-1, 1]) {
      mesh(`bench-long-apron-${sign}`, timberGeometry(insetX * 2 - .25, .28, .14, "x", sign * .23), wood,
        support.x, support.topY - thickness - .17, support.z + sign * insetZ);
      mesh(`bench-end-apron-${sign}`, timberGeometry(.14, .28, insetZ * 2 - .25, "z", sign * .37), wood,
        support.x + sign * insetX, support.topY - thickness - .17, support.z);
    }
    return { group, floorY: support.topY - thickness - legHeight };
  }
  const plaster = createPerchSurface("plaster"), height = .68, footHeight = .06;
  mesh("plinth-body", plasterGeometry(support.width, height - footHeight, support.depth), plaster,
    support.x, support.topY - (height - footHeight) / 2, support.z);
  mesh("plinth-recessed-foot", plasterGeometry(support.width - .22, footHeight, support.depth - .22), plaster,
    support.x, support.topY - height + footHeight / 2, support.z);
  return { group, floorY: support.topY - height };
}

export { framePhotoCamera } from "./photoFraming.ts";
