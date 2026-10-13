import { neutralPhotoAdjustments, validatePhotoAdjustments, type PhotoAdjustments } from "../presentation/photoAdjustments.ts";
import { validateBotanicalTones, type BotanicalTones } from "../presentation/botanicalTones.ts";
import { ORIGINAL_VESSEL, VESSEL_PROFILES } from "../study/vesselProfiles.ts";
import { VESSEL_COLORS, VESSEL_FINISHES } from "../study/vesselAppearance.ts";
import { PHOTO_BACKDROPS, PHOTO_PERCHES, type PhotoBackdrop, type PhotoFormat, type PhotoPerch } from "../presentation/photoStage.ts";

/** Versioned presentation envelope. Botanical schema stays unchanged.
 * v2 makes old readers refuse enhanced scenes instead of discarding their look. */
export interface SceneSettings {
  sceneVersion: 1 | 2;
  layoutId: string;
  colorId: string;
  finishId: string;
  backdropId: PhotoBackdrop;
  perchId: PhotoPerch;
  photoFormat: PhotoFormat;
  stemFibers: boolean;
  botanicalTones?: BotanicalTones;
  photoAdjustments?: PhotoAdjustments;
}
export const DEFAULT_SCENE: SceneSettings = {
  sceneVersion: 1, layoutId: "original", colorId: "sand", finishId: "glaze",
  backdropId: "paper", perchId: "ground", photoFormat: "landscape", stemFibers: false,
};
export function validateScene(value: unknown): SceneSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved scene.");
  const s = value as SceneSettings;
  const keys = ["sceneVersion", "layoutId", "colorId", "finishId", "backdropId", "perchId", "photoFormat", "stemFibers", "botanicalTones", "photoAdjustments"];
  if (Object.keys(s).some(key => !keys.includes(key))) throw new Error("This saved scene cannot be opened.");
  if (![1, 2].includes(s.sceneVersion)
    || (s.sceneVersion === 1 && (Object.hasOwn(s, "botanicalTones") || Object.hasOwn(s, "photoAdjustments")))
    || !VESSEL_PROFILES.some(p => p.id === s.layoutId)
    || !VESSEL_COLORS.some(c => c.id === s.colorId) || !VESSEL_FINISHES.some(f => f.id === s.finishId)
    || !PHOTO_BACKDROPS.some(b => b.id === s.backdropId)
    || !PHOTO_PERCHES.some(perch => perch.id === s.perchId)
    || !["landscape", "portrait", "square"].includes(s.photoFormat)
    || typeof s.stemFibers !== "boolean") throw new Error("This saved scene cannot be opened.");
  const botanicalTones = validateBotanicalTones(s.botanicalTones);
  return { sceneVersion: s.sceneVersion, layoutId: s.layoutId, colorId: s.colorId, finishId: s.finishId,
    backdropId: s.backdropId, perchId: s.perchId, photoFormat: s.photoFormat, stemFibers: s.stemFibers,
    ...(botanicalTones ? { botanicalTones } : {}),
    ...(Object.hasOwn(s, "photoAdjustments") ? { photoAdjustments: validatePhotoAdjustments(s.photoAdjustments) } : {}) };
}
export function sceneProfile(scene?: SceneSettings) {
  return VESSEL_PROFILES.find(p => p.id === scene?.layoutId) ?? ORIGINAL_VESSEL;
}

/** New recipes need v2 so older clients refuse instead of losing the finish. */
export function withPhotoAdjustments(scene: SceneSettings, recipe: PhotoAdjustments): SceneSettings {
  const value = validatePhotoAdjustments(recipe), next = { ...scene };
  if (neutralPhotoAdjustments(value)) delete next.photoAdjustments;
  else { next.sceneVersion = 2; next.photoAdjustments = value; }
  return validateScene(next);
}

/** Explicit color edits upgrade only when needed; existing v2 scenes stay v2. */
export function withBotanicalTones(scene: SceneSettings, value?: BotanicalTones): SceneSettings {
  const botanicalTones = validateBotanicalTones(value);
  const { botanicalTones: _previous, ...rest } = scene;
  return validateScene({ ...rest, sceneVersion: botanicalTones ? 2 : scene.sceneVersion,
    ...(botanicalTones ? { botanicalTones } : {}) });
}
