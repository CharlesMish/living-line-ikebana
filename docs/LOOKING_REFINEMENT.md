# Looking refinement — review disposition and phone card

This pass applies the consolidated review to the two existing materials. It adds
no material, inventory rule, score, progression system or school lesson.

## Actual current issues addressed

- **Conflicting verbs:** Step Back now says Orbit / Pan, with a hint that the bowl
  and cuttings stay together. Plant placement says Slide the base across the pins.
  The internal `move` token and camera test hook remain compatible. No camera or
  plant solver changed.
- **Research UI competing with help:** the guide's bend comparison and telemetry
  export are hidden and inert in normal play. `?debug=1` reveals Testing tools.
  Explicit alternate-bend URLs still work and the guide describes the active mode.
- **Concrete instructions:** the guide explains aim, bend with retained length,
  slide the base, and the material that will leave on release. The exact distal
  prune preview and committed cut history are preserved. Escape closes the guide
  and returns keyboard focus to its opener.
- **Premature expansion advice:** the material handoff notes no longer prescribe
  bare twig next. Repeated copies of both current materials are already available.

## Vessel disposition and limits of verification

Source inspection confirms a vessel body, transparent water surface, rim, kenzan
and pins. Missing descriptive nouns in a bundled file do not establish missing
scene objects. Conversely, their presence does not establish visual legibility.

The available preview browser rejected the local build with
`net::ERR_BLOCKED_BY_CLIENT`. No rendered scene or responsive-layout audit could be
completed in this pass, and no physical-phone observations were made. The vessel
and water geometry/materials have therefore been retained, rather than changed on
an unobserved aesthetic premise. Water readability remains the first visual check
below; this pass does not claim it is solved or that the layout has phone sign-off.

`npm ci` and `npm run verify` pass: 98 tests, TypeScript, production build and
self-contained distribution validation. The browser smoke script passes syntax
checking but was not run. Automated validation covers the existing graph, material,
cancellation, camera and save contracts. It cannot decide whether a person perceives water, understands Pan,
or finds the material satisfying to handle.

## Optional study: ready as an in-game prompt

Open the guide (i), then **Optional study · Line and water**:

> Reveal one strong leaning line. Leave a shape of water visible.

The player can use either cutting and any number of copies, inspect Front and
Above, close the guide and arrange, and return to the prompt whenever useful.
Finishing is their judgment. There is no start transaction, finish detector,
recorded completion, forced view, reset or change to their existing arrangement.
The prompt is ready for an observational test; its value is still a hypothesis.

## Ten-minute phone observation

Use the current standalone or a build of this branch, without diagnostic URL flags.
Record the phone/browser, orientation and whether the participant has used the game
before. Keep the optional prompt closed initially. Do not coach the observations.

1. **Open play, about three minutes.** Ask them to make an arrangement using the
   two available materials. Multiple copies are allowed. Note what they acquire,
   revise and inspect without suggesting water, gaps or an ideal silhouette.
2. **Reframe, about one minute.** Ask them to see the arrangement from another
   position and adjust the framing in a short/landscape window. Watch Orbit / Pan,
   then their first action after returning to Arrange. Ask what they think moved.
3. **Look again.** After free play, ask once: “Why is that stem there?” Record the
   answer in their words. Then ask what the different surfaces in Above appear to
   be. Recognition prompted by this question is weaker evidence than spontaneous
   use of water or space earlier.
4. **Optional study, about three minutes.** Offer the prompt and let them decide
   whether to use it with their existing arrangement. Observe whether a new view
   changes an actual placement, lean or cut. Do not supply the intended answer.
5. **Close, about one minute.** Ask when it felt finished and whether there is one
   thing they wanted to do but could not. Keep input misses separate from missing
   compositional possibilities. Ordinary cancel/reload checks belong to the full
   phone test card; do not let technical coaching become evidence of spontaneous
   artistic decisions.

| Question | Evidence that weakens the direction | Useful positive observation |
| --- | --- | --- |
| Pan versus placement | Returns to Arrange expecting a base drag to reframe everything | Reframes the whole scene, then deliberately slides one base |
| Vessel and water | Describes only a decorative tray; surface never matters | Leaves or creates an open water shape without coaching |
| Insertion | Searches for a free grid point only | Moves a base because its line crowds another line or the rim |
| Above | Uses it once on request, then changes nothing because of it | Revises a lean, placement or cut after inspecting Above |
| Finite material | Repeatedly tries to stretch stock or treats cutting as undo | Prunes deliberately to clarify a continuation or gap |
| Reason for placement | Only “the flower looked nice” or “it landed there” | Describes a relation between material, space or viewpoint |

A flower-focused answer is not wrong or a failure by the participant. It is weak
evidence for our particular hypothesis that this instrument encourages looking at
relations and empty space. One short playtest guides the next refinement; it is
not a proof about all players. Compare spontaneous and prompted behavior explicitly.

If water reads weakly, first try separating rim / water / pin-field values or the
water boundary, then repeat the same views. Avoid meters, percentages, target
zones and overlays that teach the participant what the observation is meant to
establish. Choose a third material only after identifying a specific missing
choice. Keep progression and second-session architecture undecided.

## Modest grounding

The project borrows a shallow-vessel workbench and an expressive approach to
arrangement; it does not teach a hybrid school. [Web Japan's moribana overview](https://web-japan.org/kidsweb/virtual/ikebana/ikebana03.html)
explains the shallow vessel and kenzan and distinguishes school-specific forms.
[Sogetsu's curriculum description](https://www.sogetsu.or.jp/e/order/textbooks/C1230/)
places expressive, free-arrangement studies within a progression of basics and
later work with material and space. Expressive openness is not an absence of
form. Verify and attribute any future formal lesson separately; keep school roles,
ratios and certification judgments out of the core plant graph.
