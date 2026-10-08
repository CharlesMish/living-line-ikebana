import { registerCampaignPaletteRecipe } from "./campaignPaletteStudy.ts";

export const C2_COOL_CHALK_RECIPE_ID = "c2-cool-chalk" as const;
export const C2_COOL_CHALK_BLOOM = 0xb6b9d4 as const;
export const C2_COOL_CHALK_BERRY = 0x77536c as const;
export const C2_COOL_CHALK_LEAF = 0x879d87 as const;

registerCampaignPaletteRecipe(C2_COOL_CHALK_RECIPE_ID, (appearance) => {
  const base = appearance as {
    leaf: { color: number };
    bloom: { color: number; collarColor?: number };
    berry?: { color: number };
  };
  return Object.freeze({
    ...base,
    leaf: Object.freeze({
      ...base.leaf,
      // One leaf color field drives both faces; set it once so top and underside match.
      color: C2_COOL_CHALK_LEAF,
    }),
    bloom: Object.freeze({
      ...base.bloom,
      color: C2_COOL_CHALK_BLOOM,
      ...(base.bloom.collarColor === undefined ? {} : { collarColor: C2_COOL_CHALK_BLOOM }),
    }),
    ...(base.berry ? { berry: Object.freeze({ ...base.berry, color: C2_COOL_CHALK_BERRY }) } : {}),
  });
});
