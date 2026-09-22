# Arching trailer — composition notes

Lane C, Round 3. Baseline `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37`.
Generator `arching-trailer-v1`. Requested model: Grok 4.7 high thinking.
Exposed session identity: Grok 4.7.

## Example

`artifacts/arching-trailer-across-water.json` is one Garden backup:

- `plant-1`, seed 8278, `arching-trailer-v1`, base `(0, 0.55, 0)`. The cane arches toward −X and ends near the left rim.
- `plant-2`, seed 9255, `leafy-shoot-v1`, base `(0.62, 0.55, 0.28)`. An upright leafy voice on the opposite side of the pins.

The trailer is the line that crosses the open water. The leafy shoot does not. Closest cane-to-leafy-stem distance on this placement is about 0.68. Both graphs are unbent rest poses, so the arch is the authored structure, not a bend that was posed for the camera.

Import the backup from Garden. Open the card. Use View → Front, ¾, and Above. Those presets are the canonical cameras (`src/app/camera.ts`). Do not orbit to a angle that hides the tip.

## What the three views are for

- Front, from +Z: the rise over the pins, the descent across the teal water, and the tip near the left lip. The leafy shoot is the vertical stem on the right.
- Three-quarter: the same descent has depth (seed 8278 tip z ≈ 0.38) instead of reading as a flat card.
- Above: the plan of the arch from the pin field across the water disc toward the rim. This is the view that shows whether the line actually crosses water.

## Intersection notes

Numbers are for seed 8278 at the center seat unless another pose is named. Cane radius 0.031. Water y = 0.46, radius 2.345. Rim torus radius 2.48, y = 0.635, tube 0.035.

| Pose | Water | Rim / wall | Where |
| --- | --- | --- | --- |
| Center, unbent | Clears. Lowest open-water centerline is the tip at y = 0.659. Clearance after the cane radius is 0.168. | Clears. Gap to the rim torus after tube and cane radius is 0.089. No ceramic sample. | Tip radius 2.327 |
| Center, bend down by 0.25 at the 0.54 station | Tip enters the water (y ≈ 0.385, radius ≈ 2.18). | Still inside the bowl. | Existing solver, no collision |
| Center, saturated bend down | Tip y = −0.194, radius 1.604. Through the water and through the basin floor. | — | Offsets −1.0 and −1.4 saturate at the same pose |
| Base slid to radius 1.22 along the arch | The end is outside the bowl (tip radius ≈ 3.55, y = 0.659). | Crosses the rim radius at about y = 1.27, over the lip, then hangs outside. | Base clamp is still 1.22 |
| Downward aim | Tip can reach about y = 0.05. | The aim floor still constrains the trunk target to `root.y + 0.08`. It does not hold the whole arch above the water. | Rigid aim of a descending rest pose |

Leaf attachments on the centered rest pose are near y = 1.06–1.42, above the water. A saturated downward bend brings the outer leaf attachment to about y = 0.47, at the water surface.

## Narrow layout

The selected source stays one card. Arching trailer is a fifth row inside the existing Materials menu, not a new rail. Each choice has a minimum height of 2.75rem. The menu’s max height is `min(18rem, 50dvh)`, and in a short landscape window `min(12rem, 100dvh - 5.5rem)`, with vertical scroll. Five rows fit the tall menu and scroll in the short one. Below 640px the row silhouettes hide and the name remains. Below 360px the source-card grip hides. Large text already wraps the top rail (`max-width: 28rem`). These are CSS observations. A rendered narrow viewport and a physical phone were not part of the pre-screenshot revision; phone feel is untested.

## What this does not claim

The centered clearance is the unbent rest pose. It is not a bowl collision guarantee. The player still has one bend station. Shortening the trail is a prune, which keeps the inactive leaf as history.
