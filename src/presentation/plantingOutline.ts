import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ORIGINAL_VESSEL, type VesselProfile } from "../study/vesselProfiles.ts";

/** All centre lines come from the same ellipses used by insertion validity. */
export function plantingOutline(profile: VesselProfile = ORIGINAL_VESSEL, width: number): THREE.BufferGeometry {
  if (profile.id === "original") return new THREE.TorusGeometry(1.22, width, 8, 64);
  const rings = profile.areas.map(area => {
    const ring = new THREE.TorusGeometry(1, width, 8, 96);
    ring.scale(area.rx, area.rz, 1);
    ring.translate(area.x, area.z, 0);
    return ring;
  });
  const geometry = mergeGeometries(rings)!;
  rings.forEach(ring => ring.dispose());
  return geometry;
}
