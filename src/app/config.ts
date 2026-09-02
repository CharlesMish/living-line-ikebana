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

/**
 * Internal buckets stay `bead` / `touch`. The public query is:
 * bare URL and `?bend=touch` → touch (ordinary default);
 * `?bend=fixed` (or the internal alias `bead`) → fixed-bead fallback.
 */
export function bendVariantFromSearch(search: string): BendVariant {
  const params = search.startsWith("http://") || search.startsWith("https://")
    ? new URL(search).searchParams
    : new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = params.get("bend")?.trim().toLowerCase();
  return raw === "fixed" || raw === "bead" ? "bead" : "touch";
}

export function readExperimentConfig(url = new URL(window.location.href)): ExperimentConfig {
  return {
    bendVariant: bendVariantFromSearch(url.search),
    debug: url.searchParams.get("debug") === "1",
    fresh: url.searchParams.get("fresh") === "1",
    clearStudyData: url.searchParams.get("clearStudyData") === "1",
  };
}

export function urlForBendVariant(variant: BendVariant, current = new URL(window.location.href)) {
  const next = new URL(current);
  if (variant === "touch") next.searchParams.delete("bend");
  else next.searchParams.set("bend", "fixed");
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
