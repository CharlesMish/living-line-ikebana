# Material references and extension contract

**Current status:** the seven materials in the tables below remain. Round 4 appends foliage fan, blossom spray, and nodding flower, in that order. Phase 2 appends berry twig, then fern frond. Neither is part of `round4-palette`.
The former flower Aim dead zone and visible-surface acquisition gaps are fixed;
see [the correction report](development/FLOWER_AIM_POLISH.md). The two original
references remain the comparison pair. Sections describing earlier prototype
pauses are historical, not the current dispatch. The next proposed work is in
[the Round 4 coordinator brief](development/GROK_BOT_ROUND4.md).

This is a working extension contract, pending phone and composition review.
Keep the flowering and leafy references together when proposing another material.
The existing behavioral contract is preserved. `leafy-shoot-v1`, `bare-branch-v1`,
`single-flower-v1`, `reed-v1`, `flower-volume-v1`, `arching-trailer-v1`,
`foliage-fan-v1`, `blossom-spray-v1`, `nodding-flower-v1`, `berry-twig-v1`, and `fern-frond-v1` are additive.
Catalog order is flowering → leafy → bare-branch → single-flower →
reed → flower-volume → arching-trailer → foliage-fan → blossom-spray → nodding-flower → berry-twig → fern-frond.
`round4-palette` stops at nodding flower.

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

## Accepted Round 4 cuttings

`foliage-fan-v1`, `blossom-spray-v1`, and `nodding-flower-v1` are appended after
the seven established materials, in that lane order. They do not change those
generators, fixtures, or the orders above. `reference-pair`, `mixed`, `all-four`,
`round3-three`, and `round3-palette` do not list them.

`references-plus-foliage-fan`, `references-plus-blossom-spray`, and
`references-plus-nodding-flower` are flowering → leafy → that cutting.
`blossom-compare` is flowering branch → flower volume → blossom spray.
`round4-candidates` is foliage-fan → blossom-spray → nodding-flower.
`round4-palette` is the seven established materials, then those three.

| Cutting | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Foliage fan / `foliage-fan-v1` | One stem, three lateral arms, eight small leaves on those arms. A basal span stays below the first arm | Yellow-green stock `0x7c9a34`; existing elliptic leaves, smaller than the leafy shoot's blades | Stem `0.47`, arms `0.36`, stalks `0.18`, copied once. Shared solver |
| Blossom spray / `blossom-spray-v1` | Thin green stem and two or three laterals. Four to six small flowers, each a pedicel and one bloom on a lateral, with open space between them | Existing tufted bloom, pale `0xf6d0d8`. Stem `0x7d9a55`, roughness `0.66`. Same tuft hit radius `0.56` as flower volume | Stem `0.48`, laterals `0.41`, stalks `0.18`. Copied once. Shared solver |
| Nodding flower / `nodding-flower-v1` | One supporting stem, one leaf, and one pedicel neck whose rest curve ends downward. The bell opens along that neck | Bell `0x7d94b8`, roughness `0.56`, hit radius `0.66` centered at local Y `0.32`. Stem `0x516846` | Stem `0.48`, stalk `0.18`, copied once. The neck is rest geometry. Shared solver |

Cutting the foliage fan's opening arm deactivates that arm's leaf stalks and
leaves and leaves the answering and crown arms unchanged. A blossom-spray
flower-stalk cut removes that one bloom. A lateral cut removes that group's
descendant stalks and blooms and leaves the stem and the other groups. Those
cuts are graph facts. They do not add a draw call. The fan's leaves stay
separate organs on the existing elliptic surface. The blossom spray uses the
existing tufted bloom. The nodding flower uses one bell shell along the
supporting tangent. Cupped, open-face, and tufted blooms keep their radial
paths. None of these cuttings is a named species.

## Phase 2 candidates

`berry-twig-v1` and `fern-frond-v1` are appended after the ten materials above,
in that order. They do not change those generators, fixtures, or the orders
above. `reference-pair`, `mixed`, `all-four`, `round3-three`, `round3-palette`,
`round4-candidates`, and `round4-palette` do not list them.
`references-plus-berry-twig` is flowering → leafy → berry twig.
`references-plus-fern-frond` is flowering → leafy → fern-frond.
`round5-candidates` is berry twig → fern frond.
`round5-palette` is the Round 4 ten, then those two. It is not `round4-palette`.
`all-registered-materials` is still the only dynamic cycle; a count of 6 still
stops at flower volume and omits both Phase 2 cuttings.

| Cutting | Structure | Appearance | Bend response |
| --- | --- | --- | --- |
| Berry twig / `berry-twig-v1` | One woody twig, two or three short laterals, and three or four berries on each lateral. Each berry is one short pedicel and one berry organ at that tip | Warm wood `0x6a4532`, roughness `0.9`. One low-poly berry sphere `0x8a2e45`, roughness `0.4`, radius `0.07`, hit radius `0.145` centered at local Y `0.055`. Unused leaf and bloom slots copy flowering | Wood `0.78`, cluster `0.52`, berry stem `0.18`, copied once. Shared solver. Pedicels are not bend handles |
| Fern frond / `fern-frond-v1` | One 16-segment rachis and eight alternating pinna stalks. Each stalk carries one divided pinna, not a swarm of pinnules. A basal span stays below the first pinna | Rachis `0x2c5c45`, roughness `0.72`. Pinnae use a new `pinnate` surface: a costa plus three pairs of separate pinnules, color `0x7eae62`. Hit radius `0.78` centered at local Y `0.56`. No bloom is generated | Rachis `0.43`, stalks `0.18`, copied once. Stalks are petioles, so the shared solver bends the rachis only |

Cutting one berry stem deactivates that berry and leaves the other berries on the same lateral. Cutting the lateral deactivates that cluster’s stems and berries and leaves the wood and the other clusters. Those cuts are graph facts. Each berry is one sphere draw. Removing a cluster hides those spheres and does not allocate a new mesh. This is a generic woody accent, not a named species, and not a recolored blossom or a packed flower head.

Cutting one pinna stalk deactivates that one blade and leaves the other seven.
Cutting the rachis between the fourth and fifth pinna deactivates the upper
four stalks and blades and leaves the basal four unchanged. Those cuts are
graph facts. The pinnules are triangles in one organ mesh, not extra organs
and not a textured card. This is a generic study, not a named species.

The trailer’s centered rest pose crosses the open water and stays clear of the
ceramic: Lane C measured 0.168 of water clearance and 0.089 of rim clearance
after radii. An edge seat is a different event. The cane passes over the lip
and the free end overhangs past the rim. A downward bend can penetrate the
water, and a saturated bend can go through the basin floor. Overhang and
penetration stay separate. No collision response was added.
