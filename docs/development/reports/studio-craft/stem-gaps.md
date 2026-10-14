# Stem gaps: two candidate cards, no catalog change

Assessment made against PR #87 source at `51901de23132b5a5579798f8ac77cee9434a0a17`, plus the paused paired-leaf revision at `3495a00`. This is a source and reference review, not a new playtest. No generator, material, fixture, or saved document changed.

## Recommendation

Keep this studio pass focused on the existing work. There are two worthwhile material directions: a sparse **lobed-leaf branch** is the best bounded new prototype, and a **single broad blade** is the stronger long-term craft extension. Neither is needed to justify the current presentation improvements.

The paired leaf remains the cheapest unfinished material comparison, because the candidate already exists. It is not automatically the best next addition. Its failed player comparisons left its usefulness unknown; successful desktop persistence checks did not answer that question. If another material session is commissioned, give the paired leaf one short comparison with the leafy shoot before starting new generator work. Use disclosed pre-seated scenes when insertion is not the question.

## What the present twelve already cover

| Visual/craft role | Existing stock | Remaining distinction |
| --- | --- | --- |
| Fine line and branching wood | Reed, bare branch, flowering branch | A shorter reed is already an ordinary cut; another twig needs more than a different length. |
| Green spray and repeated foliage | Leafy shoot, foliage fan, arching trailer | All carry separate small blades. They cannot become one broad, continuous leaf. |
| Divided foliage surface | Fern frond v2 | The pinnae create a finely divided silhouette; they do not form a single palmate leaf. |
| Flower face, mass, scatter, and downward head | Single flower, flower volume, blossom spray v2, nodding flower v2 | A new flower needs a new compositional decision beyond tint or petal count. |
| Small fruit accents | Berry twig | Pruning already creates sparse clusters and isolated accents. |

This comparison comes from the catalog, versioned generators, and material-reference contract. It does not assert that every current material is equally easy to use on a phone.

## Card 1 — Sparse lobed-leaf branch

**Role.** A few broad, angular leaf faces around an open woody line. Their lobes leave recognizable notches of empty space; removing one leaf reveals a substantially different window. It offers a seasonal direction without relying on autumn color to make the silhouette worthwhile. First compare it in green.

**Botanical reference.** Japanese maple has opposite, simple leaves with five to nine lobes; leaf color varies by cultivar and season. NC State Extension documents that morphology [1]. The prototype should be called a *lobed-leaf branch* or *maple-inspired branch*, not a species-accurate simulation. “Simple” means a lobed blade is one leaf, not separately articulated leaflets.

**Smallest useful stock.** One modest woody line, one subordinate fork, and three or four clearly separated leaves. Use opposite attachment nodes if drawing specifically on maple morphology; an authored cutting can have absent counterparts, but should not claim that an alternating arrangement is botanically exact. Keep a clear basal grip and a useful woody line after foliage is removed. Avoid a full miniature tree or densely tiled maple leaves.

**Edit law.** Ordinary Aim and Bend operate on the stem and branch; leaf faces follow their actual petioles. A leaf surface can use the existing organ-surface Aim grip to aim its supporting stalk. No individual lobe handles, blade bending, or new axial-roll control is promised. The new leaf form must read from Front, three-quarter, and Above without turning into a camera-facing billboard.

**Pruning.** A petiole cut removes one whole leaf. A fork cut removes its attached leaves. Cutting an individual lobe is outside the prototype. Preserve inactive history and unchanged siblings exactly as for existing leaf organs.

**Why existing stock cannot do it.** Pruning selects existing material; it cannot join elliptic leaves into a single connected palmate blade or turn fern pinnae into lobes. The broad face and its notched outline are the reason to test this candidate, not a red material swatch.

**Technical risk: moderate.** It can use the present graph and `leaf` organ kind, but needs an additive, deterministic lobed surface in `botanicalGeometry.ts`, matching veins and tight acquisition geometry. Empty notches must remain empty for picking. A broad spherical proxy that grabs the gaps would undermine the point of the new outline. Check existing no-roll Aim limits before investing in leaf detail. Do not change any saved generator in place.

**Decision test.** In the same two compositions, offer this beside leafy shoot, foliage fan, and fern, with matched camera and stem count. Ask the player to keep or remove one leaf to reveal space, then view from three-quarter. Keep only if the connected leaf face changes the actual arrangement and remains controllable. Redo in an autumn palette only after that monochrome/green distinction holds.

## Card 2 — Single broad blade

**Role.** One continuous surface that can face the viewer, turn nearly edge-on, or form a broad curve over the water. This adds a plane, rather than another distribution of small leaves. It has more potential to expand craft than another floral head, but is not a quick catalog addition.

**Botanical reference.** Aspidistra is a useful reference for a lance-shaped, leathery cut leaf [2]. Mississippi State's floral-design guidance describes manipulation of the blade itself, including curling and supported bends [3]. Ikenobo also explicitly uses aspidistra in foundational practice [4]. These sources support the reference choice; they do not validate a particular simulated stiffness or imply that any arbitrary bend is natural.

**Smallest useful stock.** One cut leaf with a clear petiole, central midrib, tapered blade, modest transverse cupping, and a stable front/back. Start unvariegated so surface behavior, not striping, earns the addition.

**Edit law.** The blade must actually deform with its supporting centerline while preserving stock length. In today's graph, an organ has a single attachment distance, spin, and scale; the rendered leaf follows that frame as a rigid local surface. Simply enlarging that organ would make a paddle on a bendable stick. A proper prototype needs a written mapping from persistent centerline state to the blade surface and its visible hit surface, including how the material frame behaves under bending. Axial twist and the ability to expose the leaf face need explicit limits; they must not emerge accidentally from camera motion.

**Pruning.** The contract must decide whether a cut along the blade shortens its continuous surface or merely removes the whole leaf from its stalk. For the worthwhile version, a transverse cut should leave the proximal blade with the exact former width and outline at the cut—never shrink the whole remaining leaf into a new miniature leaf. Side notching, tearing, folding, wiring, and arbitrary contour cuts are separate features, not implied by this card.

**Why existing stock cannot do it.** Neither a cluster of leafy shoots nor the fern creates one uninterrupted shapeable surface. An arching trailer supplies a line; the broad blade supplies a plane whose direction and extent matter.

**Technical risk: high.** The current prune law deactivates a distal leaf organ; it does not clip a continuous lamina. A centerline-bound surface could be derived from persistent branch points, but organ identity, hit routing, bend eligibility, and prune preview/commit equivalence need an explicit design before implementation. Current overlap prevention also treats structural stem envelopes, not leaf-area collisions. Do not advertise blade collision prevention or silently modify shared interaction to make a prototype work.

**Decision test.** First prove one leaf can be shaped, viewed edge-on, shortened, cancelled, and reloaded without changing width, rest length, texture, or identity. Then ask whether one blade plus one line offers a satisfying arrangement that a leafy shoot cannot. If the result is still a rigid leaf on a bendable petiole, park it rather than ship it as the promised craft material.

## Where the paired leaf fits

The reviewed D1r1 source has a 3.2–3.45-unit stem with four opposite leaf pairs at shared attachment distances. The existing leafy shoot has seven almost-alternating leaves at separate stations. Those shared nodes are a real structural difference; pruning the leafy shoot cannot create them. D1 is therefore more defensible than a shortened reed, but paired rhythm alone has not yet shown enough compositional benefit to earn a production slot.

Use the paired leaf as the first **low-cost comparison**, not as the default winner. Preserve its fixed geometry while comparing it to a leafy shoot in the same role. If a player wants it specifically for two-sided balance, repeated gaps, or selective removal of one half of a pair, that is useful support. If it merely substitutes for “some greenery,” park it. Its experimental flag-off Garden behavior is a separate unresolved integration concern in the supplied campaign record, and this review did not rerun or clear that issue.

## Sources and evidence limits

Primary botanical/teaching references read on 2026-10-13:

1. [NC State Extension: Acer palmatum](https://plants.ces.ncsu.edu/plants/acer-palmatum/) — opposite simple leaves, lobes, and cultivar-dependent seasonal color.
2. [RHS: Aspidistra elatior](https://www.rhs.org.uk/plants/1715/aspidistra-elatior/details) — upright leathery elliptic/lance-shaped leaves.
3. [Mississippi State Extension: Aspidistra for the Farmer Florist](https://extension.msstate.edu/publications/aspidistra-aspidistra-elatior-for-the-farmer-florist) — cut foliage and blade manipulation examples; no adoption of its wiring, tearing, or notching techniques is implied.
4. [Ikenobo: Arranging aspidistra](https://lesson.ikenobo.jp/いけばなの基本/葉蘭をいける/) — aspidistra's role in that school's practice; not a claim of universal school rules.

Code inspected: `materialCatalog.ts`, `leafyShoot.ts`, `foliageFan.ts`, `fernFrondV2.ts`, `materialResponse.ts`, `types.ts`, `prune.ts`, `botanicalGeometry.ts`, and D1r1's `pairedLeafD1.ts` / study registration. Project instructions, architecture, behavioral contract, material references, and earlier material briefs informed the technical boundaries.

No new browser play, physical phone test, performance measurement, or comparative player evidence was produced. These are commissioning recommendations, not acceptance findings.
