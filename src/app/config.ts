import { readVesselStudy, type VesselProfile } from "../study/vesselProfiles.ts";
import type { FanLeafDraw, PinnateDraw } from "../presentation/botanicalGeometry.ts";
import { bendStationsMode, type BendStationsMode } from "./bendStations.ts";

export type BendVariant = "bead" | "touch";

const PINNATE_DRAWS = ["baseline", "tapered", "quilled"] as const;
const FAN_LEAF_DRAWS = ["shared", "spray", "separated"] as const;

function drawParam<T extends string>(url: URL, key: string, allowed: readonly T[]): T | undefined {
  const value = url.searchParams.get(key);
  return value && (allowed as readonly string[]).includes(value) ? value as T : undefined;
}

export type ExperimentConfig = {
  vesselProfile?: VesselProfile;
  bendVariant: BendVariant;
  bendStationsRequested: boolean;
  bendStationsMode: BendStationsMode;
  debug: boolean;
  workbench: boolean;
  /** Starts a clean specimen/arrangement session. Never touches study telemetry. */
  fresh: boolean;
  /**
   * Presentation comparison switches. Absent means the accepted draw.
   * They never change a canonical graph, ordinal, or saved arrangement.
   */
  pinnateDraw?: PinnateDraw;
  fanLeafDraw?: FanLeafDraw;
  /**
   * Explicitly wipes accumulated acquisition telemetry (see
   * `docs/BEHAVIORAL_CONTRACT.md` §8). Deliberately a separate flag from
   * `fresh`: resetting the visual arrangement between test blocks must never
   * silently delete the comparison data those blocks exist to produce.
   */
  clearStudyData: boolean;
  /**
   * Readable planting boundary. Absent leaves the plate and the drag-only
   * outline exactly as ordinary play. See the named experiment in the contract.
   */
  placeCue: boolean;
  /**
   * Source-card tap to ready, then tap the scene to seat. Implies `placeCue`.
   * Absent keeps pointerdown on the source card as an immediate drag.
   */
  placeTap: boolean;
};

/**
 * Opaque bake for standalone study files. `tools/build-standalone.mjs` may set
 * `globalThis.__LL_PLACE__` to `"1"` (boundary cue) or `"2"` (cue and tap).
 * Any other value, including absence, is ordinary play. URL flags still work.
 */
export function bakedPlaceMode(scope: typeof globalThis = globalThis): "off" | "cue" | "tap" {
  const token = (scope as { __LL_PLACE__?: unknown }).__LL_PLACE__;
  if (token === "1") return "cue";
  if (token === "2") return "tap";
  return "off";
}

export function placeFlagsFrom(url: URL, baked = bakedPlaceMode()): { placeCue: boolean; placeTap: boolean } {
  const placeTap = url.searchParams.get("placeTap") === "1" || baked === "tap";
  const placeCue = placeTap || url.searchParams.get("placeCue") === "1" || baked === "cue";
  return { placeCue, placeTap };
}

export function readExperimentConfig(url = new URL(window.location.href)): ExperimentConfig {
  const bend = url.searchParams.get("bend");
  const bendVariant = bend === "touch" ? "touch" : "bead";
  const bendStationsRequested = url.searchParams.get("experiment") === "bend-stations";
  const place = placeFlagsFrom(url);
  return {
    vesselProfile: readVesselStudy(url),
    bendVariant,
    bendStationsRequested,
    bendStationsMode: bendStationsMode(bendStationsRequested, bendVariant),
    debug: url.searchParams.get("debug") === "1",
    workbench: url.searchParams.get("workbench") === "1",
    fresh: url.searchParams.get("fresh") === "1",
    clearStudyData: url.searchParams.get("clearStudyData") === "1",
    pinnateDraw: drawParam(url, "pinnate", PINNATE_DRAWS),
    fanLeafDraw: drawParam(url, "fanLeaf", FAN_LEAF_DRAWS),
    placeCue: place.placeCue,
    placeTap: place.placeTap,
  };
}

export function urlForBendVariant(variant: BendVariant, current = new URL(window.location.href)) {
  const next = new URL(current);
  if (variant === "bead") next.searchParams.delete("bend");
  else next.searchParams.set("bend", "touch");
  next.searchParams.delete("fresh");
  // clearStudyData is one-shot; it must never stick around into a URL a
  // later variant switch (or any other replaceState) produces.
  next.searchParams.delete("clearStudyData");
  return next;
}

/**
 * `?clearStudyData=1` is a one-shot command: after it has been acted on
 * once, the app must strip it from the current URL (via `history.replaceState`)
 * so an ordinary reload of that same address never re-clears study data.
 */
export function urlWithoutClearStudyData(current = new URL(window.location.href)): URL {
  const next = new URL(current);
  next.searchParams.delete("clearStudyData");
  return next;
}
