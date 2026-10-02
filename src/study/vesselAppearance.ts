import { vesselParts, type VesselProfile } from "./vesselProfiles.ts";

/** Renderer-free settings shared by main, comparison and a future photo studio. */
export interface VesselAppearanceChoice { colorId: string; finishId: string }
export const VESSEL_COLORS = [
  { id: "sand", label: "Sand", color: 0xbcb09b, rimColor: 0xd2c7b3 },
  { id: "celadon", label: "Celadon", color: 0x82998c, rimColor: 0xa0b5a7 },
  { id: "charcoal", label: "Charcoal", color: 0x414a49, rimColor: 0x64706c },
] as const;
export const VESSEL_FINISHES = [
  { id: "glaze", label: "Glaze", roughness: .38, clearcoat: .65, rimRoughness: .35, grain: false },
  { id: "stoneware", label: "Stoneware", roughness: .76, clearcoat: .06, rimRoughness: .72, grain: true },
] as const;
export const DEFAULT_VESSEL_APPEARANCE: VesselAppearanceChoice = { colorId: "sand", finishId: "glaze" };

export function resolveVesselAppearance(choice: Partial<VesselAppearanceChoice> = {}) {
  const color = VESSEL_COLORS.find(item => item.id === choice.colorId) ?? VESSEL_COLORS[0];
  const finish = VESSEL_FINISHES.find(item => item.id === choice.finishId) ?? VESSEL_FINISHES[0];
  return {
    choice: { colorId: color.id, finishId: finish.id },
    colorSpace: "srgb" as const,
    color: color.color, rimColor: color.rimColor,
    roughness: finish.roughness, clearcoat: finish.clearcoat, rimRoughness: finish.rimRoughness,
    grain: finish.grain, bumpScale: finish.grain ? .008 : 0,
  };
}

export function readVesselAppearance(url: URL): VesselAppearanceChoice {
  return resolveVesselAppearance({ colorId: url.searchParams.get("vesselColor") ?? undefined, finishId: url.searchParams.get("vesselFinish") ?? undefined }).choice;
}

export function vesselAppearanceURL(choice: VesselAppearanceChoice, current: URL): URL {
  const next = new URL(current), safe = resolveVesselAppearance(choice).choice;
  next.searchParams.set("vesselColor", safe.colorId);
  next.searchParams.set("vesselFinish", safe.finishId);
  next.searchParams.delete("fresh"); next.searchParams.delete("clearStudyData");
  return next;
}

/** Ceramic support extents for staging. These are not planting boundaries.
 * Each renderer owns its own disposable materials; no GPU objects cross lanes. */
export function resolveVesselPresentation(profile: VesselProfile, appearance: VesselAppearanceChoice) {
  const safe = resolveVesselAppearance(appearance).choice;
  return { layoutId: profile.id, vessels: vesselParts(profile).map(part => ({
    partId: part.partId, appearance: { ...safe }, contactY: .04,
    footprintXZ: { minX: part.x - 2.64 * part.scaleX, maxX: part.x + 2.64 * part.scaleX,
      minZ: part.z - 2.64 * part.scaleZ, maxZ: part.z + 2.64 * part.scaleZ },
  })) };
}
