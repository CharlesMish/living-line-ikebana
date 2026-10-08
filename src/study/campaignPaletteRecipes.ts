import { registerCampaignPaletteRecipe } from "./campaignPaletteStudy.ts";

export const C3_INK_CITRUS_RECIPE_ID = "c3-ink-citrus" as const;
export const C3_INK_CITRUS_STEM = 0x5d668a as const;
export const C3_INK_CITRUS_LEAF = 0x3c4e61 as const;
export const C3_INK_CITRUS_BLOOM = 0xc8cc79 as const;
export const C3_INK_CITRUS_BERRY = 0xca7667 as const;

function channel(value: number, shift = 0) {
  return (value >> shift) & 0xff;
}

function rgb(red: number, green: number, blue: number) {
  return ((red & 0xff) << 16) | ((green & 0xff) << 8) | (blue & 0xff);
}

function blendTowardWhite(value: number, ratio: number) {
  const mix = (component: number) => Math.round(component + (255 - component) * ratio);
  return rgb(
    mix(channel(value, 16)),
    mix(channel(value, 8)),
    mix(channel(value, 0)),
  );
}

// Keep veins related to the recolored leaf while preserving visible blade structure.
export const C3_INK_CITRUS_VEIN = blendTowardWhite(C3_INK_CITRUS_LEAF, 0.3);

registerCampaignPaletteRecipe(C3_INK_CITRUS_RECIPE_ID, (appearance) => {
  const base = appearance as {
    branchColors: { trunk: number; lateral: number; twig: number; pedicel: number; petiole: number };
    leaf: { color: number; veinColor: number };
    bloom: { color: number; collarColor?: number };
    berry?: { color: number };
  };
  return Object.freeze({
    ...base,
    branchColors: Object.freeze({
      ...base.branchColors,
      // Structural line-making axes only.
      trunk: C3_INK_CITRUS_STEM,
      lateral: C3_INK_CITRUS_STEM,
      twig: C3_INK_CITRUS_STEM,
    }),
    leaf: Object.freeze({
      ...base.leaf,
      // One leaf color field drives both faces; set once to keep top/underside matched.
      color: C3_INK_CITRUS_LEAF,
      // Avoid an unmatched legacy green vein against the cool leaf.
      veinColor: C3_INK_CITRUS_VEIN,
    }),
    bloom: Object.freeze({
      ...base.bloom,
      color: C3_INK_CITRUS_BLOOM,
      ...(base.bloom.collarColor === undefined ? {} : { collarColor: C3_INK_CITRUS_BLOOM }),
    }),
    ...(base.berry ? { berry: Object.freeze({ ...base.berry, color: C3_INK_CITRUS_BERRY }) } : {}),
  });
});
