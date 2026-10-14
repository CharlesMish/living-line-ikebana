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

/** Owned by one studio. Maps never enter a save or cross between renderers. */
export interface VesselFinishTextures {
  bump: THREE.DataTexture;
  roughness: THREE.DataTexture;
  color?: THREE.DataTexture;
  dispose(): void;
}

/** Small periodic value field: deterministic without a canvas, image, or random
 * process. The seam repeats exactly, including after context restoration. */
function ceramicNoise(x: number, y: number, cells: number): number {
  const sample = (a: number, b: number) => {
    const hash = Math.imul((a % cells) + 17, 374761393) ^ Math.imul((b % cells) + 31, 668265263);
    return ((Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) & 65535) / 65535;
  };
  const u = x * cells, v = y * cells, a = Math.floor(u), b = Math.floor(v);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sx = smooth(u - a), sy = smooth(v - b);
  const lower = sample(a, b) * (1 - sx) + sample(a + 1, b) * sx;
  const upper = sample(a, b + 1) * (1 - sx) + sample(a + 1, b + 1) * sx;
  return lower * (1 - sy) + upper * sy;
}

export function createVesselFinishTextures(finishId: string): VesselFinishTextures | undefined {
  if (finishId !== "satin" && finishId !== "speckled") return undefined;
  const size = 128, height = new Uint8Array(size * size * 4), rough = new Uint8Array(height.length);
  const colors = finishId === "speckled" ? new Uint8Array(height.length) : undefined;
  let state = 83713;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const flecks = Array.from({ length: 42 }, () => ({ x: next() * size, y: next() * size, r: .55 + next() * 1.1 }));
  const pixel = (data: Uint8Array, index: number, value: number) => {
    const v = Math.max(0, Math.min(255, Math.round(value)));
    data.set([v, v, v, 255], index * 4);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, soft = ceramicNoise(x / size, y / size, 7), fine = ceramicNoise(x / size, y / size, 29);
    let fleck = 0;
    if (colors) for (const dot of flecks) {
      const dx = Math.min(Math.abs(x - dot.x), size - Math.abs(x - dot.x));
      const dy = Math.min(Math.abs(y - dot.y), size - Math.abs(y - dot.y));
      fleck = Math.max(fleck, Math.max(0, Math.min(1, (dot.r - Math.hypot(dx, dy)) * 1.8)));
    }
    pixel(height, index, 126 + soft * 13 + fine * 6 - fleck * 7);
    pixel(rough, index, 237 + soft * 10 + fine * 8);
    if (colors) pixel(colors, index, 250 + soft * 5 - fleck * 112);
  }
  const texture = (bytes: Uint8Array, kind: string) => {
    const map = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    map.name = `living-line/${finishId}-${kind}-v1`;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3, 2);
    map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true; map.needsUpdate = true;
    if (kind === "color") map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };
  const bump = texture(height, "height"), roughness = texture(rough, "roughness"), color = colors ? texture(colors, "color") : undefined;
  let disposed = false;
  return { bump, roughness, color, dispose() {
    if (disposed) return;
    disposed = true;
    bump.dispose(); roughness.dispose(); color?.dispose();
  } };
}

export function applyVesselAppearance(body: THREE.MeshPhysicalMaterial, rim: THREE.MeshStandardMaterial,
  choice: VesselAppearanceChoice, grain?: THREE.Texture, textures?: VesselFinishTextures) {
  const settings = resolveVesselAppearance(choice);
  body.color.setHex(settings.color, THREE.SRGBColorSpace);
  body.roughness = settings.roughness; body.clearcoat = settings.clearcoat;
  body.map = textures?.color ?? null;
  body.roughnessMap = textures?.roughness ?? null;
  body.bumpMap = textures?.bump ?? (settings.grain ? grain ?? null : null);
  body.bumpScale = settings.bumpScale;
  body.needsUpdate = true;
  rim.color.setHex(settings.rimColor, THREE.SRGBColorSpace);
  rim.map = textures?.color ?? null;
  rim.roughnessMap = textures?.roughness ?? null;
  rim.roughness = settings.rimRoughness; rim.bumpMap = textures?.bump ?? (settings.grain ? grain ?? null : null);
  rim.bumpScale = settings.bumpScale; rim.needsUpdate = true;
}
