# Material references and extension contract

**Current status after PR #33:** all seven materials listed below are on main.
The former flower Aim dead zone and visible-surface acquisition gaps are fixed;
see [the correction report](development/FLOWER_AIM_POLISH.md). The two original
references remain the comparison pair. Sections describing earlier prototype
pauses are historical, not the current dispatch. The next proposed work is in
[the Round 4 coordinator brief](development/GROK_BOT_ROUND4.md).

This is a working extension contract, pending phone and composition review.
Keep the flowering and leafy references together when proposing another material.
The existing behavioral contract is preserved. `leafy-shoot-v1`, `bare-branch-v1`,
`single-flower-v1`, `reed-v1`, `flower-volume-v1`, and `arching-trailer-v1` are
additive. Catalog order is flowering → leafy → bare-branch → single-flower →
reed → flower-volume → arching-trailer.

| Reference | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Flowering branch / `one-branch-v1` | Existing woody hierarchy; 15 branches, 10 organs; fixture unchanged | Brown stock, restrained green leaves, softer pink cupped blooms | Existing trunk stiffness 0.72 and graded side branches preserved |
| Leafy shoot / `leafy-shoot-v1` | One 16-segment stem, 7 alternating petioles and leaves; clear basal span; smaller crown leaves | Slim green stock; longer curved, creased blades with stable midribs | Main stem stiffness 0.39; shared solver, stronger permitted response |
| Bare branch / `bare-branch-v1` | Sparse woody line: 5 branches, zero organs; answering/counter/distal forks plus a restrained spur | Cooler/drier bark; unused leaf/bloom slots copy flowering because appearance records require them | Trunk stiffness 0.86; stiffer primary line than the flowering reference |
| Single flower / `single-flower-v1` | Slender stem, two modest leaves, one terminal bloom on a pedicel | Cream open-face five-petal bloom; cupped seven-petal flowering path retained | Stem stiffness 0.46; stalks 0.18; shared solver |

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
- **Integration:** register generator and tray identity in `materialCatalog.ts`.
  Persistent chrome is one selected-cutting source plus a Materials picker, not
  one extra full-width card per material. Pointer and keyboard insertion bind
  only to the selected source (`[data-material-id]`). A new profile requiring
  another organ renderer is an integration proposal, not permission to modify
  shared interaction.

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
and the compact source card plus Materials picker does not crowd the top rail.
Persistent chrome height must stay one selected card, not one extra row per
material. In a short landscape window, Step Back → Pan should move the bowl,
pins and stems together as framing. Return to Arrange and confirm both bases
are still seated. Check that water and pin access are useful from Above. The
picker reduces crown occlusion versus a four-card stack; remaining occlusion
from the top rail is a framing limit, not a reason to rewrite cameras. Numeric
tests cannot sign off these observations.

## Historical Round 2 prototype round

Round 2 integration brings both prototype candidates onto one review branch:
a sparse bare woody line (`bare-branch-v1`, zero organs) and a single flower
face (`single-flower-v1`, appearance-driven open-face bloom beside the retained
cupped flowering path). They remain review candidates, not a shipping palette
commitment. Original PRs #15 and #16 stay intact.

Workbench `mixed` is a compatibility alias of `reference-pair` (flowering + leafy
only). It does not cycle the live catalog. Named comparison profiles and the
picker contract live in
[`src/app/workbenchProfiles.ts`](../src/app/workbenchProfiles.ts) and
[Workbench fixture profiles](development/WORKBENCH_FIXTURE_PROFILES.md).
`all-registered-materials` is the labeled dynamic catalog cycle.

## Historical two-reference palette pause

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

## Round 3 cuttings, now merged

Reed, flower volume, and the arching trailer were integrated together and are
now on main. Catalog order keeps the four established materials,
then appends `reed`, `flower-volume`, and `arching-trailer`. Each has a Materials
choice and a source template. `reference-pair` and `all-four` do not list them. Named profiles
`references-plus-reed`, `references-plus-flower-volume`,
`references-plus-arching-trailer`, `round3-three`, and `round3-palette` are the
comparison sets. `all-registered-materials` still cycles the live catalog.

| Cutting | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Reed / `reed-v1` | One 16-segment culm, zero organs. Length is one later seeded sample in `3.35..6.25` | Olive culm `0x4e6240`, roughness `0.8` | Culm stiffness `0.56`, copied once. Shared solver |
| Flower volume / `flower-volume-v1` | One stem, two modest leaves, five flower-bearing pedicel groups packed into one head | Tufted eight-petal cups in a dusty rose; darker green stem than the single flower | Stem stiffness `0.55`; groups `0.2`; leaf stalks `0.18`; shared solver |
| Arching trailer / `arching-trailer-v1` | One authored arching cane and three small leaves on the descending limb | Cool blue-green cane `0x3d6d62`, roughness `0.58` | Cane stiffness `0.50`; petioles `0.18`. Shared single station. No bowl collision |

Each flower-volume group is one pedicel and one bloom. Pruning that pedicel
deactivates that bloom and leaves the other groups unchanged. That cut is a
graph fact. The current renderer draws one instanced mesh per bloom; a group
cut does not require a separate draw call.

## Provisional Round 4 candidate

`foliage-fan-v1` / `foliage-fan` is appended after the seven established
materials. It does not change their generators, fixtures, or the order above.
`reference-pair`, `mixed`, `all-four`, `round3-three`, and `round3-palette`
do not list it. `references-plus-foliage-fan` is a provisional comparison
profile (flowering → leafy → foliage-fan) so the spray can be played beside
the leafy shoot. The integrator decides the final Round 4 profile set.

| Cutting | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Foliage fan / `foliage-fan-v1` | One stem, three lateral arms, eight small leaves on those arms. A basal span stays below the first arm | Yellow-green stock `0x7c9a34`; existing elliptic leaves, smaller than the leafy shoot's blades | Stem `0.47`, arms `0.36`, stalks `0.18`, copied once. Shared solver |

Cutting the opening arm deactivates that arm's leaf stalks and leaves and
leaves the answering and crown arms unchanged. That cut is a graph fact. It
does not add a draw call. The leaves stay separate organs on the existing
elliptic surface. This is a group of leaves, not a deformable broad blade,
and it is not a named species.

The trailer’s centered rest pose crosses the open water and stays clear of the
ceramic: Lane C measured 0.168 of water clearance and 0.089 of rim clearance
after radii. An edge seat is a different event. The cane passes over the lip
and the free end overhangs past the rim. A downward bend can penetrate the
water, and a saturated bend can go through the basin floor. Overhang and
penetration stay separate. No collision response was added.
