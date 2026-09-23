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
/** Spray stem holds a fan better than the leafy ribbon (0.39) and yields more than a reed (0.56). Arms open more readily than the stem. */
export const FOLIAGE_FAN_RESPONSE = Object.freeze({ stem: 0.47, arm: 0.36, stalk: 0.18 });
/**
 * Thin green spray. The stem is softer than a flower-volume stem (0.55) and
 * much softer than flowering wood (0.72). Laterals yield more than flowering
 * side branches (0.50–0.52). Stalks match the shared stalk value. Copied once.
 */
export const BLOSSOM_SPRAY_RESPONSE = Object.freeze({ stem: 0.48, lateral: 0.41, stalk: 0.18 });
/** Supporting stem close to the single flower. The neck is rest geometry, not a softer solver. */
export const NODDING_FLOWER_RESPONSE = Object.freeze({ stem: 0.48, stalk: 0.18 });
/**
 * Woody twig. The main line sits between flowering wood (0.72) and bare wood
 * (0.86). A cluster lateral can be aimed and bent. Berry stems use the shared
 * stalk value and are not bend handles. Copied once.
 */
export const BERRY_TWIG_RESPONSE = Object.freeze({ wood: 0.78, cluster: 0.52, stem: 0.18 });
/**
 * Fine rachis. More yielding than the foliage-fan stem (0.47) and stiffer than
 * the leafy ribbon (0.39). Stalks match the shared stalk value. Copied once.
 * Pinna stalks are petioles, so the shared solver bends the rachis only.
 */
export const FERN_FROND_RESPONSE = Object.freeze({ rachis: 0.43, stalk: 0.18 });
