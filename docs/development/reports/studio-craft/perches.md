# Perch craft pass

This pass changes presentation only. Existing `ground`, `stone` and `bench` IDs
remain valid; `plinth` is an additive scene choice. The vessel's contact height,
all botanical coordinates, camera poses, planting geometry and editing laws stay
unchanged. Previously kept scenes using a stone or bench receive the refined
draw when reopened; saved thumbnail pixels are not rewritten.

## Changes

- **Low stone:** a flat honed top, softly eased rim and subtly irregular outline;
  quiet mineral colour and micro-relief instead of a uniformly coloured cylinder.
- **Small bench:** three eased oak boards, four squared legs and four aprons
  meeting their inside faces. Grain follows each member's length, including
  vertical grain on legs and growth-ring detail on the boards' cut ends. The
  tiny board seams and apron reveal are actual geometry, not painted shadows.
- **Plaster plinth:** one new low rectangular support, warm pale plaster with
  softened edges and a recessed foot. This offers a solid, quiet alternative to
  the open timber bench without introducing another vessel layout.

Wood, end grain, stone and plaster use deterministic CPU-authored colour and bump
maps. No external textures, renderer readback, random state, saved texture data,
or network loading is involved. The colour-only swatches in
`perch-color-swatches.png` were inspected directly; they are not a GPU-rendered
scene or evidence of phone appearance.

## Cost and ownership

Measured from the actual default-support geometries and owned texture buffers:

| Perch | Triangles | Mesh draw calls | Maps | Base texture bytes |
| --- | ---: | ---: | ---: | ---: |
| Low stone | 1,008 | 1 | 2 | 81,920 |
| Small bench | 1,764 | 14 | 4 | 245,760 |
| Plaster plinth | 600 | 2 | 2 | 81,920 |

These are object counts, not a frame-time measurement. Shadow passes add work.
Mipmaps add roughly one third to texture storage. The previous bench was five
plain boxes (60 triangles / 5 draws); its detailed replacement costs nine more
draws. Ground allocates no perch resources. Transparent cutouts allocate none
and omit the floor and backdrop as before.

Each perch group owns its textures and materials. Replacing the stage and
disposing the studio both use a perch-specific disposer that deduplicates maps,
materials and geometry; shared bench materials are released once. The generic
scene disposer and vessel texture ownership were not changed.

## Validation

- `npm run verify`: 473 tests pass, typecheck clean, build and self-contained
  distribution validation pass on this lane (four new focused tests).
- Production geometries meet the unchanged top contact height for every frozen
  vessel profile. Their bottom bounds also meet the returned floor height.
- Added checks cover deterministic map bytes with independent ownership,
  exactly-once resource disposal through production stage replacement and final
  studio close, transparent omission, real UV alignment along the timber members,
  finite UVs, and the bench's bounded geometry/draw count.
- Dependencies use the root checkout's `npm ci` installation through the shared
  worktree dependency link.

Fresh browser/WebGL rendering and physical-phone play were not available for
this pass. Owner review should compare the bench at Front and Three-quarter,
check grain remains quiet beside fine stems, inspect stone/plinth contact
shadows, and switch all perches and Transparent several times. Surface texture
strength and the plinth's perceived weight remain visual judgments.
