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
→ Pan should move the bowl, pins and stems together as framing. Return to Arrange
and confirm both bases are still seated. Check that water and pin access are useful
from Above. Numeric tests cannot sign off these observations.

## Further materials are paused

The consolidated review supersedes the earlier bare-twig-first recommendation.
No third material has been selected or commissioned. Multiple copies of either
existing cutting already work; use them to test relations between lines now.

Use [the observational phone card](LOOKING_REFINEMENT.md) to identify a missing
compositional decision before choosing another material. A broad leaf, strong
flower face, reed-like line, floral mass or bare twig is a candidate only if it
addresses that observed gap. Broad-leaf manipulation still requires meaningful
blade deformation rather than pretending a rigid surface can be bent.

When a candidate is chosen, provide both references, the two fixtures, this file,
AGENTS and the behavioral contract. Limit work to its generator, response,
appearance, catalog/card integration and focused tests. Request a branch plus a
short phone clip covering insert → bend → cut → cancel → reload beside both refs.
Do not modify transactions, cancellation, cameras, insertion ordinals,
`one-branch-v1`, schema or persistence fields. Return any necessary interface
extension as a proposal. Add no new craft verbs inside a material prototype.
