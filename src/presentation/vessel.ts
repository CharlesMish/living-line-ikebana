import * as THREE from "three";

/** A hollow shallow bowl: the water sits inside a visible wall, below the lip.
 * Scene dimensions only; the pin field and botanical insertion plane are unchanged.
 * Profile traverses the underside, outside, lip, inside and basin floor.
 */
export function createVesselGeometry(): THREE.LatheGeometry {
  const profile = [
    [0, 0.04], [2.34, 0.04], [2.57, 0.10], [2.64, 0.32],
    [2.60, 0.54], [2.54, 0.62], [2.46, 0.65], [2.38, 0.61],
    [2.30, 0.27], [2.19, 0.19], [0, 0.19],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  geometry.name = "living-line/shallow-vessel";
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
