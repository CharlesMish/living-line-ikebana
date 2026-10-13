import { ORIGINAL_VESSEL, VESSEL_PROFILES } from "../study/vesselProfiles.ts";
import { VESSEL_COLORS, VESSEL_FINISHES } from "../study/vesselAppearance.ts";
import { PHOTO_BACKDROPS, PHOTO_PERCHES, type PhotoBackdrop, type PhotoFormat, type PhotoPerch } from "../presentation/photoStage.ts";

/** Small versioned presentation envelope. Botanical schema stays unchanged. */
export interface SceneSettings {
  sceneVersion: 1;
  layoutId: string;
  colorId: string;
  finishId: string;
  backdropId: PhotoBackdrop;
  perchId: PhotoPerch;
  photoFormat: PhotoFormat;
  stemFibers: boolean;
}
export const DEFAULT_SCENE: SceneSettings = {
  sceneVersion: 1, layoutId: "original", colorId: "sand", finishId: "glaze",
  backdropId: "paper", perchId: "ground", photoFormat: "landscape", stemFibers: false,
};
export function validateScene(value: unknown): SceneSettings {
  if (!value || typeof value !== "object") throw new Error("Invalid saved scene.");
  const s = value as SceneSettings;
  if (s.sceneVersion !== 1 || !VESSEL_PROFILES.some(p => p.id === s.layoutId)
    || !VESSEL_COLORS.some(c => c.id === s.colorId) || !VESSEL_FINISHES.some(f => f.id === s.finishId)
    || !PHOTO_BACKDROPS.some(b => b.id === s.backdropId)
    || !PHOTO_PERCHES.some(perch => perch.id === s.perchId)
    || !["landscape", "portrait", "square"].includes(s.photoFormat)
    || typeof s.stemFibers !== "boolean") throw new Error("This saved scene cannot be opened.");
  return { sceneVersion: 1, layoutId: s.layoutId, colorId: s.colorId, finishId: s.finishId,
    backdropId: s.backdropId, perchId: s.perchId, photoFormat: s.photoFormat, stemFibers: s.stemFibers };
}
export function sceneProfile(scene?: SceneSettings) {
  return VESSEL_PROFILES.find(p => p.id === scene?.layoutId) ?? ORIGINAL_VESSEL;
}
