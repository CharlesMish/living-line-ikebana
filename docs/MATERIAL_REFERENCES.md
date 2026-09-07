# Two material references — initial tuning pass

This is a working extension contract, pending phone and composition review.
Keep the flowering and leafy references together when proposing another material.
The existing behavioral contract is preserved; `leafy-shoot-v1` is additive.

| Reference | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Flowering branch / `one-branch-v1` | Existing woody hierarchy; 15 branches, 10 organs; fixture unchanged | Brown stock, restrained green leaves, softer pink cupped blooms | Existing trunk stiffness 0.72 and graded side branches preserved |
| Leafy shoot / `leafy-shoot-v1` | One 16-segment stem, 7 alternating petioles and leaves; clear basal span; smaller crown leaves | Slim green stock; longer curved, creased blades with stable midribs | Main stem stiffness 0.39; shared solver, stronger permitted response |

These are generic authored cuttings, not botanical species simulations. The shoot's
leaves have curved surfaces and follow the supporting material frame; the player
cannot independently bend a leaf blade. Stiffness bounds a bend operation. It does
not simulate elasticity, springback, snapping, gravity or a material's real limits.
Flowering topology and response have deliberately retained their fixture values;
this pass tunes its palette alongside the new shoot.

## Extension points

- **Structure:** add a versioned generator beside `src/core/leafyShoot.ts`. Use
  `generatorSupport.ts` for fixed-length chains and attached branch records.
  Generate once from `(id, seed, base)`; persist all botanical identity and detail.
- **Response:** author bounded values in `src/core/materialResponse.ts`, copied
  into the initial graph. Never apply a profile during load or live editing.
- **Appearance:** register the version in `src/presentation/materialAppearance.ts`.
  Add deterministic surface functions to `botanicalGeometry.ts` if needed. Keep
  surfaces, normals and colors stable across edits and renderer recreation.
- **Integration:** register generator and tray identity in `materialCatalog.ts`;
  add a labeled material card in `index.html`. Existing bindings already handle
  pointer and keyboard placement. A new profile requiring another organ renderer
  is an integration proposal, not permission to modify shared interaction.

Appearance must cover both committed and pending/cut-ghost material. Check visible
bounds against hit proxies. Longer leafy blades use a centered acquisition sphere;
selection, cut routing and arbitration priorities are shared. A stem's `trunk`
kind describes topology, not brown wood.

## Reproducible checks

Use successful ordinals 1, 2, 3, 17 and 64. The first two seeds are 8278 and 9255.
The existing flowering fixture and `fixtures/plant-2-leafy-shoot-v1.json` are
reference snapshots. Cancelled reservations reuse the ordinal across materials.

Automated coverage checks the old fixture, seeded generation, attachment validity,
rest-length preservation, exact leaf removal, retained cut history, stable visual
arrays, leafy hit bounds, mixed-material cancellation and production document load.
Run `npm ci` and `npm run verify` before delivery.

On a physical phone, place one of each on opposite sides of the same pin field.
Inspect Front, ¾ and Above. Bend both, cut one leaf stalk, cancel a cut and reload.
Check whether the shoot feels more yielding, its individual leaves remain legible,
and neither tray card crowds the top rail. In a short landscape window, Step Back
→ Move should move the bowl, pins and stems together as framing. Return to Arrange
and confirm both bases are still seated. Check that water and pin access are useful
from Above. Numeric tests cannot sign off these observations.

## First outsourced candidate, after that review

Prefer one bare twig: it tests useful branching and negative space without another
flower-face renderer. Provide both references, the two fixtures, this file, AGENTS,
and the behavioral contract. Limit the candidate to its generator, response,
appearance, catalog/card integration and focused tests. Request a branch plus a
short phone clip covering insert → bend → cut → cancel → reload next to both refs.

Do not modify transactions, cancellation, camera modes, insertion ordinals,
`one-branch-v1`, schema or persistence fields. If a material cannot fit this contract,
return the smallest proposed extension for discussion. Add no new craft verbs.
Broad-leaf manipulation waits for a meaningful blade-deformation model. A single
flower is a later facing/presentation study; iris or waterline clusters remain
ideas for a later palette, not commitments in this pass.
