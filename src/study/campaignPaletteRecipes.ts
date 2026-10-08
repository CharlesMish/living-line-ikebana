import { registerCampaignPaletteRecipe } from "./campaignPaletteStudy.ts";

export const C1_WARM_MINERAL_RECIPE_ID = "c1-warm-mineral" as const;
export const C1_WARM_MINERAL_BLOOM = 0xe8d7ac as const;
export const C1_WARM_MINERAL_BERRY = 0xb86947 as const;

registerCampaignPaletteRecipe(C1_WARM_MINERAL_RECIPE_ID, (appearance) => {
  const base = appearance as {
    bloom: { color: number; collarColor?: number };
    berry?: { color: number };
  };
  return Object.freeze({
    ...base,
    bloom: Object.freeze({
      ...base.bloom,
      color: C1_WARM_MINERAL_BLOOM,
      ...(base.bloom.collarColor === undefined ? {} : { collarColor: C1_WARM_MINERAL_BLOOM }),
    }),
    ...(base.berry ? { berry: Object.freeze({ ...base.berry, color: C1_WARM_MINERAL_BERRY }) } : {}),
  });
});
