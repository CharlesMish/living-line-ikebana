import { bendStationAtFraction, GEOMETRY_EPSILON } from "../core/arcLength.ts";
import type { Branch } from "../core/types.ts";

/**
 * Opt-in bend-position experiment. Production acquisition stays on
 * `bendStationAtFraction`'s default (0.54). These fractions are experimental
 * and are always passed through the existing legal-station clamp.
 */
export const BEND_STATION_FRACTIONS = {
  lower: 0.32,
  middle: 0.54,
  upper: 0.76,
} as const;

export type BendStationId = keyof typeof BEND_STATION_FRACTIONS;

export const BEND_STATION_ORDER = ["lower", "middle", "upper"] as const satisfies readonly BendStationId[];

export const DEFAULT_BEND_STATION: BendStationId = "middle";

export type BendStationsMode = "off" | "on" | "excluded";

export interface ResolvedBendStation {
  readonly id: BendStationId;
  readonly fraction: number;
  readonly distance: number;
  /** Requested stations that clamp to this same rest-arc distance, earliest first. */
  readonly aliases: readonly BendStationId[];
}

/** Touch bend is never combined with this experiment. */
export function bendStationsMode(requested: boolean, variant: "bead" | "touch"): BendStationsMode {
  if (!requested) return "off";
  return variant === "touch" ? "excluded" : "on";
}

/**
 * The fixed-versus-touch study records only its own arms. An active
 * bend-stations session must not append those observations. Exclusion
 * (touch wins) leaves the existing touch arm recordable.
 */
export function recordsFixedTouchStudy(mode: BendStationsMode): boolean {
  return mode !== "on";
}

/**
 * One control per distinct clamped distance. Later fractions that land on an
 * earlier station are aliases, not a second handle.
 */
export function resolveBendStations(branch: Branch): ResolvedBendStation[] {
  const resolved: Array<{ id: BendStationId; fraction: number; distance: number; aliases: BendStationId[] }> = [];
  for (const id of BEND_STATION_ORDER) {
    const fraction = BEND_STATION_FRACTIONS[id];
    const distance = bendStationAtFraction(branch, fraction);
    if (distance === null) continue;
    const existing = resolved.find((station) => Math.abs(station.distance - distance) <= GEOMETRY_EPSILON);
    if (existing) {
      existing.aliases.push(id);
      continue;
    }
    resolved.push({ id, fraction, distance, aliases: [id] });
  }
  return resolved;
}

export function selectBendStation(branch: Branch, preference: BendStationId): ResolvedBendStation | null {
  const stations = resolveBendStations(branch);
  if (stations.length === 0) return null;
  return stations.find((station) => station.aliases.includes(preference))
    ?? stations.find((station) => station.aliases.includes(DEFAULT_BEND_STATION))
    ?? stations[0];
}

export function stationChoiceChanges(
  branch: Branch,
  current: BendStationId,
  requested: BendStationId,
): boolean {
  const from = selectBendStation(branch, current);
  const to = selectBendStation(branch, requested);
  if (!from || !to) return false;
  return Math.abs(from.distance - to.distance) > GEOMETRY_EPSILON;
}

/** Temporary UI state. A different branch starts again at Middle. */
export function preferenceAfterBranchChange(
  previousBranchId: string | null,
  nextBranchId: string | null,
  current: BendStationId,
): BendStationId {
  return previousBranchId === nextBranchId ? current : DEFAULT_BEND_STATION;
}

/**
 * Changing station during a live edit cancels through the existing interrupt
 * before the preference — and therefore the bead — is allowed to move.
 * Repeating the current effective station does not cancel.
 */
export function planBendStationChange(input: {
  mode: BendStationsMode;
  transactionActive: boolean;
  branch: Branch | null;
  current: BendStationId;
  requested: BendStationId;
}): { cancelFirst: boolean; preference: BendStationId } {
  if (input.mode !== "on" || !input.branch) {
    return { cancelFirst: false, preference: input.current };
  }
  if (!stationChoiceChanges(input.branch, input.current, input.requested)) {
    return { cancelFirst: false, preference: input.current };
  }
  return {
    cancelFirst: input.transactionActive,
    preference: input.requested,
  };
}
