# Optional composition examples — round 2

These are two original, optional arrangements made from the four-material player
build after PR #19, on merged main `5b6536704f89e105181158891e4ad27537bf1a22`.

- **Bare-branch lines:** bare branches lead a sparse, asymmetrical composition,
  using their crossing lines and the surrounding open space as the main study.
- **Single-flower rhythm:** a single flower leads the arrangement with a
  player-Aim-adjusted face toward canonical Front, while two leafy cuttings
  establish a measured leaf rhythm around it. The face remains unresolved from
  the canonical Three-quarter view: existing Aim changes the pedicel direction
  but could not show the open center clearly in both views.

## Opening and importing

To use these backups from this merged main / PR #19 integration head, build the
standalone player locally:

```bash
npm ci
npm run build
```

Open `dist/ikebana-web-alpha-standalone.html` in a browser, choose **Garden**,
then **Import backup** and select the desired JSON file. Open the imported Garden
card to view it; **Make a working copy** is optional if you want to edit it.
The same Garden import steps apply to the standalone build from PR #19 once its
combined head is available on the integration branch.

The backups are player-compatible Garden exports, one kept arrangement per file;
they are not auto-imported into the app. Screenshots are view evidence only:
`artifacts/<arrangement>-front.png` and
`artifacts/<arrangement>-three-quarter.png`.

The single-flower backup was imported into a fresh Garden and rendered. One
ordinary Shape/Aim drag on the upper flowering material changed the persisted
pedicel geometry and turned the open face toward Front. Two further Aim attempts
from Three-quarter made the flower visible but edge-on, so the two-view facing
goal is explicitly unresolved rather than claimed as complete. The
`single-flower-led-aim-attempt-*.png` files show that limitation. No physical
phone testing was run.
