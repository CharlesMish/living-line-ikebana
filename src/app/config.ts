import type { FanLeafDraw, PinnateDraw } from "../presentation/botanicalGeometry.ts";

export type BendVariant = "bead" | "touch";

const PINNATE_DRAWS = ["baseline", "tapered", "quilled"] as const;
const FAN_LEAF_DRAWS = ["shared", "spray", "separated"] as const;

function drawParam<T extends string>(url: URL, key: string, allowed: readonly T[]): T | undefined {
  const value = url.searchParams.get(key);
  return value && (allowed as readonly string[]).includes(value) ? value as T : undefined;
}

export type ExperimentConfig = {
  bendVariant: BendVariant;
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
};

export function readExperimentConfig(url = new URL(window.location.href)): ExperimentConfig {
  const bend = url.searchParams.get("bend");
  return {
    bendVariant: bend === "touch" ? "touch" : "bead",
    debug: url.searchParams.get("debug") === "1",
    workbench: url.searchParams.get("workbench") === "1",
    fresh: url.searchParams.get("fresh") === "1",
    clearStudyData: url.searchParams.get("clearStudyData") === "1",
    pinnateDraw: drawParam(url, "pinnate", PINNATE_DRAWS),
    fanLeafDraw: drawParam(url, "fanLeaf", FAN_LEAF_DRAWS),
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
