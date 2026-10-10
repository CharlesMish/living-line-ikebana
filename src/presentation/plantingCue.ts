import type { PlantingArea, VesselProfile } from "../study/vesselProfiles.ts";
import { inPlantingArea } from "../study/vesselProfiles.ts";

/**
 * Local radii of the support plate, before each area's rx/rz scale.
 * The accepted bed is the validation ellipse (1.22 on Original). The plate
 * top is wider; that annulus is a rim, not more pins.
 */
export const PLANTING_BED_RADIUS = 1.22;
export const PLANTING_PLATE_TOP_RADIUS = 1.34;
export const PLANTING_PLATE_BOTTOM_RADIUS = 1.36;

/** The cue is these ellipses and no others. Same objects validation uses. */
export function plantingCueEllipses(profile: VesselProfile): readonly PlantingArea[] {
  return profile.areas;
}

export function plantingCueContains(point: { x: number; z: number }, profile: VesselProfile): boolean {
  return inPlantingArea(point, profile);
}

export function supportPlateRadii(showRim: boolean): { top: number; bottom: number } {
  return showRim
    ? { top: PLANTING_BED_RADIUS, bottom: PLANTING_BED_RADIUS }
    : { top: PLANTING_PLATE_TOP_RADIUS, bottom: PLANTING_PLATE_BOTTOM_RADIUS };
}

/** Top footprint of the wider plate, in the same local scale as the bed. */
export function plateTopContains(point: { x: number; z: number }, area: PlantingArea): boolean {
  const scaleX = area.rx / PLANTING_BED_RADIUS;
  const scaleZ = area.rz / PLANTING_BED_RADIUS;
  const nx = (point.x - area.x) / (PLANTING_PLATE_TOP_RADIUS * scaleX);
  const nz = (point.z - area.z) / (PLANTING_PLATE_TOP_RADIUS * scaleZ);
  return Math.hypot(nx, nz) <= 1 + 1e-12;
}

/** Inside the plate and outside every accepted planting ellipse. */
export function isPlateRim(point: { x: number; z: number }, profile: VesselProfile): boolean {
  return !plantingCueContains(point, profile) && profile.areas.some((area) => plateTopContains(point, area));
}
