/** Authored bend response, copied into the graph at generation and then persisted.
 * These values bound the shared bend solver; they are not physical elasticity,
 * springback, or breakage. Never reapply a profile to a loaded or edited graph.
 */
export const FLOWERING_RESPONSE = Object.freeze({
  trunk: 0.72, lowerLateral: 0.52, upperLateral: 0.5,
  crown: 0.38, twig: 0.34, stalk: 0.18,
});
export const LEAFY_RESPONSE = Object.freeze({ stem: 0.39, stalk: 0.18 });
export const BARE_RESPONSE = Object.freeze({
  trunk: 0.86, answering: 0.66, counter: 0.60, distal: 0.50, spur: 0.42,
});
export const SINGLE_FLOWER_RESPONSE = Object.freeze({ stem: 0.46, stalk: 0.18 });
/** One culm. More yielding than flowering wood (0.72), less than a leafy stem (0.39). */
export const REED_RESPONSE = Object.freeze({ culm: 0.56 });
/** Stem carries a flower head: stiffer than a single slender stem, softer than woody stock. */
export const FLOWER_VOLUME_RESPONSE = Object.freeze({ stem: 0.55, group: 0.2, stalk: 0.18 });
/** Supple cane: more yielding than flowering wood (0.72), less ribbon-like than the leafy stem (0.39). */
export const ARCHING_TRAILER_RESPONSE = Object.freeze({ cane: 0.5, stalk: 0.18 });
/**
 * Thin green spray. The stem is softer than a flower-volume stem (0.55) and
 * much softer than flowering wood (0.72). Laterals yield more than flowering
 * side branches (0.50–0.52). Stalks match the shared stalk value. Copied once.
 */
export const BLOSSOM_SPRAY_RESPONSE = Object.freeze({ stem: 0.48, lateral: 0.41, stalk: 0.18 });
