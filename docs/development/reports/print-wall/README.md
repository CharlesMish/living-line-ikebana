# Garden print wall

Base: main `68433f4`. This is a focused draft; no production deployment or merge.

Garden → Print wall displays the actual cover pixels already kept with each
moment. Oak frames and Paper prints are transient display choices. Open a print
to look at it, then open its original read-only arrangement in 3D. Escape returns
from one print to the wall before leaving the wall. Ordinary Garden copy,
comparison, removal and backup paths remain available in Garden.

The wall is a projection of the existing collection, not a second store. Viewing,
changing display style and opening originals write no working or Garden data.
Moments without covers remain in the ordinary collection. Existing covers are
never regenerated: changes in lighting or botanical rendering cannot rewrite
their pixels. No arbitrary photo upload, wall layout persistence, cloud storage,
or separate full-resolution photo archive is added.

New Photograph covers keep their actual portrait/square/landscape proportions,
at up to 640 pixels on their longest edge. The existing 80,000-character JPEG
bound is retained; bounded quality retries either fit or report failure before
Keep. Transparent exports receive the established paper matte in the JPEG.
Full-resolution PNG downloads remain separate and unchanged. Old 360×270
covers retain their existing resolution/padding. No Garden schema migration.

## Validation

- `npm ci`, `npm run verify`: 595 passed, no failures/skips; typecheck/build/dist pass.
- Production UI tests cover focus, Escape, styles, empty state, saved-image
  selection and read-only transition with byte-identical collection storage.
- Cover tests exercise native aspect ratios, resolution bounds and failed encoding.
- `tests/browser/print-wall.mjs` is wired into the existing remote rendered job:
  real UI Keep at portrait/square, wall styles and detail, focus, no horizontal
  overflow, open/return and byte-identical storage. Results belong to the exact
  PR CI head, not this local CPU report.
- No physical-phone/Safari or frame-time evidence in this change.

Owner check: keep one portrait photograph, open Garden → Print wall, try both
finishes, open a moment and return to your bowl. Verify that the frame is uncropped
and that scrolling the wall on your phone leaves Back to Garden reachable.
