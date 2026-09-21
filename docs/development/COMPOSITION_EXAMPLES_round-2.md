# Optional composition examples — round 2

These are two original, optional arrangements made from the four-material player
build at `6c6abd61919754976d64f1a11d590c059056717e`.

- **Bare-branch lines:** bare branches lead a sparse, asymmetrical composition,
  using their crossing lines and the surrounding open space as the main study.
- **Single-flower rhythm:** a single flower leads the arrangement with its face
  turned toward the viewer, while two leafy cuttings establish a measured leaf
  rhythm around it.

## Opening and importing

To use these backups from this exact SHA, build the standalone player locally:

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

Verification was performed in the browser from the exact SHA: each backup was
imported into a fresh Garden and its card was opened and rendered. No physical
phone testing was run.
