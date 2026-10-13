import * as THREE from "three";

/** A bell sleeve carries its collar/petal colors in the color attribute. Keep
 * its seeded shade, geometry and green collar; only retint the petal contribution.
 * Every update starts from the original buffer, so cycling cannot drift. */
export function createBellToneUpdater(geometry: THREE.BufferGeometry, original: { petal: number; collar: number }) {
  const attribute = geometry.getAttribute("color") as THREE.BufferAttribute;
  const position = geometry.getAttribute("position");
  const source = Float32Array.from(attribute.array);
  const collar = new THREE.Color(original.collar), petal = new THREE.Color(original.petal);
  const base = new THREE.Color(), next = new THREE.Color();
  let current = original.petal;
  return (color: number) => {
    if (color === current) return;
    if (color === original.petal) attribute.array.set(source);
    else {
      const replacement = new THREE.Color(color);
      for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp((position.getY(i) - .01) / .09, 0, 1);
        const blend = t * t * (3 - 2 * t);
        base.copy(collar).lerp(petal, blend);
        next.copy(collar).lerp(replacement, blend);
        attribute.setXYZ(i, source[i * 3] * next.r / base.r,
          source[i * 3 + 1] * next.g / base.g, source[i * 3 + 2] * next.b / base.b);
      }
    }
    current = color; attribute.needsUpdate = true;
  };
}
