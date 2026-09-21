# Round 2 workbench profile identity samples

These files are **repeat recipes**, not browser renderer captures and not Garden
backups. Reconstruct the scene from `loadedFixture.profileId`, `seed`, `count`,
and the construction list. Default camera is canonical Front.

Matched conditions used throughout:

- seed `8278`
- counts named in each filename
- camera: Front (`position.z === 15`)
- CSS viewport / drawing-buffer / pixel ratio: **not captured here** (Node)

`reference-pair` and single-material samples include plant identity summaries.
Candidate-profile JSON files from the workbench branch are marked
`unavailable-on-this-checkout` because that checkout did not register
`bare-branch` or `single-flower`. Round 2 integration registers both, so the
picker enables those profiles. Reconstruct with
`createWorkbenchFixture(profileId, 8278, count)` rather than treating the
unavailable JSON as the live bowl.

## Single-flower ×12

`single-flower-count12-correction.json` records that Candidate B's
`workbench-single-flower-count12-renderer.json` is **not** a count-12 renderer
capture. Do not quote mixed-6 `calls: 371` / `triangles: 54714` as a 12-cutting
single-flower figure. After `single-flower` is registered, load
`createWorkbenchFixture("single-flower", 8278, 12)` and download a version-2
report in the browser.

Draw calls and triangles, when a browser later captures them, are resource
counts from one render. They are not FPS or phone performance.
