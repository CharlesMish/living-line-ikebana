# Smaller pinbeds and base recovery

This integration starts at main c519ec9 and takes the approved Small bed, Single small bowl, Medium oval and Angles/Studio menu direction from isolated study commit 2e59baafd7de43c3c4031aa6bf9b2e047ce9d80f. The study branch and its evidence remain intact. Tight bed and the study-only mutable registry/bootstrap are excluded.

## Behavior and compatibility

Studio → Vessel adds the three stable profile IDs `pinbed-small`, `pinbed-single`, and `pinbed-medium-oval`. The seven existing layouts remain available and Original remains the default. Studio puts Vessel and Photograph before Garden and Guide. Angles groups camera presets and stem inspection/protection. Regrouping the selector retains the actual restored selection, including a saved new layout.

Switching from Separate small bowls to a smaller footprint intentionally leaves the old roots where they were. Previously the ellipse adapter allowed that acquired root, but a second origin-centred radius clamped it from ±1.65 to ±1.22 on acquisition. The secondary guard now encloses the same acquired legacy ellipse. Already-allowed coordinates return exactly, avoiding subtract/add roundoff on a no-motion grab. The acquired connected component and per-grab allowance remain unchanged; this is a correctness repair, not auto-fitting, free repositioning, or a ban on switching nonempty scenes.

Protection still checks the continuous whole-stem path. In the synthetic flowering-pair reproduction, the second stem legitimately contacts the first while moving inward even after the jump is fixed. The held cue and released status name Prevent overlaps and explain the Angles escape route. There is no solver bypass, automatic rerouting or geometry nudge. Protection remains optional and session-only.

Canonical graphs, generators, rest lengths, attachments, inactive cut history, insertion ordinals, transaction laws and save versions remain unchanged. Three additive scene IDs use the existing v2 envelope. Legacy v1 bytes remain read-only fallbacks; unsupported IDs fail closed. Older clients cannot read a scene with a newly added ID; reload the updated app before continuing. No personal creations were used, uploaded, migrated in place or overwritten.

## Evidence

- Focused domain/persistence run: 66/66 pass. New regression cases cover both remote roots, all ten layouts, protection on/off, exact acquisition and no-motion release, deliberate recovery, cancellation with no save, Undo retention, rest lengths, attachment coincidence, unrelated stems and pruned history.
- Local full verification: typecheck passes; 434/435 tests pass. The sole failure is the inherited frozen phase-2 Garden fixture comparison at approximately 1e-16 on this Mac, already reproduced on the unchanged base. Build and distribution validation pass separately. A full green Linux `npm run verify` is required before merge.
- `tests/browser/pinbed-release.mjs`: actual pointer acquisition/release, cancellation, recovery, no-op then Undo, reload and selector restoration pass for Petite and all three new profiles, with protection off/on (eight cases). The flowering-pair contact and release explanation pass.
- Fresh phone-emulated contexts: 320×568, 390×844, 568×320 and 390×844 with doubled root font size keep the action row aligned and controls reachable; keyboard Studio → Vessel order, Photograph, Garden/Guide and Angles checks pass without horizontal overflow.
- All three new layouts keep/reopen/return through Garden. Opaque square exports are 1600×1600, alpha 255; transparent portrait exports are 1200×1600, alpha 0…255. Reopened square exports are pixel-identical to their first capture. Lighting and color remain fixed.
- Separate synthetic legacy migration browser check covers ordinary startup, untouched v1 bytes, existing layouts, v2 backup export/import in a fresh phone-emulated context, working copy/reload, exact photograph repeat at DPR 3, and 320px/landscape controls. No personal browser profile is used.

Browser regression invocation (start Vite first):

```sh
IKEBANA_URL=http://127.0.0.1:4186/ \
IKEBANA_EVIDENCE_DIR=/tmp/pinbed-evidence \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
node tests/browser/pinbed-release.mjs
```

Playwright is an external test harness, not a new shipped dependency. The default module resolution also accepts an installed `playwright`. Node 22 is the release runtime.

## Owner trial

1. In a disposable browser or `?combinedPreview=1`, open Studio → Vessel. Try Small bed, Single small bowl and Medium oval. Original and the seven previous options should remain available.
2. Plant two cuttings in Separate small bowls, then switch to a smaller layout. The stems stay in place. Grab and release a base without moving: it must stay exactly there. Deliberately drag toward the new bed, cancel once, then commit and use Edit → Undo last edit.
3. In Angles, enable Prevent overlaps. Move two flowering branches toward each other. A real contact can still stop movement; the status explains why. Try another route or turn protection off explicitly. Arrange edits plants; Step Back moves the camera.
4. In Studio → Photograph choose Sage/Stone, square, and a view. Export, Keep, reopen from Garden and capture again. Try transparent portrait. Close Photograph repeatedly, return to the working arrangement, and reload.
5. On a physical phone check acquisition precision, reachability, scrolling, cancel during a hold, repeated capture and Files behavior. Record the device and browser. Automated geometry/render/storage passes do not establish physical touch feel, Safari sharing behavior, thermals or battery use.
