/** Authored bend response, copied into the graph at generation and then persisted.
 * These values bound the shared bend solver; they are not physical elasticity,
 * springback, or breakage. Never reapply a profile to a loaded or edited graph.
 */
export const FLOWERING_RESPONSE = Object.freeze({
  trunk: 0.72, lowerLateral: 0.52, upperLateral: 0.5,
  crown: 0.38, twig: 0.34, stalk: 0.18,
});
export const LEAFY_RESPONSE = Object.freeze({ stem: 0.39, stalk: 0.18 });
