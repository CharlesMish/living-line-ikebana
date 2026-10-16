# Botanical rendering efficiency

Baseline: main `578591453db2f6b31dd82f4347419c8f1cff7efe`.
Behavioral contract preserved: no plant, seed, edit law, picking envelope,
lighting, shadow, camera, or stored-data changes.

## Changes

- Hidden acquisition meshes now have `material.visible = false`. Their object
  visibility still reflects active/pending state, and Three.js raycasting still
  uses their unchanged geometry. Debug proxies remain drawn.
- The batch `setGraphs` path skips unchanged read-only graph references. The
  coordinator's presentation API retains unrelated references and replaces the
  edited preview; snapshot/restore APIs still clone. Explicit `upsertGraph`
  remains a forced resync for mutable callers.
- Selection changes only the old/new branch tint and shared handles, without
  recomputing every plant's geometry, organ transforms, and water contacts.
- Stem-fiber attributes reuse their existing buffer at stable topology.
  Tube/selection-line topology changes dispose the previous GPU bindings before
  replacing attribute arrays. Stable index buffers are not reuploaded on Aim.

## Automated evidence

`npm ci` and `npm run verify`: **665 passed, 0 failed, 0 skipped**, typecheck,
build and distribution validation pass. Six added CPU regressions all fail
against the old baseline. They cover buffer identity and disposal ordering,
coordinator presentation references across Aim/cancel/commit/Undo, cloned
replacement, selection/tone/prune recovery, and ray-pickable hidden proxies.
The existing lobed-reverse disposal test now separates reusable stem topology
release from final teardown; fixed leaf resources and materials remain owned
until exactly one final teardown.

A five-cutting, twenty-Aim-update probe performs **20 botanical syncs**, one for
the edited plant per frame. The old two full passes would perform **200**.
Selection-only changes perform zero botanical syncs. This is operation counting,
not a frame-time benchmark.

The rendered harness uses actual production `ThreeStudio` and explicit fixtures
with core edit calls; it is assisted adapter testing, not ordinary player input.
Local headless Chromium 153.0.8010.0 / SwiftShader at 1100×850, DPR1:

| Same fixture | Old zero-opacity proxy draws | Hidden proxy materials |
| --- | ---: | ---: |
| Draw calls | 312 | 146 |
| Submitted triangles | 55,214 | 32,142 |
| Different RGBA channels | — | 0 |

The scene contains flowering branch, berry twig, fern frond, lobed leaf and broad
blade. Both a same-renderer visibility comparison and an independently bundled
old-source comparison pass. Old/new fixture framebuffer SHA256:
`87958f6bb6f148eba237d86d42c6a69e07d35ebbb9b8f35aaf64524a582f3f23`.
All acquisition candidates and winners match for a branch, flower proxy,
exact lobed leaf and broad-blade surface. Debug proxy rendering remains visible.

Twelve Aim updates, twelve Bend updates, cancellation, prune-hover cancellation,
committed pruning, restoration of the original Undo snapshot, and botanical tones
all render identically to a newly constructed adapter. The regular rendered CI
continues covering ordinary app input, Undo, Photograph, and Garden, and now runs
this focused harness and preserves its JSON/PNG output as an Actions artifact.
No new screenshots or binary evidence are committed to the repository.

## Limits

No physical iPhone, Safari, phone frame-time, or GPU-memory benchmark. Reduced
submitted work is measured; a percentage FPS improvement is not claimed. Import
hardening is a separate PR. This pass does not change clipping/placement UX or
expand collision scope.
