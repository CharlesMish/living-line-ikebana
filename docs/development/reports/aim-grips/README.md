# Short-stalk grip and arch aiming investigation

Base: `27fa20c` (merged botanical/shaping PR #53). Trigger: Charlie's playtest of
an intermittently missing bud support, a difficult nodding head, and a difficult
arching trailer. No new materials, generator changes, persisted fields, or bend
changes in this pass.

## Confirmed control problems and changes

**Nodding head:** the real bell is much larger than its v2 terminal stalk (0.09
units). Picking the visible corolla previously aimed from the hidden attachment
instead. A small drag therefore used a very short lever. Production picking now
also returns its real surface intersection; the app freezes that grip and edit
plane for the whole Aim. The same rigid continuation rotation still pivots about
the supporting branch root. Both versions of the nodding flower benefit; its v2
upper stem stays independently shapeable. Other visible organ surfaces use the
same rule. Soft proxy misses retain their graph attachment as the fallback.
Prune always retains its material-distance station. This does not add free roll,
a new handle, or deform the corolla.

**Trailer:** clamping a trunk's grabbed target to `root.y + 0.08` assumes that
the grabbed material points upward. Dragging the descending limb of a low arch
quickly saturated there. It could also jump on acquisition after bending lowered
that material below the floor. The shared constraint now acts on the seated
first-segment direction instead: minimum unit-tangent Y is
`min(acquiredExit.y, clamp(0.08 / activeLength, 0, 1))`. A requested rigid rotation
that violates that bound stops at it. This intentionally revises the Aim
contract for all trunks, without material-ID exceptions. It preserves stock,
attachments and the upward exit while permitting a descending distal end.
It is **not** a ceramic/water collision solver; overhang and penetration remain
separate questions. No generator or saved arrangement is regenerated.

## Missing support: unresolved

The supplied screenshot shows a bud without an obvious support. Its exact
saved graph and edit sequence are not available. No claim that either Aim fix
resolves it. The production tube updater already recomputes both bounds, so we
did not disable frustum culling or add speculative renderer resets.

Added a production-presentation regression investigation across three seeds:
prune preview/cancel, a cut exactly retaining the bud's parent node, stalk Aim,
root bend, and base movement. Checks cover visible/opaque support meshes,
finite tube rings matching the graph, valid indices and bounds, and organ
attachment coincidence. These pass; they cannot prove GPU pixels or rule out an
intermittent device-specific rendering failure.

If it recurs, a kept moment/export of the affected arrangement plus the current
view and last operation would let the same graph be replayed. A screenshot
before changing the view is useful even if later manipulation makes it return.

## Validation

- `npm ci` and `npm run verify`: 267 tests pass, 0 fail; typecheck and
  self-contained standalone validation pass.
- Production picking + actual app Aim acquisition/move + coordinator exercised
  without GPU rendering, on v1 and v2 bells in a 390×844 projected viewport.
- Exact return-to-start; immutable graph; unchanged lower/upper stem while
  turning its terminal head; cancel without save/ordinal change; owner release
  saves once; serialized reload; no saved surface-grip context.
- Trailer response across three seeds; lower-end reacquisition without a jump;
  extreme root requests from three grab distances preserve stock/attachments
  and the seated exit.
- Full existing fixture/golden suite remains a gate.
- Live public workbench attempted through the cloud browser. It displayed
  “The studio could not open” / WebGL unavailable. **No successful GPU browser
  playtest or physical-phone sign-off in this pass.**

## Focused next phone check

1. Turn the nodding bell by dragging its visible surface; small adjustments,
   reverse, release, then reacquire. Its upper stem should not move with a head
   edit. Orbit to expose the head if the stem occludes it.
2. Drag the trailer's descending limb slightly lower and raise it again. No
   snap merely from touching an already lowered end. Verify the seated exit
   still points upward under an extreme drag.
3. Cancel a held head drag by switching away; return and reload. Only a prior
   ordinary release should have saved.
4. If the floating bud reappears, preserve that arrangement before trimming or
   moving other material. This remains open until reproduced.
