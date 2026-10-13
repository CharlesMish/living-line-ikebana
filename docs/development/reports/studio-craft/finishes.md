# Studio craft: vessel finishes and backdrops

This lane starts at PR #87 and preserves the botanical, gesture, camera, layout,
and storage-envelope contracts. It adds presentation IDs; it does not add a
material generator, layout, planting tolerance or collision change.

## Choices

| Addition | Intended role |
| --- | --- |
| Chalk vessel (`chalk`) | A lighter, nearly neutral ceramic that can separate from Dusk or Ink without the warm beige body of Sand. |
| Iron vessel (`iron`) | A muted fired-clay brown for warm arrangements and a contrasting base under cool green/blue material. |
| Satin (`satin`) | A softly reflective surface with fine, broad microrelief and slight roughness variation. Its body color is unpatterned. |
| Speckled (`speckled`) | Sparse dark mineral flecks, fine relief and restrained surface variation. The neutral fleck map works with each existing or new ceramic color. |
| Mist wall (`mist`) | A lighter blue-grey ground; intended to give warm blossoms and berries a cool surround without the darkness of Dusk. |
| Clay wall (`clay`) | A muted warm rose-grey alternative to cream paper, intended to complement green foliage. |
| Ink wall (`ink`) | A deeper blue-grey setting intended for pale flowers and a light vessel. Dark thin stems may need a lighter backdrop. |

These are palette and material-design intentions, not measured rendered-contrast
or physical-phone acceptance claims. No light/exposure, water, botanical hue or
camera setting was changed by this lane. Warm paper, Sage and Dusk retain their
exact colors. Sand, Celadon, Charcoal, Glaze and Stoneware retain their existing
properties and maps, including after switching back from a new finish.

## Materials and cost

The new surfaces use deterministic, periodic 128×128 RGBA data textures. Satin
owns a height map and roughness map; Speckled owns those plus an sRGB albedo map.
Height/roughness maps use data color space. Maps are created lazily, cached within
one ThreeStudio, and explicitly released once when that studio is disposed. Main,
Garden comparison and Photograph renderers never share GPU resources.

Both new finishes together retain 320 KiB of base texture pixels per renderer
after both have been used, approximately 427 KiB with mipmaps. The existing
Stoneware map adds its prior cost if used. No vertices or draw calls are added by
the finishes. Texture sampling and shader cost increase; GPU/phone frame time was
not measured. No external texture downloads, canvas textures or image assets are
needed. The albedo flecks are surface detail, not added ceramic geometry.

## Persistence and validation

`sceneVersion: 1` remains appropriate because the fields and their meaning have
not changed. Validation accepts the registered additive IDs and still rejects
unknown ones. Updated clients preserve old scenes; an older client will refuse a
new ID, not silently replace it. Existing v1 fallbacks and v2 storage isolation
remain unchanged. Vessel selectors already consume the color/finish registries;
Photograph can consume the exported `PHOTO_BACKDROPS` registry.

Focused tests cover every registered color, finish and backdrop through working
save/reload plus Garden Keep/export/import, with exact botanical/camera retention;
old scene fixtures still pass. Geometry, camera projection and vessel-support
extents remain unchanged across all 20 vessel appearance combinations. Resource
tests cover deterministic maps, independent studio ownership, cache reuse and
production disposal. Switching back to old Glaze or Stoneware clears all new
maps and restores their exact settings.

## Evidence and limits

- Focused run: 16 tests passed; typecheck passed.
- Full `npm run verify`: 473 tests passed, 0 failed or skipped; typecheck, build and
  self-contained distribution validation passed.
- Fresh browser rendering and physical-phone play were not performed in this
  lane. The available Sites workflow did not expose its required browser-control
  skill, so no substitute browser server or tool was used.

Owner check: compare an existing arrangement under Paper, Mist and Clay; try pale
flowers on Ink with Chalk, then inspect whether the darker stems remain legible.
At a closer photo crop, compare Glaze/Satin/Speckled and confirm flecks feel like
ceramic rather than dirt. Check Garden reload and export using a new finish.
