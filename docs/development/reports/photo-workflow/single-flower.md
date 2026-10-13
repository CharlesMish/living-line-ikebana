# Single flower: authored open cup

Recommendation: retain Single flower for an owner comparison. Its useful role
is a taller, single open flower with a visible throat. Compact flower remains a
shorter dense accent. This change makes that distinction more explicit rather
than adding another material or rewriting the saved stem.

## What changed

- Five broad petals have individual identity-seeded curvature, a cupped body and
  a restrained recurved rim. Each petal is a closed thin surface with its own
  front and reverse normals/coloration; the back is not a blank planar card.
- A rounded green receptacle covers the actual organ attachment. Five quiet
  sepals sit behind the petals. Fine filaments connect the anthers to the throat.
- The five petals are merged into one owned corolla mesh. The complete head uses
  five visible draw calls and 3,236 submitted triangles, compared with eight
  visible calls and 1,840 triangles in the previous dish: minus three calls,
  plus 1,396 triangles per Single flower. No phone frame-time claim is made.
- Natural pale apricot, Warm rose and Soft lilac retain their existing colors.
  This is a generic authored flower, not a claim of a particular species.

## Compatibility and ownership

`single-flower-v1`, all graph data, its fixture, organ frame/scale and the 0.7 hit
envelope are unchanged. The visible front and reverse still acquire the same
pedicel through the existing direct-head tilt path. Petals are not independent
editing targets. Pruning, cancel, Undo and unrelated stems retain their laws.

Flowering branch's beloved seven-petal cup and Compact flower's tuft have no
geometry or appearance changes. The old open-face geometry remains available
as a presentation reference. Geometry and material resources belong to the
organ group; tone changes reuse them and ordinary disposal frees them.

## Evidence and remaining judgment

`single-flower-cpu.png` is an **offline CPU mesh illustration**, generated from
the production organ groups with flat painter shading. It compares Natural,
Warm rose, Soft lilac and Compact from front, three-quarter and rear, at the
same unscaled local-organ framing. It does not apply persisted organ scale,
WebGL lighting, photograph finish, shadows, or phone rendering. The small
facets visible in this illustration are not a screenshot of the smooth-normal
production shading. It shows shape and color relationships, not final polish.

The illustration exposed sepals crossing the front surface in the first draw;
their placement was corrected to remain behind the petals before final capture.

Focused tests check closed/nondegenerate surfaces, deterministic rebuilds, finite
normals/colors, useful depth, bounds, front/rear real-surface acquisition,
unchanged tone and geometry identities, prune/rollback, canonical fixtures and
the existing direct-head tilt, cancellation and Undo behavior. Full integration
verification is reported by the parent candidate. This isolated lane passes
`npm run verify`: **536 tests, 0 failed/skipped**, clean typecheck, production
build, and self-contained distribution validation. Dependencies were installed
by the parent with `npm ci` and shared read-only with this worktree.

Phone/GPU appearance and owner preference are unrun. If the open cup still
doesn't earn a place beside Compact, move Single flower under More cuttings;
don't remove its generator or migrate existing bowls.

Reproduce the offline illustration:

```bash
node_modules/.bin/esbuild tools/single-flower-craft-sheet.ts --bundle --platform=node --format=esm --outfile=/tmp/single-flower-craft-sheet.mjs
node /tmp/single-flower-craft-sheet.mjs /tmp/single-flower-craft-sheet.json
python tools/botanical-contact-sheet.py /tmp/single-flower-craft-sheet.json docs/development/reports/photo-workflow/single-flower-cpu.png
```
