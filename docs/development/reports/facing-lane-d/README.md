# Lane D — single-flower facing diagnosis

Baseline `cf1cf73c267ca9cd7d3b93961f7061708e5a2b37`.
Requested model: Grok 4.7 high thinking. Run identity reports `originalModelName: grok-4.7`.

This note preserves the behavioral contract. Generators, gestures, and persistence are unchanged. Bloom-face roll stays on draft PR #29 and is outside this diagnosis.

## What was measured

The face normal is column 2 of the production organ-group world matrix (local +Z) after `ThreeStudio.createPlantVisual` / `syncPlantVisual`. That is the same group the studio draws. The angle to a canonical view is the angle between that normal and the direction from the group's world position to that view's camera position. 0° means the face points at the camera. 90° is edge-on.

Canonical cameras are the production poses: Front `(0, 3.7, 15)` looking at `(0, 2.55, 0)`, Three-quarter `(9.72, 6.42, 11.1)` looking at `(0, 2.4, 0)`.

The saved specimen is `artifacts/single-flower-led-garden.json`, plant `plant-1`, generator `single-flower-v1`, seed `8278`, organ `plant-1:bloom`.

| Quantity | Measured |
| --- | --- |
| Face normal vs Front | 57.31° |
| Face normal vs Three-quarter | 97.88° |
| Viewing rays through the bloom | 43.90° |
| Bloom spin | 0.1756 rad |
| Stem length | 5.3081 |

Those match the reference for this specimen (about 57.3°, 97.9°, and 43.9°). The rays are 43.9° apart through this bloom. The angle between the two camera-forward axes, ignoring the bloom, is 41.94°. The specimen figure uses the rays through the bloom.

One face normal cannot sit closer than half of 43.90°, about 21.95°, to both cameras at once.

## How the player session was run

Headless Chrome 148, SwiftShader, Linux. CSS viewport 1280×800, drawing buffer 1280×800, device pixel ratio 1. Not a physical phone.

The session used the production page at `?fresh=1&test=1`: Garden → Import backup of the saved arrangement → open the card → Make a working copy → Arrange → View. Each task started again from that working copy of the untouched specimen (canonical hash `f14e50d4`). Drags were pointer events on the canvas. A drag was released only when the hover cue read "Aim flower stem", which acquires the pedicel. Escape on a wrong grab uses the existing cancel path.

After every release, the canonical snapshot was measured again with the production organ group. Spin stayed 0.1756. Stem length stayed 5.3081. Leaf stalks did not move. No bend was committed.

A continuous clip was not recorded. The stills below are one frame per saved pose.

## Task 1 — face the bloom toward Front

Start: 57.31° from Front, 97.88° from Three-quarter. Stills: `01-saved-front.png`, `02-saved-three-quarter.png`.

The bloom and the upper main stem occupy the same screen neighborhood. A 30px shift changes the cue from "Aim flower stem" to "Aim main stem".

| Action | Drag | Front | Three-quarter | Stem moved | Pedicel moved |
| --- | --- | --- | --- | --- | --- |
| 1 | flower stem `(680,220)` → `(820,160)` | 32.35° | 52.70° | 0 | 0.87 |
| 2 | flower stem `(728,180)` → `(740,300)`, trying to level the face | 40.88° | 84.75° | 0 | 0.25 |
| 3 | flower stem `(680,240)` → `(700,110)`, trying to recover Front | 41.72° | 12.58° | 0 | 1.12 |

Three committed aims. The best Front angle in the sequence was 32.35° (`03-task1-best-front.png`). The third drag, made while looking at Front, left Front at 41.72° and turned the face to 12.58° from Three-quarter (`04-task1-front-final.png`, `05-task1-three-quarter-final.png`). The correction did not converge. The main stem never moved.

A sampled search of front-view drags on the same pedicel can reach about 2.5° from Front. That pose was not found by eye in this short sequence. Reachability, below, keeps that search apart from the play.

## Task 2 — face the bloom toward Three-quarter

Fresh copy of the specimen. Three-quarter still reads edge-on at 97.88° (`02-saved-three-quarter.png`).

A coarse hover grid on that view found 9 "Aim flower stem" cells, 26 "Aim main stem" cells, and 36 "Aim leaf stem" cells. The edge-on bloom is a thin target among the stem and the two leafy shoots.

| Action | Where | Front | Three-quarter | Stem moved | Pedicel moved |
| --- | --- | --- | --- | --- | --- |
| 1 | Three-quarter, `(624,206)` → `(480,150)` | 112.89° | 101.38° | 0 | 0.79 |
| 2 | Three-quarter, `(584,180)` → `(780,300)` | 55.71° | 86.74° | 0 | 0.59 |
| 3 | switched to Front, `(688,216)` → `(880,150)` | 66.65° | 71.58° | 0 | 0.90 |
| 4 | back to Three-quarter, `(724,192)` → `(760,70)` | 86.05° | 50.53° | 0 | 1.13 |

Four committed aims, plus two view changes. The best Three-quarter angle was 50.53° (`07-task2-best-three-quarter.png`). The first drag made the face worse (`06-task2-first-drag.png`). The sequence did not face Three-quarter.

A sampled pedicel aim with a free 3D target can reach about 10.7° from Three-quarter, and an optimized two-step view-plane sequence can reach about 7.5°. Those are poses the search can reach. This short play did not find them.

## Task 3 — an intermediate facing, stem line kept

Fresh copy again. The intended stem is the main stem of the saved flower. Only the flower stem was dragged.

Before the first drag, a press at `(650,220)`, on the bloom's screen area, acquired "Aim main stem" at material distance 4.69, near the top of the 5.31 stem (`08-task3-stem-miss.png`). Escape restored the snapshot. Status: "Kept as it was." Hash remained `f14e50d4`.

| Action | Where | Front | Three-quarter | Stem moved | Pedicel moved |
| --- | --- | --- | --- | --- | --- |
| 1 | Front, `(680,220)` → `(790,200)` | 35.03° | 65.13° | 0 | 0.74 |
| 2 | Three-quarter, `(692,180)` → `(780,120)` | 55.64° | 37.40° | 0 | 1.00 |

Two committed aims. Leaves did not move. The final pose (`11-task3-three-quarter-intermediate.png`, `12-task3-front-intermediate.png`) is between the saved 57°/98° pair and a single-camera face, and it still favors Three-quarter (37°) over Front (56°). The first aim favored Front (35°/65°, `09-task3-front-one-aim.png`, `10-task3-three-quarter-one-aim.png`). The player can slide along that tradeoff by moving the flower head. The main stem stays put. The bisector, about 22° from each camera, was not reached.

## Conclusion

Two separate questions. **Reachability** is what Aim and the other current player controls can geometrically do to this bloom. **Practical control** is what a player could select and drive in the short sessions above.

### Reachability

The viewing rays through this bloom are 43.90° apart. One face normal cannot lie within about 21.95° of both cameras at once. The angle between the camera-forward axes, ignoring the bloom, is 41.94°. The specimen figure uses the rays through the bloom. The bound belongs to these two cameras and this flower's position, and it remains for any later edit that still has a single face.

Pedicel aim is a rigid rotation of the flower stalk about its root. A sequence of those aims is still one rigid motion of the original stalk. Bloom `spin` stays at the generated 0.1756 rad. The face stays perpendicular to the stalk tangent. The main stem can stay fixed while the flower head moves, so a drag that looks helpful in one view can present the face to the other camera.

Sampled pedicel aim, stem fixed, head free, 1500 directions, measured with the production organ group:

| Search | Front | Three-quarter | Stem moved |
| --- | --- | --- | --- |
| Best Front | 4.85° | 41.45° | 0 |
| Best Three-quarter | 43.97° | 10.71° | 0 |
| Best simultaneous | 18.24° | 25.52° | 0 |

No sample put both views under 25°. A search of front-view drags on the same pedicel reaches about 2.5° from Front. A free 3D pedicel target reaches about 10.7° from Three-quarter, and an optimized two-step view-plane sequence reaches about 7.5°. Each of those near-faces leaves the other camera near 40°.

Stem aim moved the stem by about 7 units. Its best simultaneous facing was about 37°. A coarse stem-bend sample did not beat pedicel aim. Changing the canonical view changes the plane of the drag. It leaves the bloom's heading around the stalk where generation put it.

On this specimen, Aim can place the bloom near Front or nearer Three-quarter, with the stem held and the head moved. The same aim leaves the other view far off. The best compromise in the sample, 18.24° and 25.52°, sits against the 43.90° dual-view floor.

### Practical control

The short sessions stayed well short of those poses.

The bloom, the flower stem, and the upper main stem share one screen neighborhood. A 30px shift changes the cue from "Aim flower stem" to "Aim main stem." On Three-quarter, a hover grid found 9 "Aim flower stem" cells, 26 "Aim main stem" cells, and 36 "Aim leaf stem" cells. The edge-on bloom is a thin target among the stem and the two leafy shoots.

Before Task 3's first drag, a press at `(650,220)` on the bloom's screen area acquired "Aim main stem" at material distance 4.69, near the top of the 5.31 stem (`08-task3-stem-miss.png`). Escape restored the snapshot. Status: "Kept as it was." Hash remained `f14e50d4`.

Committed play, each from a fresh copy:

- Front, three flower-stem aims. Best Front angle 32.35° (`03-task1-best-front.png`), with Three-quarter at 52.70°. The third drag, made while looking at Front, left Front at 41.72° and the face 12.58° from Three-quarter (`04-task1-front-final.png`, `05-task1-three-quarter-final.png`). The main stem never moved. That 32° frame is more open than the saved 57° pose, and it is still far from the about 2.5° pose a front-view drag search can reach.
- Three-quarter, four flower-stem aims and two view changes. Best Three-quarter angle 50.53° (`07-task2-best-three-quarter.png`). The first drag moved the face to 101.38° (`06-task2-first-drag.png`).
- Intermediate, stem kept, two flower-stem aims. Final 55.64° from Front and 37.40° from Three-quarter (`12-task3-front-intermediate.png`, `11-task3-three-quarter-intermediate.png`). The flower head moved about a unit. Leaves did not move. The bisector, about 22° from each camera, was not reached.

A player can keep the main stem and slide the head along a Front / Three-quarter tradeoff. In these short sessions, selection among bloom, flower stem, and main stem stayed ambiguous, and the committed aims did not arrive at the near-faces the search shows are reachable.

### Recommendation

**Defer** shipping a roll control.

Current Aim does not give practical dual-view facing control on this specimen. Short play can take the main stem when the press was aimed at the bloom, Escape puts that grab back, and the committed aims stayed far from the single-view poses Aim can reach. The 43.90° gap between the viewing rays remains a limit on one face being close to both cameras at once.

Roll is a different degree of freedom: spin about the supporting tangent, the organ group's local Y. With this stalk held fixed and measured through the same production group:

| Spin about the supporting tangent | Front | Three-quarter |
| --- | --- | --- |
| Best Front | 18.21° | 42.99° |
| Best Three-quarter | 47.54° | 4.65° |
| Best simultaneous | 26.58° | 23.18° |

The face turns in the plane perpendicular to the stalk, and the head stays put. On this saved stalk that plane does not contain the Front ray, so spinning the saved pose does not square the face to Front. The simultaneous pair sits a few degrees outside the 21.95° dual-view floor because that plane does not contain the bisector. Those figures describe the missing motion. They are not a result of player Aim.

Stalk twist (`referenceNormal` around the pedicel tangent) and a roll of the whole cutting are further, different motions. This diagnosis does not test them.

The spin edit stays experimental on draft PR #29, behind `?experiment=organ-roll`. This note does not add that control or change persistence. A later review of #29 can still ship it, revise it, or drop it. The reason to defer here is the split above: the short Aim sessions are a practical-control result, and the missing spin is a separate question.
