# Bloom-face roll experiment

Off unless the page is opened with `?experiment=organ-roll`. The Materials
panel, Shape, and Prune are unchanged. Press **Roll face**, then drag a bloom
sideways.

## What rotates

The active bloom's persistent `spin`, around the supporting branch tangent.
That is the organ group's local Y, the same axis production already uses when
it places the bloom. The flower head stays on the stalk. The stalk centerline,
the stem, the leaves, and stock length stay on the acquisition snapshot.

This is the bloom's heading. Twisting the stalk would rotate that branch's
`referenceNormal` and the tube. Rolling the whole cutting would swing the
leaves and the flower head around the stem. Neither of those is this control.

A leaf is not a target. Turning a rigid leaf around its stalk is not a
deformable blade, and this experiment does not add a leaf specimen.

## Transaction and persistence

Each drag stores the graph at acquisition and applies the pointer's horizontal
delta to that snapshot's spin. Release commits. Escape, pointer cancel, and
the other existing interruptions restore the snapshot and write no save.
`spin` is already a schema v1 organ field, so a commit autosaves through the
existing document. There is no new generator version and no migration.

One gesture turns at most half a revolution from the acquired spin.

## Studio check

Headless Chrome 148, SwiftShader, CSS viewport 1280×800. Workbench
`single-flower` count 1 (generator seed 8278), Arrange, Shape, Front. This is
the generated cutting, not the saved garden arrangement measured in the facing
diagnosis.

Roll face was hidden until `?experiment=organ-roll`. After pressing it, the
bloom hit said “Roll flower face” (“Drag sideways. The stalk stays put.”).
Neighboring hits still said “Aim flower stem” or “Aim main stem.”

One sideways drag of 150px:

- Bloom spin `0.17563461314421147` → `1.9756346131442115` (exactly +1.8 rad, 150 × 0.012).
- Production organ-group face normal turned 103.13°, the same angle. The supporting tangent was unchanged. The organ origin did not move. The face stayed perpendicular to that tangent.
- On this generated pose the face went from 137.57° off Front and 173.20° off Three-quarter to 48.96° and 72.27°. That was a fixed drag, not an attempt to square the bloom to either camera.
- Every branch, both leaf spins, and the pedicel reference normal were unchanged. Canonical hash `21619d02` → `23970f9d`. One autosave write.

A second drag, then Escape, restored the committed spin. Status: “Kept as it was.” Hash and autosave count stayed on the committed roll. A page without the flag keeps the button hidden.

## Recommendation

Defer shipping this control. A short play of the saved single flower could not
reliably face Front or Three-quarter with ordinary aim, and those two viewing
rays are about 44° apart on that specimen, so one face cannot front both.
Spin can turn the face without moving the head, and only inside the plane
perpendicular to the stalk. Keep the flag for review. Default play does not
include the verb.
