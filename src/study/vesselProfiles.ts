import type { Vec3 } from "../core/math.ts";

/** Domain-unit footprint, independent of vessel silhouette and camera framing. */
export interface PlantingArea { readonly x: number; readonly z: number; readonly rx: number; readonly rz: number }
export interface VesselProfile {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly scaleX: number;
  readonly scaleZ: number;
  readonly areas: readonly PlantingArea[];
}

export const VESSEL_PROFILES: readonly VesselProfile[] = [
  { id: "original", label: "Original bowl", description: "The current bowl and pin field, at their original scale.", scaleX: 1, scaleZ: 1, areas: [{ x: 0, z: 0, rx: 1.22, rz: 1.22 }] },
  { id: "compact", label: "Compact bowl", description: "A smaller round bowl with a generous central bed.", scaleX: .8, scaleZ: .8, areas: [{ x: 0, z: 0, rx: .92, rz: .92 }] },
  { id: "petite", label: "Petite bowl", description: "An intimate bowl and a tighter bed for a few lines.", scaleX: .64, scaleZ: .64, areas: [{ x: 0, z: 0, rx: .67, rz: .67 }] },
  { id: "offset", label: "Offset oval", description: "An oval bowl with a left-offset bed and an open stretch of water.", scaleX: .98, scaleZ: .68, areas: [{ x: -.45, z: 0, rx: .68, rz: .43 }] },
  { id: "islands", label: "Two islands", description: "The original bowl with two separate beds. Slide a base within its own island.", scaleX: 1, scaleZ: 1, areas: [{ x: -.75, z: 0, rx: .42, rz: .42 }, { x: .75, z: 0, rx: .42, rz: .42 }] },
];
export const ORIGINAL_VESSEL = VESSEL_PROFILES[0];

/** Only explicit study URLs opt in. Unknown values leave ordinary play alone. */
export function readVesselStudy(url: URL): VesselProfile | undefined {
  return VESSEL_PROFILES.find(profile => profile.id === url.searchParams.get("vesselStudy"));
}

function radiusInArea(point: Pick<Vec3, "x" | "z">, area: PlantingArea) {
  return Math.hypot((point.x - area.x) / area.rx, (point.z - area.z) / area.rz);
}

export function inPlantingArea(point: Pick<Vec3, "x" | "z">, profile = ORIGINAL_VESSEL) {
  return profile.areas.some(area => radiusInArea(point, area) <= 1 + 1e-12);
}

function projectToArea(point: Vec3, area: PlantingArea, radius = 1): Vec3 {
  const size = radiusInArea(point, area);
  const scale = size > radius ? radius / size : 1;
  return { x: area.x + (point.x - area.x) * scale, y: point.y, z: area.z + (point.z - area.z) * scale };
}

function nearestArea(point: Vec3, profile: VesselProfile): PlantingArea {
  return [...profile.areas].sort((a, b) => {
    const pa = projectToArea(point, a), pb = projectToArea(point, b);
    return Math.hypot(pa.x - point.x, pa.z - point.z) - Math.hypot(pb.x - point.x, pb.z - point.z);
  })[0];
}

/** Lock the connected component at acquisition; never slide across unpinned water.
 * Imported out-of-field roots retain their acquisition extent for that grab.
 * This explicit legacy allowance avoids a snap and shrinks after inward releases.
 */
export function constrainBaseToProfile(request: Vec3, acquiredBase: Vec3, profile = ORIGINAL_VESSEL): Vec3 {
  const area = nearestArea(acquiredBase, profile);
  return projectToArea({ ...request, y: acquiredBase.y }, area, Math.max(1, radiusInArea(acquiredBase, area)));
}

export function nearestPlantingPoint(request: Vec3, profile = ORIGINAL_VESSEL): Vec3 {
  return projectToArea(request, nearestArea(request, profile));
}

export function keyboardPlantingPoint(ordinal: number, profile = ORIGINAL_VESSEL): Vec3 {
  const area = profile.areas[(ordinal - 1) % profile.areas.length];
  const localOrdinal = Math.floor((ordinal - 1) / profile.areas.length);
  const angle = localOrdinal * 2.399963;
  const radius = Math.min(.86 / 1.22, Math.sqrt(localOrdinal) * .28 / 1.22);
  return { x: area.x + Math.sin(angle) * radius * area.rx, y: .55, z: area.z + Math.cos(angle) * radius * area.rz };
}

/** A profile is a separate experimental document namespace, never a migration. */
export function vesselStudyStorageKey(profile: VesselProfile | undefined, kind: "studio" | "garden" | "telemetry", workbench = false): string | undefined {
  if (profile) return `ikebana-web-alpha:vessel-study-v1:${profile.id}:${workbench ? "workbench-" : ""}${kind}`;
  return workbench ? `ikebana-web-alpha:workbench-${kind}-v1` : undefined;
}
