# Violet cuttings and a lighter nodding bell

Base: main `68433f4`. This draft is an additive material/appearance pass. It
preserves saved graphs, shaping, stock length, collision scope, insertion identity
and all historical workbench profiles. It intentionally moves Single flower into
**More cuttings** without removing its generator, tones, source card or old saves.

## Why these two

The owner wanted violet, lavender and indigo accents and explained why the tall,
terminal Single flower was difficult to shorten while retaining a flower. These
two stocks put flowers at several levels. Neither pretends that an ordinary
prune can shorten a stalk from its base or reattach its head.

- **Violet sprig** (`violet-sprig-v1`): a 2.35–2.51-unit wiry main line with three
  short arms and six small, five-petal saucers. Each flower has its own pedicel.
  It sits lower and spreads less than Blossom spray, whose longer arms carry
  tufted heads. Cutting the main line between stations keeps lower flowers;
  cutting one arm keeps the other two. Natural violet, Pale lavender and Amethyst.
- **Indigo spire** (`indigo-spire-v1`): a 3.40–3.57-unit upright axis with four
  flowering stations, three small tubular, two-lipped corollas at each station,
  and two restrained lower leaves. Shortening between tiers retains lower tiers;
  each floret is independently aimable/prunable. Natural indigo, Blue dusk and
  Silver lilac. This provides a flowering vertical line rather than another
  broad, many-armed spray.

Both use existing branch/leaf/bloom records, deterministic seeded generation and
copied response values. The two new seed-8278 fixtures freeze initial identity.
Existing materials and versions are never regenerated or recolored on load.

## Botanical grounding, and its limits

These are authored, generic cuttings, not exact botanical models or teaching
claims about an ikebana school. Shape and scale serve the existing bowl and
pruning language. They are not labelled sakura or true violets.

- Royal Horticultural Society, [Geranium guide](https://www.rhs.org.uk/plants/geranium):
  wiry stems, saucer flowers including violet/blue, and dissected leaves informed
  Violet sprig. The small lobed leaves reuse the established lamina surface at a
  smaller persistent organ scale; this is not a species-identification claim.
- University of Wisconsin–Madison Extension, [Mealycup sage, Salvia farinacea](https://hort.extension.wisc.edu/articles/mealycup-sage-salvia-farinacea/):
  upright flowering spikes, flowers in whorls, and five-lobed/two-lipped corollas
  informed Indigo spire. The four separated, editable tiers are a deliberate
  simplification rather than a literal cultivar reconstruction.

Sources read 2026-10-14. No third-party images or geometry are included.

## Nodding flower

The v2 presentation uses one narrower, thin-rimmed, five-lobed joined bell instead
of a thick-looking rotational shell. Its existing color recipes, green collar,
organ frame, hit envelope and graph stay intact. The old v1 draw remains exactly
unchanged. One bell adds 152 triangles (2,040 instead of 1,888), retains one mesh
and one material, and is not a bundle of new pickable petals. Changing its colors
still restores the exact Natural vertex-color buffer.

## Evidence

- `npm ci` and `npm run verify` completed: **602 passed, 0 failed, 0 skipped**;
  typecheck, Vite build and self-contained distribution validation passed.
  Focused core/mesh tests cover three seeds; schema and
  serialization; old Single flower fixture and frozen profiles; shortening while
  keeping lower blooms; isolated floret Aim/cut; rest lengths under bending;
  actual new graphs and tone recipes through working save/Garden backup/copy;
  finite noncollapsed closed corollas, outward winding and hit-envelope coverage;
  prune preview/cancel/restore, tone updates and unchanged buffer/graph identity.
- The geometry reviewer caught inward-wound Violet petal sheets before commit.
  All Violet triangle windings were corrected; front/back normals and positive
  enclosed-volume assertions now guard it. Indigo winding was already outward.
- The existing botanical proxy suite passes all new surfaces at all three seeds.
- `tests/browser/violet-cuttings.mjs` adds an explicitly assisted rendered CI pass:
  ordinary keyboard seating, Front/three-quarter, close Photograph in Natural and
  an alternate tone, and a 180-degree turn exposing the reverse. A read-only
  projected root station guides one ordinary held Prune/Escape cancellation.
  Garden backup download and reload compare actual canonical plants and tones.
  It neither injects a graph nor claims blind placement evidence.
- **No local rendered browser, physical phone, Safari or phone frame-time test**
  was run in the implementation container. CI screenshots require inspection;
  appearance and touch feel remain owner acceptance questions.

## Small acceptance pass

Try the low sprig beside a flowering branch, then cut above its second flowering
arm: lower flowers should remain. Try the spire as a vertical answer to broad
foliage, cut between tiers, and remove one visible floret. Undo/cancel should
restore the same plant. Check the back of all three new/refined corollas in
Photograph, choose two violet tones, Keep, reload and reopen. Single flower is
still available in More cuttings for old compositions.
