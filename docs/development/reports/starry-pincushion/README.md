# Starry pincushion study

Base: combined photos/violets candidate `00f285f` (PR #97). Additive material;
no generator, editing-law, storage-schema or frozen-profile rewrite.

## Design

`starry-pincushion-v1` is an authored Astrantia-inspired cutting, not a literal
species/cultivar model or an ikebana-school exercise. The compact three-headed
silhouette complements the Violet sprig's open saucers and Indigo spire's
vertical tiers. The stem is 2.65–2.83 world units long, with light flowering
arms at 38%, 65% and 95% of its stock length. Each arm ends in its own short
flower stalk, so an upper-stem cut retains the lower two heads. Two small
lobed leaves give a restrained basal accent.

A head is one ordinary bloom organ: its ten pointed, closed bracts and 21 tiny
lobed florets form one merged surface. The bracts occupy separated angular
sectors; front ridge/vein shading and darker reverse surfaces keep the thin
profile readable from either side. A shallow receptacle and small green rear
calyx connect the head to its stalk. This is visual detail, not independent
floret/petal editing.

Natural ivory-green, Muted plum (`plum`) and Pale green (`green`) are scene tone
choices, resolved by the existing renderer and swatch path. The green choice
keeps a cooler, foliage-adjacent head against warm photographic settings; it
does not change the geometry.

RHS references checked 2026-10-14:

- [Astrantia major 'Stardust'](https://www.rhs.org.uk/plants/325819/astrantia-major-stardust/details): compact clusters of tiny flowers, surrounding bracts, wiry branched stems and lobed foliage.
- [Astrantia major 'Star of Love'](https://www.rhs.org.uk/plants/367361/astrantia-major-star-of-love/details): a darker flower/bract family supporting the muted plum study.

Only descriptive habit was used. No images, textures or meshes were imported.

## Compatibility and acquisition

The catalog appends the new durable generator and tray ID. Existing generator
source, canonical fixtures and frozen workbench lists are unchanged. Normal
insertion, direct head Aim, branch Bend, exact distal Prune, Undo and removal
all use their existing paths. Each head's complete draw is contained by its
0.36-unit acquisition sphere (tested against the actual faceted proxy). Lobed
leaves retain exact surface picking. There are no invisible extra controls.

Working saves, Garden keeps, backup imports and working copies support this
stock and its tones through ordinary registry validation. Older versions of
the app that do not know this generator refuse such saves rather than silently
dropping material.

## CPU evidence

`npm ci` and `npm run verify` passed: typecheck, 617 tests (zero failures/skips),
production build and self-contained distribution validation.

New focused tests cover three seeds (`8278`, `9255`, `10232`), deterministic
construction, a canonical fixture, serialization and graph validation, lower
head retention, sibling-preserving head cuts, attachment coincidence,
rest-length-preserving Aim/Bend, immutable inputs, insertion/Aim/Bend/Prune
cancellation with no saves, and working/Garden backup round trips.

Geometry tests cover finite vertices/normals, nonzero triangle area, closed
indexed surfaces, outward front/back bract normals, positive signed volume,
separated bract sectors, bounded cost and stable buffers across tone changes
and prune/restore. The shared three-seed acquisition-proxy test now includes
this head.

Head surface cost: 3,320 triangles / 1,724 vertices, one mesh; its calyx adds
80 triangles / one mesh. Three heads total 10,200 bloom triangles / six
meshes, excluding stems and leaves. This is a geometry count, not measured
phone GPU time.

No local browser, Safari, GPU frame-time or physical-phone run was performed
in this implementation worktree. Root integration owns remote rendered CI
and screenshot review. Visual acceptance should inspect Front, three-quarter,
Above and rear close photographs, particularly the pale head against warm
paper and the readable negative spaces between pointed bracts.
