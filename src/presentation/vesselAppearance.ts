import * as THREE from "three";
import { resolveVesselAppearance, type VesselAppearanceChoice } from "../study/vesselAppearance.ts";

/** Fixed neutral height noise. It perturbs light normals only, never vertices,
 * silhouettes, insertion rules or collision envelopes. No image/network asset. */
export function createVesselGrain(): THREE.DataTexture {
  const size = 128, bytes = new Uint8Array(size * size * 4);
  let state = 49037;
  for (let i = 0; i < size * size; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const value = 112 + (state >>> 27);
    bytes.set([value, value, value, 255], i * 4);
  }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.name = "living-line/stoneware-grain-v1";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 4);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function applyVesselAppearance(body: THREE.MeshPhysicalMaterial, rim: THREE.MeshStandardMaterial,
  choice: VesselAppearanceChoice, grain?: THREE.Texture) {
  const settings = resolveVesselAppearance(choice);
  body.color.setHex(settings.color, THREE.SRGBColorSpace);
  body.roughness = settings.roughness; body.clearcoat = settings.clearcoat;
  body.bumpMap = settings.grain ? grain ?? null : null;
  body.bumpScale = settings.bumpScale;
  body.needsUpdate = true;
  rim.color.setHex(settings.rimColor, THREE.SRGBColorSpace);
  rim.roughness = settings.rimRoughness; rim.bumpMap = settings.grain ? grain ?? null : null;
  rim.bumpScale = settings.bumpScale; rim.needsUpdate = true;
}
