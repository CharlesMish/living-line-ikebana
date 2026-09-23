# Phase 1 phone card

Physical-phone evidence: **not run**. Headless Chrome is not a phone signoff. Do not score a desktop or emulated pass as this card.

Two builds stay separate. Do not open the bend-stations flag on the materials build, and do not treat bend-stations as the default shaper.

## Builds

Materials, Phase 1 head `f666db8c1b9e46fc9daef05dba09a895844f8e86`:

```sh
git checkout f666db8c1b9e46fc9daef05dba09a895844f8e86
npm ci && npm run build
```

Open `dist/ikebana-web-alpha-standalone.html`. Purpose: the ten-material palette, including foliage fan, blossom spray, and nodding flower. Workbench bowls add `?workbench=1`.

Bend stations, frozen tip `2b3e49023e0087fd317b89eb91e6d4020f1c0cd7`, branch `cursor/bend-stations-220e`. Build that commit in its own checkout. Purpose: optional Lower / Middle / Upper bead, not a new material.

- Experiment: `dist/ikebana-web-alpha-standalone.html?experiment=bend-stations`
- Normal shaping, same build: `dist/ikebana-web-alpha-standalone.html` with no `experiment` parameter

GitHub Pages deploys `main` only. These files are local previews. They are not production.

Back up Garden before clearing site data. `?fresh=1` starts an empty working bowl and does not wipe Garden.

## 1. Reaching the final material

Portrait, then a short landscape window.

1. Open Materials.
2. Scroll the list until **Nodding flower** is fully visible. It is the last row. Catalog order is flowering branch, leafy shoot, bare branch, single flower, reed, flower volume, arching trailer, foliage fan, blossom spray, nodding flower.
3. Tap Nodding flower.

Expected: the selected card changes to Nodding flower. The bowl does not gain a cutting. Nothing is saved by the selection itself.

## 2. Fan arm versus leaf

Workbench, fixture **foliage fan**, seed **8278**, count **1**. Front, then three-quarter.

1. Choose Prune.
2. Touch a leaf on the opening arm.

Expected: the cue names a leaf stem and one leaf. Release would remove that leaf, not the whole arm. Cancel instead (Escape, or switch to Shape).

3. Touch the bare part of the opening arm, near where it leaves the main stem and before the first leaf.

Expected: the cue names a branch, with the tip and three attached stems and three leaves. That is the arm. The other two arms stay solid.

4. Cancel. Preview the same bare spot again. Release only on the second preview.

Expected: the opening side is gone. The answering arm and the crown arm remain. Reload. The cut is still there. Branch and leaf records remain in the arrangement; they are inactive, not deleted.

A press in the middle of the arm from the front often lands on the leaf that sits in front of it. That is the leaf. The bare base is the arm.

## 3. Canceling an edit

On any seated cutting, in Arrange:

1. Start an aim, a bend, or a prune and move it enough to see the preview.
2. Press Escape, or switch Shape/Prune, before release.

Expected: the preview disappears. The cutting matches what it was before the gesture. A reload does not show that preview. A second, ordinary release can keep a new edit.

## 4. Lower, Middle, and Upper

Use only the bend-stations build above. Seat one flowering branch. Then, separately, load a crowded bowl (workbench **round 3 palette** or several cuttings seated close together).

1. Select a stem. Confirm Lower, Middle, and Upper are visible and that Middle is the one already chosen.
2. Choose Lower, then Upper. The pale point should move along that same stem. The stem's length does not change until you drag the point and release.
3. On the crowded bowl, repeat. Note whether the three words stay readable and whether the point is still obviously on the stem you selected.
4. Open the same build with no `experiment` parameter. The Lower / Middle / Upper control should be gone. The pale point is the ordinary middle bend.

Do not score this section as a fixed-bead study trial. `?bend=touch` turns the station control off.

## 5. Return to normal shaping and check saved work

1. Leave the bend-stations preview.
2. Open the materials build with no experiment flag.
3. Shape and prune as usual. Reload.

Expected: the ordinary pale point is back. Work you released is still in the bowl. A cancelled gesture is not. A workbench Garden keep does not replace the player bowl.

## Record

- iPhone model, iOS, Safari
- viewport before and after the browser chrome moves
- which build URL and which query string
- first-try misses, especially arm versus leaf and Lower / Middle / Upper on the crowded bowl

Until that record exists, this card is not run.
