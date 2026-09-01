export type BendVariant = "bead" | "touch";

export type ExperimentConfig = {
  bendVariant: BendVariant;
  debug: boolean;
  /** Starts a clean specimen/arrangement session. Never touches study telemetry. */
  fresh: boolean;
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
    fresh: url.searchParams.get("fresh") === "1",
    clearStudyData: url.searchParams.get("clearStudyData") === "1",
  };
}

export function urlForBendVariant(variant: BendVariant, current = new URL(window.location.href)) {
  const next = new URL(current);
  if (variant === "bead") next.searchParams.delete("bend");
  else next.searchParams.set("bend", "touch");
  next.searchParams.delete("fresh");
  return next;
}
