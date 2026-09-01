export type BendVariant = "bead" | "touch";

export type ExperimentConfig = {
  bendVariant: BendVariant;
  debug: boolean;
  fresh: boolean;
};

export function readExperimentConfig(url = new URL(window.location.href)): ExperimentConfig {
  const bend = url.searchParams.get("bend");
  return {
    bendVariant: bend === "touch" ? "touch" : "bead",
    debug: url.searchParams.get("debug") === "1",
    fresh: url.searchParams.get("fresh") === "1",
  };
}

export function urlForBendVariant(variant: BendVariant, current = new URL(window.location.href)) {
  const next = new URL(current);
  if (variant === "bead") next.searchParams.delete("bend");
  else next.searchParams.set("bend", "touch");
  next.searchParams.delete("fresh");
  return next;
}
