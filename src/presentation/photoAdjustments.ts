/** Small photo-only recipe. Absence means the unchanged renderer output. */
export interface PhotoAdjustments {
  version: 1;
  exposure: number;
  contrast: number;
  warmth: number;
  saturation: number;
  vignette: number;
}
export const PHOTO_ADJUSTMENT_CONTROLS = [
  { id: "exposure", label: "Exposure", min: -1, max: 1, step: .02 },
  { id: "contrast", label: "Contrast", min: -.5, max: .5, step: .01 },
  { id: "warmth", label: "Warmth", min: -1, max: 1, step: .02 },
  { id: "saturation", label: "Saturation", min: -1, max: .6, step: .02 },
  { id: "vignette", label: "Vignette", min: 0, max: 1, step: .02 },
] as const;
export const NEUTRAL_PHOTO_ADJUSTMENTS: Readonly<PhotoAdjustments> = Object.freeze({
  version: 1, exposure: 0, contrast: 0, warmth: 0, saturation: 0, vignette: 0,
});
/** Fail closed rather than dropping a future recipe or silently clamping it. */
export function validatePhotoAdjustments(value: unknown): PhotoAdjustments {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This photo adjustment recipe cannot be opened.");
  const v = value as Record<string, unknown>;
  const keys = ["version", ...PHOTO_ADJUSTMENT_CONTROLS.map(control => control.id)];
  if (v.version !== 1 || Object.keys(v).some(key => !keys.includes(key))) throw new Error("This photo adjustment recipe cannot be opened.");
  for (const { id, min, max } of PHOTO_ADJUSTMENT_CONTROLS) {
    const n = v[id];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) throw new Error("This photo adjustment recipe cannot be opened.");
  }
  return { version: 1, exposure: v.exposure as number, contrast: v.contrast as number, warmth: v.warmth as number,
    saturation: v.saturation as number, vignette: v.vignette as number };
}
export function neutralPhotoAdjustments(value?: PhotoAdjustments): boolean {
  return !value || PHOTO_ADJUSTMENT_CONTROLS.every(({ id }) => value[id] === 0);
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;
/** Numeric reference for the GPU operation, on finished sRGB straight-alpha
 * pixels. No CPU image processing occurs during preview or capture. UV is
 * normalized to the photo frame so resolution never changes the recipe. */
export function adjustedPhotoPixel(rgba: readonly [number, number, number, number], uv: readonly [number, number], recipe: PhotoAdjustments): [number, number, number, number] {
  if (neutralPhotoAdjustments(recipe) || rgba[3] === 0) return [...rgba];
  const ev = 2 ** recipe.exposure;
  let rgb = rgba.slice(0, 3).map((v, i) => srgb(linear(v) * ev * 2 ** ([.16, .03, -.16][i] * recipe.warmth)));
  const slope = 2 ** (.8 * recipe.contrast);
  rgb = rgb.map(v => (v - .5) * slope + .5);
  const luma = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  rgb = rgb.map(v => clamp(luma + (v - luma) * (1 + recipe.saturation)));
  const radius = Math.hypot((uv[0] - .5) * 2, (uv[1] - .5) * 2) / Math.SQRT2;
  const t = clamp((radius - .3) / .7), edge = t * t * (3 - 2 * t);
  const shade = 2 ** (-1.1 * recipe.vignette * edge);
  return [srgb(linear(rgb[0]) * shade), srgb(linear(rgb[1]) * shade), srgb(linear(rgb[2]) * shade), rgba[3]];
}

/** Numeric counterpart of the shader's canvas coverage handling. */
export function adjustedPremultipliedPhotoPixel(rgba: readonly [number, number, number, number], uv: readonly [number, number], recipe: PhotoAdjustments): [number, number, number, number] {
  if (neutralPhotoAdjustments(recipe) || rgba[3] === 0) return [...rgba];
  const straight = adjustedPhotoPixel([rgba[0] / rgba[3], rgba[1] / rgba[3], rgba[2] / rgba[3], rgba[3]], uv, recipe);
  return [straight[0] * rgba[3], straight[1] * rgba[3], straight[2] * rgba[3], rgba[3]];
}
