# Single-flower head handling and first-drag investigation

Base: PR #90, `3226687`. This pass changes the direct single-flower face gesture;
it does not replace its generator, author a neck, change stock or add organ roll.

## Diagnosis

The single flower already routes a visible petal hit to its own pedicel. It also
already freezes the actual surface grip, following the earlier nodding-head fix.
The remaining problem is geometric: its shallow flower opens perpendicular to
its supporting stalk. Pointing pivot-to-grip through a camera-facing plane often
moves that stalk without changing the visible face much. Opposite drags also
have different gain because the requested point approaches or leaves the pivot.
This is a supported limitation of that mapping, not a wrong-parent pick.

A CPU probe used production meshes, raycasting, projected 390×844 Front view,
and the nearest visible petal hit to the projected bloom centre. These are face
normal changes in degrees after a 40 CSS-pixel drag, from the same acquisition:

| Seed | Old right | Old down | Revised right | Revised down |
| --- | ---: | ---: | ---: | ---: |
| 8278 | 60.51 | 6.69 | 39.80 | 31.09 |
| 9255 | 38.09 | 11.65 | 39.28 | 38.56 |
| 10232 | 15.85 | 7.72 | 39.57 | 35.34 |

The revised left/up changes have the same magnitudes as right/down. Face-normal
change need not equal the requested rotation angle: it depends on the face's
angle to that rotation axis. These measurements establish response and symmetry,
not perceived ease on a phone.

## Intentional gesture change

Only a real surface hit on the single flower's bloom uses the new head tilt.
The acquired camera right/up axes and angular gain are frozen. A horizontal drag
turns about screen-up; a vertical drag turns about screen-right. The combined
screen-plane rotation requests one degree per CSS pixel, capped at 120 degrees
per grab. It is recomputed from the immutable acquisition, never accumulated.
The status says “Turn the flower face.” The existing rigid operation carries the
pedicel and active descendants around its root, preserving all stock, material
frames, attachments, identity and inactive history. A zero-motion start and a
return to the start remain exact. Another grab can continue turning.

A stalk grab retains ordinary point-directed Aim. Proxy-only organ hits retain
the attachment fallback. Other flowers, including nodding flower, are unchanged.
This deliberately avoids quietly replacing every material's shaping law. The
current head remains a rigid single surface, with no individually editable
petals and no separate axial-roll verb.

`beginAim` also accepts a supplied surface grip on a branch-bound blade, for the
parallel broad-blade implementation. Ordinary tubes do not supply one. This uses
the existing surface-grip law and does not activate single-flower head tilt.

## Verification

- `npm run verify`: typecheck, **494/494 tests**, build and self-contained
  distribution validation pass on this lane.

- Production single-flower picking and actual app acquisition/move/coordinator
  tests across seeds 8278, 9255 and 10232. Both axes produce useful facing changes;
  the supporting stem, leaves and inactive records remain unchanged.
- Frozen camera axes; other-pointer exclusion; exact return; interruption with
  no save; ordinary release; serialized reload; Undo; unchanged insertion ordinal.
- Prevent-overlaps enabled uses the existing rigid-rotation contact path. With
  an unobstructed head it matches the ordinary result within floating-point
  tolerance. The detector still covers structural stems, not petal collisions.
- Existing nodding surface-grip and contact-prevention regressions pass. The
  nodding test's old `cancel("pointer-cancel")` call passed a reason as an owner;
  it now uses `pointerCancel(7)` and checks that no active transaction remains.
- Running the new six-test file with the old production app acquisition/move
  source restored makes the gesture regressions fail. This checks the real app
  integration rather than merely a helper that the app might stop calling.
- No browser/GPU or physical-phone run was available in this environment.

## Reported first-drag freeze: unresolved

Charlie saw an initial roughly one-minute freeze followed by normal play. No
matching device trace or saved event sequence is available. Source review found
no network wait or unbounded loop in first material reservation/construction.
A local CPU probe constructing and disposing 20 production flowering-branch
visuals took approximately 138 ms in aggregate. This excludes shader compilation,
GPU work, browser scheduling, context recovery and host-page overhead; it does
not reproduce or explain the reported stall. No speculative renderer reset,
shader warm-up, or input timeout has been added.

If it recurs, the valuable distinction is whether the whole page stops responding
or the ghost alone stops following, plus whether opening Photograph preceded it.
The issue remains open and is not a claimed improvement in this patch.

## Short owner check

Place a Single flower, drag its visible face left/right then up/down, release,
and reacquire. Its lower stem and leaves should stay put. Grab the stalk itself
to aim the stem instead. Try one Undo, then one cancelled head edit. The main
remaining judgement is whether one degree per pixel feels controlled on a phone;
that gain can be tuned without changing the graph or save format.
