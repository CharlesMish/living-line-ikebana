import * as THREE from "three";

export const PHOTO_LIGHTING = [
  { id: "studio", label: "Studio", description: "The original balanced light." },
  { id: "window", label: "Soft window", description: "Cool daylight with more fill and gentler contrast." },
  { id: "evening", label: "Evening", description: "A warm side light with a quiet cool fill." },
] as const;
export type PhotoLightingId = typeof PHOTO_LIGHTING[number]["id"];
export function validatePhotoLighting(value: unknown): PhotoLightingId {
  if (value === undefined) return "studio";
  if (!PHOTO_LIGHTING.some(item => item.id === value)) throw new Error("Invalid photograph lighting.");
  return value as PhotoLightingId;
}

interface LightingRecipe {
  sky: number; ground: number; hemisphere: number;
  keyColor: number; keyIntensity: number; keyPosition: readonly [number, number, number];
  fillColor: number; fillIntensity: number; fillPosition: readonly [number, number, number];
}
/** The accepted Studio draw is recorded verbatim. Other presets reuse its two
 * directional lights and single shadow map; this is not an area-light solver. */
export const PHOTO_LIGHT_RECIPES: Readonly<Record<PhotoLightingId, LightingRecipe>> = {
  studio: { sky: 0xfffaec, ground: 0x657064, hemisphere: 1.95,
    keyColor: 0xfff3d8, keyIntensity: 3, keyPosition: [-3.2, 12.5, 4.4],
    fillColor: 0xcddce0, fillIntensity: .8, fillPosition: [6, 4, -5] },
  window: { sky: 0xf0f5ff, ground: 0x73766d, hemisphere: 2.1,
    keyColor: 0xfff7eb, keyIntensity: 2.3, keyPosition: [-6, 10.5, 6],
    fillColor: 0xdbe6f6, fillIntensity: 1.15, fillPosition: [6, 5, -3] },
  evening: { sky: 0xe6eafa, ground: 0x6f635a, hemisphere: 1.65,
    keyColor: 0xffd5a2, keyIntensity: 3.1, keyPosition: [6, 9, 4],
    fillColor: 0xcbdaf5, fillIntensity: .9, fillPosition: [-6, 5, -4] },
};
export interface PhotoLightRig { hemisphere: THREE.HemisphereLight; key: THREE.DirectionalLight; fill: THREE.DirectionalLight }
export function applyPhotoLighting(rig: PhotoLightRig, value?: PhotoLightingId): void {
  const recipe = PHOTO_LIGHT_RECIPES[validatePhotoLighting(value)];
  rig.hemisphere.color.setHex(recipe.sky); rig.hemisphere.groundColor.setHex(recipe.ground); rig.hemisphere.intensity = recipe.hemisphere;
  rig.key.color.setHex(recipe.keyColor); rig.key.intensity = recipe.keyIntensity; rig.key.position.set(...recipe.keyPosition);
  rig.fill.color.setHex(recipe.fillColor); rig.fill.intensity = recipe.fillIntensity; rig.fill.position.set(...recipe.fillPosition);
  rig.key.shadow.needsUpdate = true;
}

/** Shadow render targets belong to the studio, not WebGLRenderer.dispose().
 * Release their target once (it owns any depth texture), before renderer teardown.
 * The fill normally allocates none; include it so future presets stay safe. */
export function disposePhotoLighting(rig: PhotoLightRig): void {
  const targets = new Set<THREE.RenderTarget>();
  for (const light of [rig.key, rig.fill]) {
    for (const property of ["map", "mapPass"] as const) {
      const target = light.shadow[property];
      if (target) targets.add(target);
      light.shadow[property] = null;
    }
  }
  for (const target of targets) target.dispose();
}
