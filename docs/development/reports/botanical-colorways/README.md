# Botanical tones — restrained material color choices

This lane adds **Studio → Botanical tones**. Each control applies to every cutting
of that named material in the current bowl, including later insertions. It does
not recolor all flowers together. Natural preserves each material's accepted
appearance. No random color, species reroll, unlock or currency is introduced.

| Material | Alternatives to Natural |
| --- | --- |
| Flowering branch | Porcelain blossom; Deep rose (with corresponding wood shades) |
| Single flower | Warm rose; Soft lilac |
| Compact flower | Warm ivory; Muted plum |
| Flower volume | Dusty peach; Deep plum |
| Blossom spray | Butter cream; Pale mauve |
| Nodding flower | Blue violet; Pearl lilac |
| Berry twig | Rust berries; Dark wine (with corresponding wood shades) |
| Bare branch | Warm walnut; Weathered silver |
| Leafy shoot | Olive; Deep green |
| Foliage fan | Warm olive; Forest |
| Fern frond | Deep emerald; Young lime |
| Lobed-leaf branch | Autumn ochre; Autumn russet |
| Broad blade | Deep green; Soft olive |

Bare branch, leafy shoot and original flower volume controls are under **More
cuttings**. Reed and arching trailer retain their original greens. New compact,
lobed and broad families are registered here in coordination with their additive
material lanes; this lane does not introduce their generators.

## Contract and storage

The botanical schema and graph identity are unchanged. Scene presentation gains an
optional, validated `botanicalTones` map keyed by fixed material families. Missing
entries mean Natural. Unknown families and presets are rejected, not substituted.
Natural-only maps normalize away.

A nonnatural color edit deliberately writes **sceneVersion 2** inside the existing
working/Garden presentation envelope. Pre-feature readers reject that version
instead of silently dropping the new field. Unedited legacy scenes remain
sceneVersion 1 with no added field and no startup writes. Resetting a v2 scene to
Natural removes the tone map but retains its version. Explicit scene edits keep
other presentation fields; integration also preserves the photo-adjustment field.

The app cancels active craft/readiness before opening the dialog or changing a
setting. Its existing scene command saves first, applies only on success, and
restores controls on failure. Inspection of a kept Garden arrangement disables the
working-bowl tone command. Working reload, Garden backup/import/working copy,
Garden inspection, matched comparison and Photograph use the saved scene tones.

## Renderer behavior

A tone change updates owned mesh material colors in place. Branches, prune fades,
leaves, veins, fruit, buds and petals keep their geometry, material identities,
transforms, hit proxies, opacity and graph data. New and pending cuttings derive
the same selected tones. Studios own their materials independently; one Garden
comparison pane cannot recolor the other.

Nodding v2's collar and petal tints are baked into its color attribute. Its updater
starts from the original array, preserves the green sleeve and seeded shading,
and changes only the petal contribution. Natural restores the exact original
buffer. It never rebuilds the graph, the shell, or hit geometry.

Broad-blade integration adds the same leaf tint to its visible branch-owned blade
and prune fade; there is no separate leaf organ in that material.

## Evidence and limits

- `npm run verify`: **495 tests passed, zero failures or skips**, clean typecheck,
  production build and self-contained distribution validation on this lane.
- Seven new focused tests cover every preset's scene roundtrip, old-scene reads
  without writes, strict invalid/future-data preservation, renderer resource and
  graph identity, isolated studios, new/pending inheritance, prune opacity, and
  nodding collar/natural restoration.
- Renderer tests use real production Three.js geometry/materials without GPU
  drawing. They do not establish final lit color appearance.
- No browser or physical phone session ran: the supported browser control skill
  is unavailable in this managed environment.
- Final combined verification must include the new three materials and the
  photo-adjustment envelope. Photograph's factory must receive `botanicalTones`;
  the photo lane owns that factory edit.

Owner checks: compare Natural and one alternative on a mixed bowl; check the
nodding neck remains green; Keep, reload and Compare with the Natural arrangement;
prepare a PNG and compare its flower/leaf colors. Confirm the longer tone dialog
scrolls comfortably on the phone and its Done and All natural actions are reachable.
