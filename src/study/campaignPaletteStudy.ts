export const CAMPAIGN_PALETTE_SIDECAR_PARAM = "campaignPaletteSidecar" as const;
export const CAMPAIGN_PALETTE_SIDECAR_SCHEMA = "living-line-campaign-palette-sidecar" as const;
export const CAMPAIGN_PALETTE_SIDECAR_VERSION = 1 as const;

export type CampaignPaletteSidecar = Readonly<{
  schema: typeof CAMPAIGN_PALETTE_SIDECAR_SCHEMA;
  version: typeof CAMPAIGN_PALETTE_SIDECAR_VERSION;
  studyRecipe: string;
  build: string;
}>;

export type CampaignPaletteStudyReason =
  | "ok"
  | "flag-required"
  | "sidecar-json-invalid"
  | "sidecar-schema-invalid"
  | "sidecar-version-invalid"
  | "sidecar-build-mismatch"
  | "sidecar-recipe-unregistered"
  | "recipe-unregistered"
  | "no-recipe-requested";

export type CampaignPaletteStudyState = Readonly<{
  flagEnabled: boolean;
  expectedBuild: string;
  requestedRecipeId: string | null;
  activeRecipeId: string | null;
  sidecar: CampaignPaletteSidecar | null;
  reason: CampaignPaletteStudyReason;
}>;

type AppearanceRecipe = (base: unknown, generatorVersion: string) => unknown;

const recipes = new Map<string, AppearanceRecipe>();
let state: CampaignPaletteStudyState = Object.freeze({
  flagEnabled: false,
  expectedBuild: "",
  requestedRecipeId: null,
  activeRecipeId: null,
  sidecar: null,
  reason: "no-recipe-requested",
});

export function readCampaignPaletteSidecarRaw(url = new URL(window.location.href)): string | null {
  return url.searchParams.get(CAMPAIGN_PALETTE_SIDECAR_PARAM);
}

export function createCampaignPaletteSidecar(input: {
  studyRecipe: string;
  build: string;
}): CampaignPaletteSidecar {
  return Object.freeze({
    schema: CAMPAIGN_PALETTE_SIDECAR_SCHEMA,
    version: CAMPAIGN_PALETTE_SIDECAR_VERSION,
    studyRecipe: input.studyRecipe,
    build: input.build,
  });
}

function parseCampaignPaletteSidecar(raw: string): CampaignPaletteSidecar {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("sidecar-json-invalid");
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("sidecar-schema-invalid");
  const value = decoded as Record<string, unknown>;
  if (value.schema !== CAMPAIGN_PALETTE_SIDECAR_SCHEMA) throw new Error("sidecar-schema-invalid");
  if (value.version !== CAMPAIGN_PALETTE_SIDECAR_VERSION) throw new Error("sidecar-version-invalid");
  if (typeof value.studyRecipe !== "string" || value.studyRecipe.length === 0) throw new Error("sidecar-schema-invalid");
  if (typeof value.build !== "string" || value.build.length === 0) throw new Error("sidecar-schema-invalid");
  return createCampaignPaletteSidecar({ studyRecipe: value.studyRecipe, build: value.build });
}

function finalize(
  next: Omit<CampaignPaletteStudyState, "activeRecipeId" | "reason">,
): CampaignPaletteStudyState {
  if (!next.flagEnabled) {
    return Object.freeze({ ...next, activeRecipeId: null, reason: "flag-required" });
  }
  if (!next.requestedRecipeId) {
    return Object.freeze({ ...next, activeRecipeId: null, reason: "no-recipe-requested" });
  }
  if (!recipes.has(next.requestedRecipeId)) {
    return Object.freeze({
      ...next,
      activeRecipeId: null,
      reason: next.sidecar ? "sidecar-recipe-unregistered" : "recipe-unregistered",
    });
  }
  return Object.freeze({ ...next, activeRecipeId: next.requestedRecipeId, reason: "ok" });
}

export function configureCampaignPaletteStudy(options: {
  flagEnabled: boolean;
  expectedBuild: string;
  defaultRecipeId: string | null;
  sidecarRaw: string | null;
}): CampaignPaletteStudyState {
  if (!options.flagEnabled) {
    state = finalize({
      flagEnabled: false,
      expectedBuild: options.expectedBuild,
      requestedRecipeId: null,
      sidecar: null,
    });
    return state;
  }

  if (options.sidecarRaw) {
    let sidecar: CampaignPaletteSidecar;
    try {
      sidecar = parseCampaignPaletteSidecar(options.sidecarRaw);
    } catch (error) {
      state = Object.freeze({
        flagEnabled: true,
        expectedBuild: options.expectedBuild,
        requestedRecipeId: null,
        activeRecipeId: null,
        sidecar: null,
        reason: (error instanceof Error ? error.message : "sidecar-schema-invalid") as CampaignPaletteStudyReason,
      });
      return state;
    }
    if (sidecar.build !== options.expectedBuild) {
      state = Object.freeze({
        flagEnabled: true,
        expectedBuild: options.expectedBuild,
        requestedRecipeId: sidecar.studyRecipe,
        activeRecipeId: null,
        sidecar,
        reason: "sidecar-build-mismatch",
      });
      return state;
    }
    state = finalize({
      flagEnabled: true,
      expectedBuild: options.expectedBuild,
      requestedRecipeId: sidecar.studyRecipe,
      sidecar,
    });
    return state;
  }

  state = finalize({
    flagEnabled: true,
    expectedBuild: options.expectedBuild,
    requestedRecipeId: options.defaultRecipeId,
    sidecar: null,
  });
  return state;
}

export function getCampaignPaletteStudyState(): CampaignPaletteStudyState {
  return state;
}

export function registerCampaignPaletteRecipe(
  recipeId: string,
  recipe: (base: unknown, generatorVersion: string) => unknown,
): void {
  recipes.set(recipeId, recipe);
  if (state.requestedRecipeId === recipeId && state.flagEnabled) {
    state = finalize({
      flagEnabled: state.flagEnabled,
      expectedBuild: state.expectedBuild,
      requestedRecipeId: state.requestedRecipeId,
      sidecar: state.sidecar,
    });
  }
}

export function resolveCampaignPaletteAppearance<T>(generatorVersion: string, base: T): T {
  const recipeId = state.activeRecipeId;
  if (!recipeId) return base;
  const recipe = recipes.get(recipeId);
  if (!recipe) return base;
  return recipe(base, generatorVersion) as T;
}

export function resetCampaignPaletteStudyForTest(): void {
  state = Object.freeze({
    flagEnabled: false,
    expectedBuild: "",
    requestedRecipeId: null,
    activeRecipeId: null,
    sidecar: null,
    reason: "no-recipe-requested",
  });
}
