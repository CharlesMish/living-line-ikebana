# Waterline: seat the line in water

Baseline: `main` at `785016bb3bfea44a659579fdb1437f42492af350` (PR #54 merged),
unchanged when this branch was cut. First review head: `e2111bd`. The final head
SHA is recorded in PR #55. Presentation-only experiment. It **preserves**
the behavioral contract: no generator, graph field, solver, hit arbitration,
transaction, camera pose, orbit limit or persistence change.

## Hypothesis

This is a presentation choice made for readability. It is not a claim that an
exposed kenzan is wrong ikebana: practice and photography vary, and a visible
pin frog is a legitimate choice. In this renderer, though, the kenzan's top
(0.55) sat above the water (0.46). Its tall, sparse metallic pins (0.25 high on
a 0.16 grid) were the darkest and highest-contrast thing in the bowl, and every
stem started on top of it. Thin dark stems, especially the arching trailer, lost
contrast there. The key light (-5, 10, 7) threw each stem's shadow 4–5 units
back and to the right, onto the floor outside the bowl, where it formed a second
full-size silhouette.

If each stem visibly **emerges from the water**, with its shadow landing **on**
that water, then the water shape, each line's point of origin, and its depth
among overlapping stems should all be easier to read. The kenzan stays visible as
a quiet seating field.

## What changed (all in `src/presentation/`)

- **Water fills the basin** at `WATER_Y = 0.59`, just below the lip (0.65), and
  covers the kenzan top. The insertion plane, usable radius and root height stay
  at 0.55, so seated stems now leave the water about 0.04 above their graph root.
  The water disc radius comes from the vessel's inner-wall profile.
- **A cheap Fresnel term** in the water shader: toward grazing angles, alpha rises
  and the colour blends toward a pale teal reflection. The low Front view now
  reads a surface instead of looking through to a submerged slab. From above it
  stays deep teal. The cost is one dot product per water fragment: no textures,
  render targets or reflection pass.
- **Waterline marks** (`waterline.ts`): a pale meniscus and a faint dark ripple
  at each contact between an active branch centerline and the water, inside the
  basin. They're elliptical along the stem's lean. They are derived from the
  current graph or live preview on every sync, never feed back, and use shared
  geometry. They follow Aim, Bend and Slide the base live. A prune preview hides
  marks on doomed material, including the doomed tip of the cut branch. The
  pending insertion ghost shows its mark only while valid.
- **Contact rules** (one mark per contact). Each centerline point is classed as
  below, on (within 1e-9) or above the surface:
  - **Emerging / submerging**: the line passes between below and above, either
    inside a segment or through a run of on-surface points. A trailer end that
    dips back in gets its own submerging mark.
  - **Touch**: a run bounded by the same side on both ends (a tangent contact),
    or a tip ending on the surface. It gets exactly one mark.
  - **Where the mark goes**: a run of on-surface points (a single vertex, or
    segments lying on the surface) gives one mark at its material midpoint,
    never one per segment.
  - **Branch starts**: a child branch whose first point is on the surface is
    covered by its parent's contact. A root starting on the surface takes the
    kind of the side it leads into.
  - Separate stems and genuinely distinct crossings keep their own marks. This
    fixes Astra's reproduced case, below → exactly `WATER_Y` → below, which
    previously produced an emerging and a submerging mark at the same point and
    material distance.
- **Quiet kenzan**: a matte near-black body, and short, fine, denser pins (0.11
  grid) that end just under the surface.
- **Lighting**: a steeper key (-3.2, 12.5, 4.4) with a tighter shadow frustum
  (±6), so shadows land on the water and vessel. The water receives shadows.
  Hemisphere/key are slightly reduced, and the fill is slightly raised, so plant
  exposure stays comparable (see blossom close-up).

## Matched evidence

Same arrangement (`evidence-arrangement.json`: bare branch aimed, arching trailer
aimed so its end dips, blossom spray aimed, fern, single flower aimed and bent,
bare-branch lateral pruned), made through the UI on the baseline build and then
loaded identically into both builds. Same scripted gestures, cameras, wheel
notches, viewports and DPR. Headless Chromium with SwiftShader WebGL, not a phone.
The acquisitions, canonical hash `ff247b15`, ordinal 5 and zero autosave writes
after the cancelled aim/prune/insert are identical on both builds
(`evidence-log.json`).

| | |
| --- | --- |
| Mixed arrangement, Front / ¾ / Above | `01-desk-front.png`, `01-desk-three-quarter.png`, `01-desk-above.png` |
| Base close-up (¾, six wheel notches) | `02-closeup-base.png` |
| Botanical close-up (blossom spray) | `03-closeup-blossom.png` |
| Aim mid-drag (fern rachis) | `04-aim-mid.png` |
| Prune preview mid-drag (trailer tip) | `05-prune-trailer-mid.png` |
| Insertion ghost over the pins | `06-insert-ghost.png` |
| 390×844 @2x, Front / ¾ | `07-phone390-front.png`, `07-phone390-three-quarter.png` |
| 320×640 @2x, Front / ¾ | `08-phone320-front.png`, `08-phone320-three-quarter.png` |

### Rendering cost (resource counts, not frame times)

Counts come from wrapping WebGL draw calls over three frames after one view
click, at 390×844 @2x with the evidence arrangement. They include the shadow
pass.

| View | Baseline calls / tris / instanced tris | Waterline |
| --- | --- | --- |
| Front | 273 / 43,562 / 19,828 | 285 / 44,546 / 19,264 |
| ¾ | 283 / 45,130 / 21,556 | 295 / 46,114 / 20,992 |
| Above | 258 / 41,662 / 17,236 | 270 / 42,646 / 16,672 |

That's +2 draw calls per waterline crossing (6 here). The pins are open 4-sided
instances, so the denser field adds no net triangles. The shadow map is still
1024². The water now samples the shadow map and runs the Fresnel term. **No
phone frame time was measured.**

### Validation on the finished branch

- `npm ci` and `npm run verify`: 278 tests (267 existing + 11 waterline tests),
  typecheck, build and standalone validation.
- The optional browser smoke test `tests/browser/automated-smoke.mjs` passes
  17/17 in Chromium against `dist/`. WebKit isn't installed in this environment.
- The matched images were re-rendered after the contact fix. They are pixel
  identical in the scene, as expected, because the evidence arrangement has no
  exact surface contacts.
- No physical-phone testing.

## Compromises and open questions

- Water at grazing angles is lighter and less saturated than baseline teal. It
  is still clearly teal, since Charlie previously asked for teal distinct from the
  ceramic, but check that on a phone.
- The submerged kenzan still shows as a slightly darker drum in ¾. I kept it as
  the seating cue. Fully hiding it would remove placement information.
- The steeper key flattens modeling on upward-facing surfaces a little. The
  blossom close-up is nearly unchanged, but I haven't compared all twelve materials.
- Stems now visibly start 0.04 below the surface rather than on a pin top. This
  is presentation only, and the graph root is unchanged.
- Rings are skipped outside the basin radius. Material hanging over the lip
  into air gets no mark, which is correct, but nothing detects ceramic collision
  either (unchanged).

## Garden View and Compare

Checked in headless Chromium at 1280×800 on the branch head. The Garden had two
seeded entries (A: trailer dipping, B: nodding flower), and the working bowl was
the evidence arrangement. `09-garden-view-b.png`, `10-garden-compare.png` and `garden-log.json` are in this folder.

| Step | Visible waterline marks per plant | Canonical hash |
| --- | --- | --- |
| Working bowl | 1, 2 (dipping trailer), 1, 1, 1 | `ff247b15` |
| View A | 1, 2, 1, 1, 1 | `8a8133df` |
| Camera drag in A; a press in A stays a camera gesture (viewing is Step Back only) | unchanged | `8a8133df` |
| Switch to B | 1 (A's marks gone) | `8933c2a0` |
| Return to my bowl | 1, 2, 1, 1, 1 | `ff247b15` |
| Aim held mid-drag, then Escape | follows the preview, then restores | `ff247b15` |
| Compare A \| B, zoom out twice, leave | each pane shows its own marks; main bowl unchanged | `ff247b15` |

The raw `studio-v1` and `garden-v1` storage strings were byte-identical before
and after. There were zero autosave writes and no page errors. Compare panes use
their own studios at world scale 1, so the water plane and the marks share
scale. (If comparison ever used a world scale other than 1, the marks would need
to scale with the water rather than with the botanical root.)

## Not reproduced / unresolved

**The intermittently invisible bud support remains unresolved.** Fresh
`one-branch-v1` (seed 8278) rendered its bud pedicel in Front, ¾ and Above
close-ups on both builds. That does not reproduce the report. Nothing here fixes
it or claims to.

## Playtest guide (phone)

1. Seat two or three materials, then look at Front without doing anything. Can
   you tell where each stem enters the water? Does the pin frog still pull your eye?
2. Aim the arching trailer low so its end dips. Does the second ring read as
   "it's in the water now", and is that useful or noise?
3. Slide a base and bend a stem while watching the water. Does the ring follow
   without lag or flicker?
4. Hold a prune on a trailer tip that's in the water: its ring should vanish
   with the doomed part, then return when you cancel.
5. Above view: do shadows on the water help separate overlapping stems, or do
   they muddy the water shape?
6. Report whether the water still reads as teal water, not grey, on your screen.
